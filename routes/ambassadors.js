'use strict';

const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/ambassadorcontroller');
const { protect, adminOnly } = require('../middleware/auth');

// =============================================
// STATIC ROUTES FIRST
// =============================================

// GET  /api/ambassadors/my-profile
router.get('/my-profile', protect, ctrl.getMyProfile);

// POST /api/ambassadors/register
router.post('/register', protect, ctrl.registerAmbassador);

// POST /api/ambassadors/withdraw
router.post('/withdraw', protect, ctrl.requestWithdrawal);

// POST /api/ambassadors/claim-task
router.post('/claim-task', protect, ctrl.claimTaskReward);

// GET  /api/ambassadors  (admin only)
router.get('/', protect, adminOnly, ctrl.getAllAmbassadors);

module.exports = router;