'use strict';

var express = require('express');
var router  = express.Router();

// ================================================
//   LOAD CONTROLLER WITH DIAGNOSTICS
// ================================================

var ctrl = require('../controllers/authController');

console.log('=== AUTH ROUTES LOADING ===');
console.log('ctrl.register:',       typeof ctrl.register);
console.log('ctrl.login:',          typeof ctrl.login);
console.log('ctrl.getMe:',          typeof ctrl.getMe);
console.log('ctrl.updateProfile:',  typeof ctrl.updateProfile);
console.log('ctrl.changePassword:', typeof ctrl.changePassword);
console.log('ctrl.forgotPassword:', typeof ctrl.forgotPassword);
console.log('ctrl.resetPassword:',  typeof ctrl.resetPassword);

// ================================================
//   LOAD MIDDLEWARE
// ================================================

var protect = require('../middleware/auth').protect;
console.log('protect middleware:', typeof protect);

// ================================================
//   SAFETY CHECK
//   Crash loudly if any function is undefined
//   so Render shows the real error
// ================================================

var requiredFunctions = [
  'register', 'login', 'getMe',
  'updateProfile', 'changePassword',
  'forgotPassword', 'resetPassword'
];

requiredFunctions.forEach(function (fn) {
  if (typeof ctrl[fn] !== 'function') {
    throw new Error(
      'authController.' + fn + ' is ' + typeof ctrl[fn] +
      ' — export is missing or undefined'
    );
  }
});

console.log('=== ALL AUTH FUNCTIONS VERIFIED ===');

// ================================================
//   PUBLIC ROUTES
// ================================================

router.post('/register',       ctrl.register);
router.post('/login',          ctrl.login);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password',  ctrl.resetPassword);

// ================================================
//   PROTECTED ROUTES
// ================================================

router.get ('/me',              protect, ctrl.getMe);
router.put ('/update-profile',  protect, ctrl.updateProfile);
router.put ('/change-password', protect, ctrl.changePassword);

console.log('=== AUTH ROUTES REGISTERED ===');

module.exports = router;