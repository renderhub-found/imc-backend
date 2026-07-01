'use strict';

var express   = require('express');
var router    = express.Router();
var ctrl      = require('../controllers/ambassadorController');
var { protect, adminOnly } = require('../middleware/auth');
var { adminProtect }       = require('../middleware/adminAuth');

console.log('[Ambassador Routes] Loading...');
console.log('[Ambassador Routes] registerAmbassador:', typeof ctrl.registerAmbassador);
console.log('[Ambassador Routes] getMyProfile:', typeof ctrl.getMyProfile);

router.get('/my-profile',     protect,              ctrl.getMyProfile);
router.get('/my-withdrawals', protect,              ctrl.getMyWithdrawals);
router.post('/register',      protect,              ctrl.registerAmbassador);
router.post('/withdraw',      protect,              ctrl.requestWithdrawal);
router.post('/claim-task',    protect,              ctrl.claimTaskReward);
router.get('/',               protect, adminOnly,   ctrl.getAllAmbassadors);

console.log('[Ambassador Routes] ✅ All routes registered');

module.exports = router;