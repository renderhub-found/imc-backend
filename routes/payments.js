'use strict';

const express     = require('express');
const router      = express.Router();
const ctrl        = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

// Debug log — confirms file loaded
console.log('✅ Payment routes file loaded');

// POST /api/payments/initialize
router.post('/initialize', protect, ctrl.initializePayment);

// POST /api/payments/verify
router.post('/verify', protect, ctrl.verifyPayment);

// POST /api/payments/webhook (public — Paystack calls this)
router.post('/webhook', ctrl.handleWebhook);

// GET /api/payments/test (quick test — no auth needed)
router.get('/test', function (req, res) {
  res.json({
    success:  true,
    message:  'Payment routes working!',
    routes: [
      'POST /api/payments/initialize',
      'POST /api/payments/verify',
      'POST /api/payments/webhook'
    ]
  });
});

module.exports = router;