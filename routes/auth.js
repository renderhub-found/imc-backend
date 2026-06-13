'use strict';

var express  = require('express');
var router   = express.Router();

// ---- Load controller safely ----
var ctrl;
try {
  ctrl = require('../controllers/authController');
  console.log('[Auth Routes] Controller loaded OK');
  console.log('[Auth Routes] Functions:', Object.keys(ctrl));
} catch (err) {
  console.error('[Auth Routes] FAILED to load controller:', err.message);
  // Return error for every route if controller fails
  module.exports = router;
  return;
}

// ---- Load middleware safely ----
var protect;
try {
  protect = require('../middleware/auth').protect;
  console.log('[Auth Routes] Middleware loaded OK');
} catch (err) {
  console.error('[Auth Routes] FAILED to load middleware:', err.message);
}

// ================================================
//   PUBLIC ROUTES — no token needed
// ================================================

// POST /api/auth/register
router.post('/register', function (req, res) {
  console.log('[Auth] POST /register hit');
  if (typeof ctrl.register !== 'function') {
    return res.status(500).json({
      success: false,
      message: 'register controller not found'
    });
  }
  return ctrl.register(req, res);
});

// POST /api/auth/login
router.post('/login', function (req, res) {
  console.log('[Auth] POST /login hit');
  if (typeof ctrl.login !== 'function') {
    return res.status(500).json({
      success: false,
      message: 'login controller not found'
    });
  }
  return ctrl.login(req, res);
});

// POST /api/auth/forgot-password
router.post('/forgot-password', function (req, res) {
  console.log('[Auth] POST /forgot-password hit');
  if (typeof ctrl.forgotPassword !== 'function') {
    return res.status(500).json({
      success: false,
      message: 'forgotPassword controller not found'
    });
  }
  return ctrl.forgotPassword(req, res);
});

// POST /api/auth/reset-password
router.post('/reset-password', function (req, res) {
  console.log('[Auth] POST /reset-password hit');
  if (typeof ctrl.resetPassword !== 'function') {
    return res.status(500).json({
      success: false,
      message: 'resetPassword controller not found'
    });
  }
  return ctrl.resetPassword(req, res);
});

// ================================================
//   PROTECTED ROUTES — token required
// ================================================

// GET /api/auth/me
router.get('/me', function (req, res) {
  console.log('[Auth] GET /me hit');
  if (typeof protect !== 'function') {
    return res.status(500).json({ success: false, message: 'Auth middleware not loaded' });
  }
  if (typeof ctrl.getMe !== 'function') {
    return res.status(500).json({ success: false, message: 'getMe controller not found' });
  }
  return protect(req, res, function () {
    return ctrl.getMe(req, res);
  });
});

// PUT /api/auth/update-profile
router.put('/update-profile', function (req, res) {
  if (typeof protect !== 'function' || typeof ctrl.updateProfile !== 'function') {
    return res.status(500).json({ success: false, message: 'Route not configured' });
  }
  return protect(req, res, function () {
    return ctrl.updateProfile(req, res);
  });
});

// PUT /api/auth/change-password
router.put('/change-password', function (req, res) {
  if (typeof protect !== 'function' || typeof ctrl.changePassword !== 'function') {
    return res.status(500).json({ success: false, message: 'Route not configured' });
  }
  return protect(req, res, function () {
    return ctrl.changePassword(req, res);
  });
});

module.exports = router;