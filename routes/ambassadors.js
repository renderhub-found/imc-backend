'use strict';

const { protect } = require('../middleware/auth');
const { adminProtect } = require('../middleware/adminAuth');
var express  = require('express');
var router   = express.Router();
var ctrl     = require('../controllers/ambassadorController');
var authMw   = require('../middleware/auth');
var protect  = authMw.protect;
var adminOnly = authMw.adminOnly;

console.log('[Ambassador Routes] Loading...');
console.log('[Ambassador Routes] registerAmbassador:', typeof ctrl.registerAmbassador);
console.log('[Ambassador Routes] getMyProfile:', typeof ctrl.getMyProfile);

// Verify all functions exist
var required = ['registerAmbassador','getMyProfile','getAllAmbassadors',
                'requestWithdrawal','claimTaskReward'];
required.forEach(function (fn) {
  if (typeof ctrl[fn] !== 'function') {
    throw new Error('ambassadorController.' + fn + ' is undefined');
  }
});

// Static routes FIRST — before any /:id
router.get('/my-profile',  protect,              ctrl.getMyProfile);
router.post('/register',   protect,              ctrl.registerAmbassador);
router.post('/claim-task', protect,              ctrl.claimTaskReward);
router.get('/',            protect, adminOnly,   ctrl.getAllAmbassadors);
router.get('/my-withdrawals', protect, ctrl.getMyWithdrawals);
router.get('/all', protect, adminProtect, ctrl.getAllAmbassadors);

console.log('[Ambassador Routes] ✅ All routes registered');

module.exports = router;