'use strict';

const https  = require('https');
const Vendor = require('../models/Vendor');
const Ad     = require('../models/Ad');
const Course = require('../models/Course');
const User   = require('../models/User');

// ================================================
//   HELPER: Paystack API request
// ================================================

function paystackRequest(path, method, data) {
  return new Promise(function (resolve, reject) {
    var bodyStr = '';

    if (data && method !== 'GET') {
      bodyStr = JSON.stringify(data);
    }

    var options = {
      hostname: 'api.paystack.co',
      port:     443,
      path:     path,
      method:   method,
      headers: {
        'Authorization': 'Bearer ' + process.env.PAYSTACK_SECRET_KEY,
        'Content-Type':  'application/json',
        'Cache-Control': 'no-cache'
      }
    };

    if (bodyStr) {
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    console.log('[Paystack] ' + method + ' https://api.paystack.co' + path);

    var req = https.request(options, function (response) {
      var raw = '';
      response.on('data', function (chunk) { raw += chunk; });
      response.on('end', function () {
        try {
          var parsed = JSON.parse(raw);
          console.log('[Paystack] Status:', parsed.status, '| Message:', parsed.message);
          resolve(parsed);
        } catch (e) {
          console.error('[Paystack] Parse error. Raw:', raw.substring(0, 200));
          reject(new Error('Invalid Paystack response'));
        }
      });
    });

    req.on('error', function (err) {
      console.error('[Paystack] Request error:', err.message);
      reject(err);
    });

    req.setTimeout(30000, function () {
      req.destroy();
      reject(new Error('Paystack request timed out'));
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
    console.log('[Payment] Initialize called');
    console.log('[Payment] Body:', JSON.stringify(req.body));
    console.log('[Payment] User:', req.user.email);

    var amount      = parseInt(req.body.amount)      || 0;
    var type        = (req.body.type        || '').trim();
    var description = (req.body.description || type).trim();
    var metadata    = req.body.metadata     || {};

    // ---- Validate ----
    if (!amount || amount < 100) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be at least ₦100.'
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Payment type is required. ' +
                 'Use: vendor_registration, ad_posting, course_purchase'
      });
    }

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Payment system not configured. Contact support.'
      });
    }

    // ---- Amount in kobo ----
    var amountKobo = amount * 100;

    // ---- Unique reference ----
    var reference = 'IMC-' +
      type.toUpperCase().replace(/_/g, '-') +
      '-' + Date.now();

    // ---- Callback URL ----
    var frontendUrl = process.env.FRONTEND_URL ||
      'https://resilient-ganache-be5b9c.netlify.app';
    var callbackUrl = frontendUrl + '/payment-success.html';

    // ---- Build Paystack payload ----
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
        description: description,
        custom_fields: [
          {
            display_name: 'Payment Type',
            variable_name: 'payment_type',
            value: type
          },
          {
            display_name: 'Customer Email',
            variable_name: 'customer_email',
            value: req.user.email
          }
        ]
      })
    };

    console.log('[Payment] Initializing with ref:', reference);
    console.log('[Payment] Amount (kobo):', amountKobo);
    console.log('[Payment] Channels:', payload.channels);

    // ---- Call Paystack ----
    var response = await paystackRequest(
      '/transaction/initialize',
      'POST',
      payload
    );

    if (!response.status || !response.data) {
      console.error('[Payment] Paystack rejected:', response.message);
      return res.status(400).json({
        success: false,
        message: response.message || 'Payment initialization failed.'
      });
    }

    console.log('[Payment] Initialized successfully');
    console.log('[Payment] Authorization URL:', response.data.authorization_url);

    return res.status(200).json({
      success:          true,
      message:          'Payment initialized.',
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
      message: 'Payment initialization failed. Please try again.'
    });
  }
};

// ================================================
//   VERIFY PAYMENT
//   POST /api/payments/verify
// ================================================

