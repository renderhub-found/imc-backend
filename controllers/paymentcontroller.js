'use strict';

const https  = require('https');
const Vendor = require('../models/Vendor');
const Ad     = require('../models/Ad');
const Course = require('../models/Course');
const User   = require('../models/User');

// =============================================
//   HELPER: Make HTTPS request to Paystack
// =============================================

function paystackRequest(path, method, data) {
  return new Promise(function (resolve, reject) {
    var bodyStr = (data && method !== 'GET')
      ? JSON.stringify(data)
      : '';

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
      response.on('data', function (chunk) { raw += chunk; });
      response.on('end', function () {
        try {
          var parsed = JSON.parse(raw);
          console.log('[Paystack] Response status:', parsed.status);
          resolve(parsed);
        } catch (e) {
          console.error('[Paystack] Parse error:', e.message);
          reject(new Error('Invalid Paystack response: ' + raw));
        }
      });
    });

    req.on('error', function (err) {
      console.error('[Paystack] Request error:', err.message);
      reject(err);
    });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// =============================================
//   INITIALIZE PAYMENT
//   POST /api/payments/initialize
// =============================================

const initializePayment = async function (req, res) {
  try {
    console.log('[Payment] Initialize called by:', req.user.email);
    console.log('[Payment] Body:', JSON.stringify(req.body));

    var amount      = parseInt(req.body.amount)      || 0;
    var type        = (req.body.type        || '').trim();
    var description = (req.body.description || type).trim();
    var metadata    = req.body.metadata     || {};

    // Validate
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
                 'Example: vendor_registration, ad_posting, course_purchase'
      });
    }

    // Check Paystack key exists
    if (!process.env.PAYSTACK_SECRET_KEY ||
        process.env.PAYSTACK_SECRET_KEY.includes('your_secret')) {
      console.log('[Payment] Using simulated mode — no real Paystack key');

      // Return simulated response for development
      var fakeRef = 'IMC-' + type.toUpperCase() + '-' + Date.now();
      return res.status(200).json({
        success:          true,
        message:          'Payment initialized (simulated — add real Paystack key for live)',
        authorizationUrl: 'https://checkout.paystack.com/simulated',
        accessCode:       'simulated_access_code',
        reference:        fakeRef,
        simulated:        true
      });
    }

    // Amount in kobo
    var amountKobo = amount * 100;

    // Unique reference
    var reference = 'IMC-' + type.toUpperCase().replace(/_/g, '-') +
                    '-' + Date.now();

    // Frontend callback URL
    var callbackUrl = (process.env.FRONTEND_URL ||
                       'http://127.0.0.1:5500') +
                       '/payment-success.html';

    var paystackPayload = {
      email:        req.user.email,
      amount:       amountKobo,
      reference:    reference,
      callback_url: callbackUrl,
      metadata: Object.assign({}, metadata, {
        type:        type,
        userId:      req.user._id.toString(),
        userEmail:   req.user.email,
        description: description,
        cancel_action: callbackUrl.replace('success', 'cancel')
      })
    };

    console.log('[Payment] Calling Paystack with ref:', reference);

    var response = await paystackRequest(
      '/transaction/initialize',
      'POST',
      paystackPayload
    );

    if (!response.status || !response.data) {
      console.error('[Payment] Paystack error:', response.message);
      return res.status(400).json({
        success: false,
        message: response.message || 'Paystack initialization failed.'
      });
    }

    console.log('[Payment] Initialized successfully:', reference);

    return res.status(200).json({
      success:          true,
      message:          'Payment initialized.',
      authorizationUrl: response.data.authorization_url,
      accessCode:       response.data.access_code,
      reference:        response.data.reference
    });

  } catch (err) {
    console.error('[Payment] Initialize error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Payment initialization failed: ' + err.message
    });
  }
};

// =============================================
//   VERIFY PAYMENT
//   POST /api/payments/verify
// =============================================

