// ================================================
//   AMBASSADOR CONTROLLER
// ================================================

const Ambassador = require('../models/Ambassador');
const User       = require('../models/User');

// POST /api/ambassadors/register
const registerAmbassador = async function (req, res) {
  try {
    var existing = await Ambassador.findOne({ user: req.user._id });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Already registered as ambassador.',
        ambassador: existing
      });
    }

    var fullName   = (req.body.fullName   || '').trim();
    var university = (req.body.university || '').trim();
    var username   = (req.body.username   || '').toLowerCase().trim();
    var whatsApp   = (req.body.whatsApp   || '').trim();
    var social     = (req.body.social     || '').trim();
    var reason     = (req.body.reason     || '').trim();

    if (!fullName || !university || !username || !whatsApp) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields.'
      });
    }

    var taken = await Ambassador.findOne({ username: username });
    if (taken) {
      return res.status(400).json({
        success: false,
        message: 'Username already taken.'
      });
    }

    var refCode = 'AMB-' + username.toUpperCase();

    var ambassador = await Ambassador.create({
      user:       req.user._id,
      fullName:   fullName,
      email:      req.user.email,
      username:   username,
      university: university,
      whatsApp:   whatsApp,
      social:     social,
      reason:     reason,
      refCode:    refCode
    });

    await User.findByIdAndUpdate(req.user._id, { role: 'ambassador' });

    return res.status(201).json({
      success:    true,
      message:    'Ambassador account created!',
      ambassador: ambassador
    });
  } catch (err) {
    console.error('Register ambassador error:', err.message);
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Username already taken.'
      });
    }
    return res.status(500).json({
      success: false, message: err.message
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