const verifyPayment = async function (req, res) {
  try {
    var reference = (req.body.reference || '').trim();
    var type      = (req.body.type      || '').trim();

    console.log('[Payment] Verify called');
    console.log('[Payment] Reference:', reference);
    console.log('[Payment] Type:', type);
    console.log('[Payment] User:', req.user.email);

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference is required.'
      });
    }

    // ---- Verify with Paystack ----
    var response = await paystackRequest(
      '/transaction/verify/' + encodeURIComponent(reference),
      'GET',
      null
    );

    if (!response.status || !response.data) {
      return res.status(400).json({
        success: false,
        message: 'Could not verify payment. Please try again.'
      });
    }

    var transaction = response.data;
    console.log('[Payment] Transaction status:', transaction.status);
    console.log('[Payment] Amount paid (kobo):', transaction.amount);

    if (transaction.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: 'Payment not completed yet. ' +
                 'Status: ' + transaction.status +
                 '. Please complete the transfer and try again.'
      });
    }

    var amountPaid = transaction.amount / 100;
    var metadata   = transaction.metadata || {};
    var finalType  = type || metadata.type || '';

    console.log('[Payment] Payment successful! Amount: ₦' + amountPaid);
    console.log('[Payment] Updating record for type:', finalType);

    // ---- Update database ----
    var updateResult = await updateRecordAfterPayment(
      finalType,
      reference,
      req.user,
      amountPaid,
      metadata
    );

    return res.status(200).json({
      success:      true,
      message:      'Payment verified! ₦' + amountPaid.toLocaleString() + ' confirmed.',
      reference:    reference,
      amount:       amountPaid,
      paidAt:       transaction.paid_at,
      updateResult: updateResult
    });

  } catch (err) {
    console.error('[Payment] Verify error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Verification failed. Please try again.'
    });
  }
};

// ================================================
//   UPDATE DATABASE AFTER PAYMENT
// ================================================

async function updateRecordAfterPayment(type, reference, user, amount, metadata) {
  console.log('[Payment] Updating DB. Type:', type);

  try {
    // ---- Vendor Registration ----
    if (type === 'vendor_registration') {
      var vendor = await Vendor.findOneAndUpdate(
        { user: user._id },
        { paymentStatus: 'paid', paymentRef: reference },
        { new: true }
      );
      console.log('[Payment] Vendor updated:', vendor ? vendor.bizName : 'not found');
      return {
        updated:     'vendor',
        bizName:     vendor ? vendor.bizName : 'not found',
        redirectUrl: '/vendor-dashboard.html'
      };
    }

    // ---- Ad Posting ----
    if (type === 'ad_posting') {
      var ad = await Ad.findOneAndUpdate(
        { ownerEmail: user.email, paymentStatus: 'pending' },
        { paymentStatus: 'paid', paymentRef: reference },
        { new: true, sort: { createdAt: -1 } }
      );
      console.log('[Payment] Ad updated:', ad ? ad.title : 'not found');
      return {
        updated:     'ad',
        title:       ad ? ad.title : 'not found',
        redirectUrl: '/post-ad.html'
      };
    }

    // ---- Course Purchase ----
    if (type === 'course_purchase') {
      var courseId = metadata.courseId;

      if (!courseId) {
        console.log('[Payment] courseId missing from metadata');
        return { updated: 'none', reason: 'courseId missing' };
      }

      var course = await Course.findById(courseId);
      if (!course) {
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
      }

      console.log('[Payment] Course updated:', course.title);
      return {
        updated:     'course',
        title:       course.title,
        fileUrl:     course.fileUrl,
        redirectUrl: '/online-courses.html'
      };
    }

    console.log('[Payment] No matching type:', type);
    return { updated: 'none', type: type };

  } catch (err) {
    console.error('[Payment] DB update error:', err.message);
    return { error: err.message };
  }
}

// ================================================
//   PAYSTACK WEBHOOK
//   POST /api/payments/webhook
// ================================================

const handleWebhook = async function (req, res) {
  try {
    var crypto = require('crypto');

    var rawBody = req.body;
    if (Buffer.isBuffer(rawBody)) {
      rawBody = rawBody.toString('utf8');
    } else {
      rawBody = JSON.stringify(rawBody);
    }

    var hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '')
      .update(rawBody)
      .digest('hex');

    var signature = req.headers['x-paystack-signature'];

    if (!signature || hash !== signature) {
      console.log('[Webhook] Invalid signature — ignoring');
      return res.status(400).send('Invalid signature');
    }

    var event;
    try {
      event = JSON.parse(rawBody);
    } catch (e) {
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

      var user = await User.findOne({ email: userEmail });

      if (user) {
        await updateRecordAfterPayment(type, reference, user, amount, metadata);
        console.log('[Webhook] Record updated for:', userEmail, '| Type:', type);
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

module.exports = {
  initializePayment,
  verifyPayment,
  handleWebhook
};