const verifyPayment = async function (req, res) {
  try {
    var reference = (req.body.reference || '').trim();
    var type      = (req.body.type      || '').trim();

    console.log('[Payment] Verify called. Reference:', reference, 'Type:', type);

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference is required.'
      });
    }

    // Check if this is a simulated payment
    if (reference.includes('simulated') ||
        !process.env.PAYSTACK_SECRET_KEY ||
        process.env.PAYSTACK_SECRET_KEY.includes('your_secret')) {

      console.log('[Payment] Simulated verify for:', reference);

      // Update record in database
      var simResult = await updateRecordAfterPayment(
        type, reference, req.user, 0, req.body.metadata || {}
      );

      return res.status(200).json({
        success:    true,
        message:    'Payment verified (simulated).',
        reference:  reference,
        amount:     parseInt(req.body.amount) || 0,
        simulated:  true,
        updated:    simResult
      });
    }

    // Real Paystack verification
    var response = await paystackRequest(
      '/transaction/verify/' + encodeURIComponent(reference),
      'GET',
      null
    );

    console.log('[Payment] Paystack verify response:', response.status);

    if (!response.status || !response.data) {
      return res.status(400).json({
        success: false,
        message: 'Could not verify with Paystack.'
      });
    }

    var transaction = response.data;

    if (transaction.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: 'Payment not successful. Status: ' + transaction.status
      });
    }

    var amountPaid = transaction.amount / 100;
    var metadata   = transaction.metadata || {};

    // Update database record
    var updateResult = await updateRecordAfterPayment(
      type || metadata.type,
      reference,
      req.user,
      amountPaid,
      metadata
    );

    console.log('[Payment] Verify success. Amount: ₦' + amountPaid);

    return res.status(200).json({
      success:      true,
      message:      'Payment verified successfully!',
      reference:    reference,
      amount:       amountPaid,
      email:        transaction.customer.email,
      paidAt:       transaction.paid_at,
      updateResult: updateResult
    });

  } catch (err) {
    console.error('[Payment] Verify error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Verification failed: ' + err.message
    });
  }
};

// =============================================
//   UPDATE DATABASE AFTER SUCCESSFUL PAYMENT
// =============================================

async function updateRecordAfterPayment(
  type, reference, user, amount, metadata
) {
  console.log('[Payment] Updating record. Type:', type);

  try {
    if (type === 'vendor_registration') {
      var vendor = await Vendor.findOneAndUpdate(
        { user: user._id },
        { paymentStatus: 'paid', paymentRef: reference },
        { new: true }
      );
      console.log('[Payment] Vendor updated:', vendor ? vendor.bizName : 'not found');
      return {
        updated: 'vendor',
        bizName: vendor ? vendor.bizName : 'not found'
      };
    }

    if (type === 'ad_posting') {
      var ad = await Ad.findOneAndUpdate(
        { ownerEmail: user.email, paymentStatus: 'pending' },
        { paymentStatus: 'paid', paymentRef: reference },
        { new: true, sort: { createdAt: -1 } }
      );
      console.log('[Payment] Ad updated:', ad ? ad.title : 'not found');
      return {
        updated: 'ad',
        title:   ad ? ad.title : 'not found'
      };
    }

    if (type === 'course_purchase') {
      var courseId = metadata.courseId;
      if (!courseId) {
        return { updated: 'none', reason: 'courseId missing from metadata' };
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
        updated: 'course',
        title:   course.title,
        fileUrl: course.fileUrl
      };
    }

    console.log('[Payment] No matching type:', type);
    return { updated: 'none', type: type };

  } catch (err) {
    console.error('[Payment] Update record error:', err.message);
    return { error: err.message };
  }
}

// =============================================
//   PAYSTACK WEBHOOK
//   POST /api/payments/webhook
// =============================================

const handleWebhook = async function (req, res) {
  try {
    var crypto = require('crypto');

    var rawBody = req.body;
    if (Buffer.isBuffer(rawBody)) {
      rawBody = rawBody.toString();
    } else {
      rawBody = JSON.stringify(rawBody);
    }

    var hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '')
      .update(rawBody)
      .digest('hex');

    var signature = req.headers['x-paystack-signature'];

    if (!signature || hash !== signature) {
      console.log('[Webhook] Invalid signature');
      return res.status(400).json({ message: 'Invalid signature' });
    }

    var event;
    try {
      event = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    } catch (e) {
      return res.status(400).json({ message: 'Invalid JSON' });
    }

    console.log('[Webhook] Event received:', event.event);

    if (event.event === 'charge.success') {
      var data      = event.data;
      var metadata  = data.metadata     || {};
      var type      = metadata.type     || '';
      var userEmail = metadata.userEmail || data.customer.email;
      var reference = data.reference;
      var amount    = data.amount / 100;

      var user = await User.findOne({ email: userEmail });
      if (user) {
        await updateRecordAfterPayment(type, reference, user, amount, metadata);
        console.log('[Webhook] Record updated for:', userEmail);
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