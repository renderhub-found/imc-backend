'use strict';

const https  = require('https');
const Vendor = require('../models/Vendor');
const Ad     = require('../models/Ad');
const Course = require('../models/Course');
const User   = require('../models/User');

// ================================================
//   PAYSTACK API HELPER
// ================================================

function paystackRequest(path, method, data) {
  return new Promise(function (resolve, reject) {
    var bodyStr = (data && method !== 'GET')
      ? JSON.stringify(data) : '';

    var options = {
      hostname: 'api.paystack.co',
      port:     443,
      path:     path,
      method:   method,
      headers: {
        'Authorization': 'Bearer ' + process.env.PAYSTACK_SECRET_KEY,
        'Content-Type':  'application/json'
      }
    };

    if (bodyStr) {
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    console.log('[Paystack] ' + method + ' ' + path);

    var req = https.request(options, function (response) {
      var raw = '';
      response.on('data', function (c) { raw += c; });
      response.on('end', function () {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          console.error('[Paystack] Parse error. Raw:', raw.substring(0, 300));
          reject(new Error('Invalid Paystack response'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, function () {
      req.destroy();
      reject(new Error('Paystack timeout'));
    });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ================================================
//   INITIALIZE PAYMENT
//   POST /api/payments/initialize
// ================================================

const initializePayment = async function (req, res) {
  try {
    console.log('[Payment] Initialize — user:', req.user.email);
    console.log('[Payment] Body:', JSON.stringify(req.body));

    var amount      = parseInt(req.body.amount) || 0;
    var type        = (req.body.type        || '').trim();
    var description = (req.body.description || type).trim();
    var metadata    = req.body.metadata     || {};

    if (!amount || amount < 100) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be at least ₦100.'
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Payment type is required: vendor_registration | ad_posting | course_purchase'
      });
    }

    var amountKobo  = amount * 100;
    var reference   = 'IMC-' + type.toUpperCase().replace(/_/g, '-') + '-' + Date.now();
    var frontendUrl = process.env.FRONTEND_URL || 'https://resilient-ganache-be5b9c.netlify.app';
    var callbackUrl = frontendUrl + '/payment-success.html';

    var payload = {
      email:        req.user.email,
      amount:       amountKobo,
      reference:    reference,
      callback_url: callbackUrl,
      channels:     ['bank_transfer', 'card', 'ussd', 'bank'],
      metadata: Object.assign({}, metadata, {
        type:        type,
        userId:      req.user._id.toString(),
        userEmail:   req.user.email,
        description: description
      })
    };

    console.log('[Payment] Ref:', reference, '| Amount:', amount, '| Type:', type);

    var response = await paystackRequest('/transaction/initialize', 'POST', payload);

    if (!response.status || !response.data) {
      console.error('[Payment] Paystack error:', response.message);
      return res.status(400).json({
        success: false,
        message: response.message || 'Paystack initialization failed.'
      });
    }

    console.log('[Payment] Initialized OK. Ref:', response.data.reference);

    return res.status(200).json({
      success:          true,
      authorizationUrl: response.data.authorization_url,
      accessCode:       response.data.access_code,
      reference:        response.data.reference,
      amount:           amount,
      type:             type
    });

  } catch (err) {
    console.error('[Payment] Initialize error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Payment initialization failed: ' + err.message
    });
  }
};

// ================================================
//   VERIFY PAYMENT
//   POST /api/payments/verify
// ================================================

const verifyPayment = async function (req, res) {
  try {
    var reference  = (req.body.reference  || '').trim();
    var type       = (req.body.type       || '').trim();
    var vendorForm = req.body.vendorForm  || null;

    console.log('[Payment] Verify — ref:', reference, '| type:', type);
    console.log('[Payment] vendorForm present:', vendorForm ? 'YES' : 'NO');

    if (!reference) {
      return res.status(400).json({
        success: false, message: 'Payment reference is required.'
      });
    }

    // Verify with Paystack
    var response = await paystackRequest(
      '/transaction/verify/' + encodeURIComponent(reference),
      'GET', null
    );

    if (!response.status || !response.data) {
      return res.status(400).json({
        success: false, message: 'Could not verify with Paystack.'
      });
    }

    var tx = response.data;
    console.log('[Payment] Paystack status:', tx.status, '| Amount:', tx.amount / 100);

    if (tx.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: 'Payment not completed. Status: ' + tx.status + '. Please complete the transfer.'
      });
    }

    var amountPaid = tx.amount / 100;
    var metadata   = tx.metadata || {};
    var finalType  = type || metadata.type || '';

    // Run the correct post-payment action
    var result = await handlePaymentSuccess(
      finalType, reference, req.user, amountPaid, metadata, vendorForm
    );

    return res.status(200).json({
      success:      true,
      message:      'Payment verified! ₦' + amountPaid.toLocaleString() + ' confirmed.',
      reference:    reference,
      amount:       amountPaid,
      paidAt:       tx.paid_at,
      updateResult: result
    });

  } catch (err) {
    console.error('[Payment] Verify error:', err.message);
    return res.status(500).json({
      success: false, message: 'Verification failed: ' + err.message
    });
  }
};

// ================================================
//   HANDLE PAYMENT SUCCESS
//   Central handler for ALL payment types
// ================================================

async function handlePaymentSuccess(type, reference, user, amount, metadata, vendorForm) {
  console.log('[Payment] handlePaymentSuccess — type:', type, '| user:', user.email);

  try {

    // ============================================
    //   VENDOR REGISTRATION
    // ============================================
    if (type === 'vendor_registration') {

      // Check if vendor already exists
      var existingVendor = await Vendor.findOne({ user: user._id });

      if (existingVendor) {
        // Just update payment status
        existingVendor.paymentStatus = 'paid';
        existingVendor.paymentRef    = reference;
        await existingVendor.save();
        console.log('[Payment] Vendor exists, payment status updated:', existingVendor.bizName);
        return {
          updated:     'vendor',
          bizName:     existingVendor.bizName,
          redirectUrl: 'vendor-dashboard.html'
        };
      }

      // No vendor exists — create one now
      // Use vendorForm data if available, otherwise use metadata
      var form = vendorForm || metadata.vendorForm || null;

      if (form && form.bizName) {
        console.log('[Payment] Creating vendor from form data...');
        console.log('[Payment] Form:', JSON.stringify(form));

        var newVendor = await Vendor.create({
          user:          user._id,
          fullName:      form.fullName    || user.firstName + ' ' + (user.lastName || ''),
          email:         user.email,
          bizName:       form.bizName,
          university:    form.university  || '',
          category:      form.category   || '',
          description:   form.description || '',
          whatsApp:      form.whatsApp   || '',
          refCode:       form.refCode    || '',
          paymentRef:    reference,
          paymentStatus: 'paid',
          status:        'pending'
        });

        // Update user role
        await User.findByIdAndUpdate(user._id, { role: 'vendor' });

        // Credit ambassador
        if (form.refCode) {
          await creditAmbassador(form.refCode, newVendor._id, form.bizName);
        }

        console.log('[Payment] ✅ Vendor CREATED:', newVendor.bizName, '| ID:', newVendor._id);

        return {
          updated:     'vendor',
          bizName:     newVendor.bizName,
          vendorId:    newVendor._id,
          redirectUrl: 'vendor-dashboard.html'
        };

      } else {
        // No form data — mark payment as received
        // Frontend will prompt user to complete registration
        console.log('[Payment] No vendor form data. Storing payment ref for later.');
        return {
          updated:     'vendor_payment_received',
          note:        'Form data missing. User must complete registration.',
          redirectUrl: 'vendor.html'
        };
      }
    }

    // ============================================
    //   AD POSTING
    // ============================================
    if (type === 'ad_posting') {
      var ad = await Ad.findOneAndUpdate(
        { ownerEmail: user.email, paymentStatus: 'pending' },
        { paymentStatus: 'paid', paymentRef: reference },
        { new: true, sort: { createdAt: -1 } }
      );

      if (ad) {
        console.log('[Payment] ✅ Ad payment updated:', ad.title);
        return {
          updated:     'ad',
          title:       ad.title,
          redirectUrl: 'post-ad.html'
        };
      } else {
        console.log('[Payment] No pending ad found for:', user.email);
        return {
          updated:     'ad_not_found',
          note:        'No pending ad found',
          redirectUrl: 'post-ad.html'
        };
      }
    }

    // ============================================
    //   COURSE PURCHASE
    // ============================================
    if (type === 'course_purchase') {
      var courseId = metadata.courseId;

      if (!courseId) {
        console.log('[Payment] courseId missing from metadata');
        return { updated: 'none', reason: 'courseId missing' };
      }

      var course = await Course.findById(courseId);
      if (!course) {
        console.log('[Payment] Course not found:', courseId);
        return { updated: 'none', reason: 'course not found' };
      }

      var alreadyOwned = course.purchases.find(function (p) {
        return p.userEmail === user.email;
      });

      if (!alreadyOwned) {
        course.purchases.push({
          user:       user._id,
          userEmail:  user.email,
          amount:     amount,
          paymentRef: reference
        });
        course.students = (course.students || 0) + 1;
        await course.save();
        console.log('[Payment] ✅ Course purchase saved:', course.title);
      } else {
        console.log('[Payment] Course already owned:', course.title);
      }

      return {
        updated:     'course',
        title:       course.title,
        fileUrl:     course.fileUrl,
        redirectUrl: 'online-courses.html'
      };
    }

    console.log('[Payment] Unknown type:', type);
    return { updated: 'none', type: type };

  } catch (err) {
    console.error('[Payment] handlePaymentSuccess error:', err.message);
    return { error: err.message };
  }
}

// ================================================
//   CREDIT AMBASSADOR REFERRAL
// ================================================

async function creditAmbassador(refCode, vendorId, bizName) {
  try {
    var Ambassador = require('../models/Ambassador');
    var amb = await Ambassador.findOne({ refCode: refCode });
    if (!amb) return;
    amb.referrals.push({ vendorId: vendorId, vendorName: bizName, commission: 500 });
    amb.earnings += 500;
    await amb.save();
    console.log('[Payment] Ambassador credited:', amb.fullName);
  } catch (err) {
    console.error('[Payment] Ambassador credit error:', err.message);
  }
}

// ================================================
//   WEBHOOK
//   POST /api/payments/webhook
// ================================================

const handleWebhook = async function (req, res) {
  try {
    var crypto  = require('crypto');
    var rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : JSON.stringify(req.body);

    var hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '')
      .update(rawBody)
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      console.log('[Webhook] Invalid signature');
      return res.status(400).send('Invalid signature');
    }

    var event;
    try { event = JSON.parse(rawBody); } catch (e) {
      return res.status(400).send('Invalid JSON');
    }

    console.log('[Webhook] Event:', event.event);

    if (event.event === 'charge.success') {
      var data      = event.data;
      var metadata  = data.metadata     || {};
      var type      = metadata.type     || '';
      var userEmail = metadata.userEmail || (data.customer && data.customer.email) || '';
      var reference = data.reference;
      var amount    = data.amount / 100;

      console.log('[Webhook] type:', type, '| email:', userEmail, '| ref:', reference);

      var user = await User.findOne({ email: userEmail });
      if (user) {
        // Pass vendorForm from metadata if available
        var vendorForm = metadata.vendorForm || null;
        await handlePaymentSuccess(type, reference, user, amount, metadata, vendorForm);
        console.log('[Webhook] ✅ Processed for:', userEmail);
      } else {
        console.log('[Webhook] User not found:', userEmail);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Webhook] Error:', err.message);
    return res.status(200).json({ received: true });
  }
};

module.exports = { initializePayment, verifyPayment, handleWebhook };