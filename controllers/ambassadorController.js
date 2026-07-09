'use strict';

var Ambassador = require('../models/Ambassador');
var User       = require('../models/User');

console.log('[ambassadorController] Loaded');

async function registerAmbassador(req, res) {
  try {
    console.log('[Ambassador] registerAmbassador called');
    var userId = req.user._id;

    var existingByUser = await Ambassador.findOne({ user: userId });
    if (existingByUser) {
      return res.status(200).json({
        success:    true,
        message:    'You are already registered as an ambassador.',
        ambassador: existingByUser
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
        message: 'Missing required fields: ' + missing.join(', ')
      });
    }

    var usernameTaken = await Ambassador.findOne({ username: username });
    if (usernameTaken) {
      return res.status(400).json({
        success: false,
        message: 'Username "' + username + '" is already taken.'
      });
    }

    var refCode  = 'AMB-' + username.toUpperCase();
    var refTaken = await Ambassador.findOne({ refCode: refCode });
    if (refTaken) {
      return res.status(400).json({
        success: false,
        message: 'Username "' + username + '" is already taken.'
      });
    }

    var ambassador = await Ambassador.create({
      user:        userId,
      fullName:    fullName,
      email:       req.user.email,
      username:    username,
      university:  university,
      whatsApp:    whatsApp,
      social:      social  || '',
      reason:      reason  || '',
      refCode:     refCode,
      earnings:    0,
      referrals:   [],
      withdrawals: [],
      tasksDone:   [],
      status:      'active'
    });

    await User.findByIdAndUpdate(userId, { role: 'ambassador' });

    return res.status(201).json({
      success:    true,
      message:    'Ambassador account created! Your referral code: ' + refCode,
      ambassador: ambassador
    });

  } catch (err) {
    console.error('[Ambassador] registerAmbassador ERROR:', err.message);
    if (err.code === 11000) {
      var field = Object.keys(err.keyValue || {})[0] || 'field';
      return res.status(400).json({
        success: false,
        message: 'That ' + field + ' is already taken.'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Registration failed: ' + err.message
    });
  }
}

async function getMyProfile(req, res) {
  try {
    var ambassador = await Ambassador.findOne({ user: req.user._id });

    // Same fallback as vendor profile lookup — heal a missing/stale
    // user link using email, which is always reliable.
    if (!ambassador && req.user.email) {
      ambassador = await Ambassador.findOne({ email: req.user.email });
      if (ambassador) {
        console.warn('[Ambassador] Found by email fallback — healing user link:', ambassador._id);
        ambassador.user = req.user._id;
        await ambassador.save();
      }
    }

    if (!ambassador) {
      return res.json({ success: true, isAmbassador: false, ambassador: null });
    }
    return res.json({ success: true, isAmbassador: true, ambassador: ambassador });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getAllAmbassadors(req, res) {
  try {
    var ambassadors = await Ambassador.find({}).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, ambassadors: ambassadors });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getMyWithdrawals(req, res) {
  try {
    var ambassador = await Ambassador.findOne({ user: req.user._id });
    if (!ambassador) {
      return res.status(404).json({ success: false, message: 'Ambassador profile not found.' });
    }
    return res.status(200).json({
      success:     true,
      earnings:    ambassador.earnings || 0,
      withdrawals: ambassador.withdrawals || []
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function requestWithdrawal(req, res) {
  try {
    var ambassador = await Ambassador.findOne({ user: req.user._id });
    if (!ambassador) {
      return res.status(404).json({ success: false, message: 'Ambassador profile not found.' });
    }

    var accountName = (req.body.accountName || '').trim();
    var bankName    = (req.body.bankName    || '').trim();
    var accountNum  = (req.body.accountNum  || '').trim();
    var amount      = parseInt(req.body.amount) || 0;

    if (!accountName || !bankName || !accountNum) {
      return res.status(400).json({
        success: false,
        message: 'Account name, bank name and account number are required.'
      });
    }
    if (amount < 500) {
      return res.status(400).json({ success: false, message: 'Minimum withdrawal is ₦500.' });
    }
    if (amount > ambassador.earnings) {
      return res.status(400).json({
        success: false,
        message: 'Amount exceeds your available balance of ₦' + ambassador.earnings.toLocaleString()
      });
    }

    ambassador.withdrawals.push({
      accountName: accountName,
      bankName:    bankName,
      accountNum:  accountNum,
      amount:      amount,
      status:      'pending'
    });

    await ambassador.save();

    return res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted! We will process within 48 hours.'
    });

  } catch (err) {
    console.error('[Ambassador] requestWithdrawal error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function claimTaskReward(req, res) {
  try {
    var ambassador = await Ambassador.findOne({ user: req.user._id });
    if (!ambassador) {
      return res.status(404).json({ success: false, message: 'Ambassador not found.' });
    }

    var taskId = (req.body.taskId || '').trim();
    var reward = parseInt(req.body.reward) || 0;

    if (!taskId) {
      return res.status(400).json({ success: false, message: 'Task ID is required.' });
    }
    if (ambassador.tasksDone.includes(taskId)) {
      return res.status(400).json({ success: false, message: 'Task already claimed.' });
    }

    ambassador.tasksDone.push(taskId);
    ambassador.earnings += reward;
    await ambassador.save();

    return res.json({
      success:   true,
      message:   '₦' + reward.toLocaleString() + ' reward claimed!',
      earnings:  ambassador.earnings,
      tasksDone: ambassador.tasksDone
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

console.log('[ambassadorController] Exports ready:', ['registerAmbassador','getMyProfile','getAllAmbassadors','requestWithdrawal','claimTaskReward','getMyWithdrawals']);

module.exports = {
  registerAmbassador: registerAmbassador,
  getMyProfile:       getMyProfile,
  getAllAmbassadors:   getAllAmbassadors,
  requestWithdrawal:  requestWithdrawal,
  claimTaskReward:    claimTaskReward,
  getMyWithdrawals:   getMyWithdrawals
};