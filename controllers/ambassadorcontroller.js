'use strict';

const Ambassador = require('../models/Ambassador');
const User       = require('../models/User');

// ================================================
//   REGISTER AMBASSADOR
//   POST /api/ambassadors/register
// ================================================

const registerAmbassador = async function (req, res) {
  try {
    console.log('[Ambassador] register — user:', req.user.email);
    console.log('[Ambassador] body:', JSON.stringify(req.body));

    var existing = await Ambassador.findOne({ user: req.user._id });
    if (existing) {
      console.log('[Ambassador] Already exists:', existing.username);
      return res.json({
        success:    true,
        message:    'Already registered.',
        ambassador: existing
      });
    }

    var fullName   = (req.body.fullName   || '').trim();
    var university = (req.body.university || '').trim();
    var username   = (req.body.username   || '').toLowerCase().trim();
    var whatsApp   = (req.body.whatsApp   || '').trim();
    var social     = (req.body.social     || '').trim();
    var reason     = (req.body.reason     || '').trim();

    var missing = [];
    if (!fullName)   missing.push('fullName');
    if (!university) missing.push('university');
    if (!username)   missing.push('username');
    if (!whatsApp)   missing.push('whatsApp');

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing: ' + missing.join(', ')
      });
    }

    var taken = await Ambassador.findOne({ username: username });
    if (taken) {
      return res.status(400).json({
        success: false,
        message: 'Username "' + username + '" already taken.'
      });
    }

    var refCode = 'AMB-' + username.toUpperCase();

    console.log('[Ambassador] Creating document...');

    var ambassador = await Ambassador.create({
      user:        req.user._id,
      fullName:    fullName,
      email:       req.user.email,
      username:    username,
      university:  university,
      whatsApp:    whatsApp,
      social:      social || '',
      reason:      reason || '',
      refCode:     refCode,
      earnings:    0,
      referrals:   [],
      withdrawals: [],
      tasksDone:   [],
      status:      'active'
    });

    console.log('[Ambassador] ✅ Created! ID:', ambassador._id, '| refCode:', refCode);

    await User.findByIdAndUpdate(req.user._id, { role: 'ambassador' });
    console.log('[Ambassador] User role → ambassador');

    return res.status(201).json({
      success:    true,
      message:    'Ambassador account created! Referral code: ' + refCode,
      ambassador: ambassador
    });

  } catch (err) {
    console.error('[Ambassador] register error:', err.message);
    console.error('[Ambassador] stack:', err.stack);

    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Username already taken.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Registration failed: ' + err.message
    });
  }
};

// ================================================
//   GET MY PROFILE
//   GET /api/ambassadors/my-profile
// ================================================

const getMyProfile = async function (req, res) {
  try {
    console.log('[Ambassador] getMyProfile — user:', req.user.email);

    var ambassador = await Ambassador.findOne({ user: req.user._id });

    if (!ambassador) {
      return res.json({
        success:      true,
        isAmbassador: false,
        ambassador:   null
      });
    }

    return res.json({
      success:      true,
      isAmbassador: true,
      ambassador:   ambassador
    });
  } catch (err) {
    console.error('[Ambassador] getMyProfile:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
//   GET ALL AMBASSADORS — Admin
//   GET /api/ambassadors
// ================================================

const getAllAmbassadors = async function (req, res) {
  try {
    var ambassadors = await Ambassador.find().sort({ createdAt: -1 });
    return res.json({
      success:     true,
      count:       ambassadors.length,
      ambassadors: ambassadors
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
//   REQUEST WITHDRAWAL
//   POST /api/ambassadors/withdraw
// ================================================

const requestWithdrawal = async function (req, res) {
  try {
    var ambassador = await Ambassador.findOne({ user: req.user._id });
    if (!ambassador) {
      return res.status(404).json({ success: false, message: 'Ambassador not found.' });
    }

    var accountName = (req.body.accountName || '').trim();
    var bankName    = (req.body.bankName    || '').trim();
    var accountNum  = (req.body.accountNum  || '').trim();
    var amount      = parseInt(req.body.amount) || 0;

    if (!accountName || !bankName || !accountNum || !amount) {
      return res.status(400).json({
        success: false, message: 'All bank details and amount are required.'
      });
    }
    if (amount < 500) {
      return res.status(400).json({
        success: false, message: 'Minimum withdrawal is ₦500.'
      });
    }
    if (amount > ambassador.earnings) {
      return res.status(400).json({
        success: false, message: 'Amount exceeds available balance.'
      });
    }

    ambassador.withdrawals.push({
      accountName, bankName, accountNum, amount, status: 'pending'
    });
    await ambassador.save();

    return res.status(201).json({ success: true, message: 'Withdrawal request submitted!' });
  } catch (err) {
    console.error('[Ambassador] requestWithdrawal:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
//   CLAIM TASK REWARD
//   POST /api/ambassadors/claim-task
// ================================================

const claimTaskReward = async function (req, res) {
  try {
    var ambassador = await Ambassador.findOne({ user: req.user._id });
    if (!ambassador) {
      return res.status(404).json({ success: false, message: 'Ambassador not found.' });
    }

    var taskId = req.body.taskId;
    var reward = parseInt(req.body.reward) || 0;

    if (!taskId) {
      return res.status(400).json({ success: false, message: 'Task ID required.' });
    }
    if (ambassador.tasksDone.includes(taskId)) {
      return res.status(400).json({ success: false, message: 'Already claimed.' });
    }

    ambassador.tasksDone.push(taskId);
    ambassador.earnings += reward;
    await ambassador.save();

    return res.json({
      success:   true,
      message:   '₦' + reward + ' reward claimed!',
      earnings:  ambassador.earnings,
      tasksDone: ambassador.tasksDone
    });
  } catch (err) {
    console.error('[Ambassador] claimTaskReward:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  registerAmbassador,
  getMyProfile,
  getAllAmbassadors,
  requestWithdrawal,
  claimTaskReward
};