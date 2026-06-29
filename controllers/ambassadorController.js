'use strict';

var Ambassador = require('../models/Ambassador');
var User       = require('../models/User');

console.log('[ambassadorController] Loaded');

// ================================================
//   REGISTER AMBASSADOR
//   POST /api/ambassadors/register
// ================================================

async function registerAmbassador(req, res) {
  try {
    console.log('[Ambassador] registerAmbassador called');
    console.log('[Ambassador] user:', req.user.email, '| id:', req.user._id);
    console.log('[Ambassador] body:', JSON.stringify(req.body));

    var userId = req.user._id;

    // Check if THIS USER already has an ambassador record
    var existingByUser = await Ambassador.findOne({ user: userId });
    if (existingByUser) {
      console.log('[Ambassador] Already registered as ambassador:', existingByUser.username);
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

    // Validate required fields
    var missing = [];
    if (!fullName)   missing.push('fullName');
    if (!university) missing.push('university');
    if (!username)   missing.push('username');
    if (!whatsApp)   missing.push('whatsApp');

    if (missing.length > 0) {
      console.log('[Ambassador] Missing fields:', missing);
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: ' + missing.join(', ')
      });
    }

    // Check username is unique
    var usernameTaken = await Ambassador.findOne({ username: username });
    if (usernameTaken) {
      console.log('[Ambassador] Username taken:', username);
      return res.status(400).json({
        success: false,
        message: 'Username "' + username + '" is already taken. Please choose another.'
      });
    }

    var refCode = 'AMB-' + username.toUpperCase();

    // Check refCode unique
    var refTaken = await Ambassador.findOne({ refCode: refCode });
    if (refTaken) {
      console.log('[Ambassador] RefCode taken:', refCode);
      return res.status(400).json({
        success: false,
        message: 'Username "' + username + '" is already taken. Please choose another.'
      });
    }

    console.log('[Ambassador] Creating document...');
    console.log('[Ambassador] refCode will be:', refCode);

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

    console.log('[Ambassador] ✅ CREATED! ID:', ambassador._id);
    console.log('[Ambassador] refCode:', ambassador.refCode);

    // Update user role
    await User.findByIdAndUpdate(userId, { role: 'ambassador' });
    console.log('[Ambassador] User role → ambassador');

    return res.status(201).json({
      success:    true,
      message:    'Ambassador account created! Your referral code: ' + refCode,
      ambassador: ambassador
    });

  } catch (err) {
    console.error('[Ambassador] registerAmbassador ERROR:', err.message);
    console.error('[Ambassador] stack:', err.stack);

    if (err.code === 11000) {
      var field = Object.keys(err.keyValue || {})[0] || 'field';
      return res.status(400).json({
        success: false,
        message: 'That ' + field + ' is already taken. Please choose another.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Registration failed: ' + err.message
    });
  }
}

// ================================================
//   GET MY PROFILE
//   GET /api/ambassadors/my-profile
// ================================================

async function getMyProfile(req, res) {
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
    console.error('[Ambassador] getMyProfile error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   GET ALL AMBASSADORS — Admin
//   GET /api/ambassadors
// ================================================
const getMyWithdrawals = async function (req, res) {
  try {
    var ambassador = await Ambassador.findOne({ user: req.user._id });
    if (!ambassador) {
      return res.status(404).json({ success: false, message: 'Ambassador profile not found.' });
    }
    return res.status(200).json({
      success: true,
      earnings: ambassador.earnings || 0,
      withdrawals: ambassador.withdrawals || []
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
//   REQUEST WITHDRAWAL
//   POST /api/ambassadors/withdraw
// ================================================

async function requestWithdrawal(req, res) {
  try {
    console.log('[Ambassador] requestWithdrawal — user:', req.user.email);

    var ambassador = await Ambassador.findOne({ user: req.user._id });
    if (!ambassador) {
      return res.status(404).json({
        success: false,
        message: 'Ambassador profile not found.'
      });
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
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal is ₦500.'
      });
    }
    if (amount > ambassador.earnings) {
      return res.status(400).json({
        success: false,
        message: 'Amount exceeds your available balance of ₦' +
                 ambassador.earnings.toLocaleString()
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

    // Send ambassador welcome email (non-blocking)
try {
  var emailService = require('../utils/emailService');
  emailService.sendAmbassadorConfirmation(
    req.user.email,
    fullName,
    refCode
  ).then(function (r) {
    console.log('[Ambassador] Confirmation email:', r.success ? 'sent' : 'failed');
  });
} catch (e) {
  console.log('[Ambassador] Email error:', e.message);
}

    console.log('[Ambassador] ✅ Withdrawal request saved');

    return res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted! We will process within 48 hours.'
    });

  } catch (err) {
    console.error('[Ambassador] requestWithdrawal error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   CLAIM TASK REWARD
//   POST /api/ambassadors/claim-task
// ================================================

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

    console.log('[Ambassador] Task claimed:', taskId, '| reward: ₦' + reward);

    return res.json({
      success:   true,
      message:   '₦' + reward.toLocaleString() + ' reward claimed!',
      earnings:  ambassador.earnings,
      tasksDone: ambassador.tasksDone
    });

  } catch (err) {
    console.error('[Ambassador] claimTaskReward error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  registerAmbassador: registerAmbassador,
  getMyProfile:       getMyProfile,
  getAllAmbassadors:   getAllAmbassadors,
  requestWithdrawal:  requestWithdrawal,
  claimTaskReward:    claimTaskReward
};

console.log('[ambassadorController] Exports ready:', Object.keys(module.exports));