// ================================================
//   AMBASSADOR CONTROLLER
// ================================================

const Ambassador = require('../models/Ambassador');
const User       = require('../models/User');

// POST /api/ambassadors/register
const registerAmbassador = async function (req, res) {
  try {
    var userId = req.user._id;

    console.log('[Ambassador] Register called by:', req.user.email);
    console.log('[Ambassador] Body:', JSON.stringify(req.body));

    var existing = await Ambassador.findOne({ user: userId });
    if (existing) {
      console.log('[Ambassador] Already registered:', existing.username);
      return res.status(200).json({
        success:    true,
        message:    'Already registered as ambassador.',
        ambassador: existing
      });
    }

    var fullName   = (req.body.fullName   || '').trim();
    var university = (req.body.university || '').trim();
    var username   = (req.body.username   || '').toLowerCase().trim();
    var whatsApp   = (req.body.whatsApp   || '').trim();
    var social     = (req.body.social     || '').trim();
    var reason     = (req.body.reason     || '').trim();

    console.log('[Ambassador] fullName:', fullName);
    console.log('[Ambassador] username:', username);
    console.log('[Ambassador] university:', university);

    if (!fullName || !university || !username || !whatsApp) {
      var missing = [];
      if (!fullName)   missing.push('fullName');
      if (!university) missing.push('university');
      if (!username)   missing.push('username');
      if (!whatsApp)   missing.push('whatsApp');

      return res.status(400).json({
        success: false,
        message: 'Missing required fields: ' + missing.join(', ')
      });
    }

    // Check username taken
    var taken = await Ambassador.findOne({ username: username });
    if (taken) {
      return res.status(400).json({
        success: false,
        message: 'Username "' + username + '" is already taken.'
      });
    }

    var refCode = 'AMB-' + username.toUpperCase();

    console.log('[Ambassador] Creating ambassador document...');

    var ambassador = await Ambassador.create({
      user:       userId,
      fullName:   fullName,
      email:      req.user.email,
      username:   username,
      university: university,
      whatsApp:   whatsApp,
      social:     social,
      reason:     reason,
      refCode:    refCode,
      earnings:   0,
      referrals:  [],
      withdrawals: [],
      tasksDone:  []
    });

    console.log('[Ambassador] ✅ Created! ID:', ambassador._id, '| refCode:', refCode);

    await User.findByIdAndUpdate(userId, { role: 'ambassador' });
    console.log('[Ambassador] User role updated to ambassador');

    return res.status(201).json({
      success:    true,
      message:    'Ambassador account created! Your referral code: ' + refCode,
      ambassador: ambassador
    });

  } catch (err) {
    console.error('[Ambassador] Register error:', err.message);
    console.error('[Ambassador] Stack:', err.stack);

    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Username already taken. Please choose another.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Registration failed: ' + err.message
    });
  }
};

// GET /api/ambassadors/my-profile
const getMyProfile = async function (req, res) {
  try {
    var ambassador = await Ambassador.findOne({ user: req.user._id });
    if (!ambassador) {
      return res.status(200).json({
        success:      true,
        isAmbassador: false,
        ambassador:   null
      });
    }
    return res.status(200).json({
      success:      true,
      isAmbassador: true,
      ambassador:   ambassador
    });
  } catch (err) {
    console.error('Get ambassador profile error:', err.message);
    return res.status(500).json({
      success: false, message: err.message
    });
  }
};

// GET /api/ambassadors (admin)
const getAllAmbassadors = async function (req, res) {
  try {
    var ambassadors = await Ambassador.find().sort({ createdAt: -1 });
    return res.status(200).json({
      success:     true,
      count:       ambassadors.length,
      ambassadors: ambassadors
    });
  } catch (err) {
    return res.status(500).json({
      success: false, message: err.message
    });
  }
};

// POST /api/ambassadors/withdraw
const requestWithdrawal = async function (req, res) {
  try {
    var ambassador = await Ambassador.findOne({ user: req.user._id });
    if (!ambassador) {
      return res.status(404).json({
        success: false, message: 'Ambassador not found.'
      });
    }

    var accountName = (req.body.accountName || '').trim();
    var bankName    = (req.body.bankName    || '').trim();
    var accountNum  = (req.body.accountNum  || '').trim();
    var amount      = parseInt(req.body.amount) || 0;

    if (!accountName || !bankName || !accountNum || !amount) {
      return res.status(400).json({
        success: false,
        message: 'All bank details are required.'
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
        message: 'Amount exceeds available balance.'
      });
    }

    ambassador.withdrawals.push({
      accountName, bankName, accountNum, amount, status: 'pending'
    });
    await ambassador.save();

    return res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted!'
    });
  } catch (err) {
    console.error('Withdrawal error:', err.message);
    return res.status(500).json({
      success: false, message: err.message
    });
  }
};

// POST /api/ambassadors/claim-task
const claimTaskReward = async function (req, res) {
  try {
    var ambassador = await Ambassador.findOne({ user: req.user._id });
    if (!ambassador) {
      return res.status(404).json({
        success: false, message: 'Ambassador not found.'
      });
    }

    var taskId = req.body.taskId;
    var reward = parseInt(req.body.reward) || 0;

    if (!taskId) {
      return res.status(400).json({
        success: false, message: 'Task ID required.'
      });
    }

    if (ambassador.tasksDone.includes(taskId)) {
      return res.status(400).json({
        success: false, message: 'Already claimed.'
      });
    }

    ambassador.tasksDone.push(taskId);
    ambassador.earnings += reward;
    await ambassador.save();

    return res.status(200).json({
      success:   true,
      message:   '₦' + reward + ' reward claimed!',
      earnings:  ambassador.earnings,
      tasksDone: ambassador.tasksDone
    });
  } catch (err) {
    console.error('Claim task error:', err.message);
    return res.status(500).json({
      success: false, message: err.message
    });
  }
};

module.exports = {
  registerAmbassador,
  getMyProfile,
  getAllAmbassadors,
  requestWithdrawal,
  claimTaskReward
};