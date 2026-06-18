'use strict';

// ================================================
//   AUTH CONTROLLER — controllers/authController.js
//   Using module.exports.fn = fn pattern
//   to guarantee exports are always defined
// ================================================

var jwt  = require('jsonwebtoken');
var User = require('../models/User');

console.log('=== authController.js LOADING ===');

// ================================================
//   HELPERS
// ================================================

function generateToken(userId) {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function buildUser(user) {
  return {
    id:         user._id,
    firstName:  user.firstName,
    lastName:   user.lastName,
    email:      user.email,
    university: user.university || '',
    role:       user.role       || 'student',
    phone:      user.phone      || '',
    createdAt:  user.createdAt
  };
}

// ================================================
//   REGISTER
// ================================================

async function register(req, res) {
  try {
    console.log('[Auth] register called');

    var firstName  = (req.body.firstName  || '').trim();
    var lastName   = (req.body.lastName   || '').trim();
    var email      = (req.body.email      || '').toLowerCase().trim();
    var password   = req.body.password    || '';
    var university = (req.body.university || '').trim();
    var phone      = (req.body.phone      || '').trim();
    var referredBy = (req.body.referredBy || '').trim();

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, email and password are required.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.'
      });
    }

    var existing = await User.findOne({ email: email });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'This email is already registered. Please login.'
      });
    }

    var user = new User({
      firstName:  firstName,
      lastName:   lastName,
      email:      email,
      password:   password,
      university: university,
      phone:      phone,
      referredBy: referredBy,
      role:       'student'
    });

    await user.save();

    // Send welcome email (non-blocking — do not await)
try {
  var emailService = require('../utils/emailService');
  emailService.sendWelcome(user.email, user.firstName).then(function (r) {
    console.log('[Auth] Welcome email:', r.success ? 'sent' : 'failed');
  });
} catch (e) {
  console.log('[Auth] Welcome email error:', e.message);
}

    console.log('[Auth] ✅ Registered:', user.email);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome to Inside My Campus.',
      token:   generateToken(user._id),
      user:    buildUser(user)
    });

  } catch (err) {
    console.error('[Auth] register error:', err.message);

    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'This email is already registered. Please login.'
      });
    }

    if (err.name === 'ValidationError') {
      var msgs = Object.values(err.errors).map(function (e) {
        return e.message;
      });
      return res.status(400).json({
        success: false,
        message: msgs[0]
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Registration failed: ' + err.message
    });
  }
}

// ================================================
//   LOGIN
// ================================================

async function login(req, res) {
  try {
    // Temporary diagnostic log
    console.log('[Auth] LOGIN BODY:', req.body);
    console.log('[Auth] Content-Type:', req.headers['content-type']);

    // Guard: body parser may not have run
    if (!req.body) {
      console.error('[Auth] req.body is undefined — express.json() not running');
      return res.status(400).json({
        success: false,
        message: 'Request body missing. Server configuration error.'
      });
    }

    var email    = (req.body.email    || '').toLowerCase().trim();
    var password = req.body.password  || '';

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    var user = await User.findOne({ email: email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect email or password.'
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Account suspended. Contact support.'
      });
    }

    var isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect email or password.'
      });
    }

    var token = require('jsonwebtoken').sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log('[Auth] ✅ Login success:', user.email, '| role:', user.role);

    return res.status(200).json({
      success: true,
      message: 'Login successful!',
      token:   token,
      user: {
        id:           user._id,
        firstName:    user.firstName,
        lastName:     user.lastName,
        email:        user.email,
        role:         user.role,
        university:   user.university   || '',
        profilePhoto: user.profilePhoto || ''
      }
    });

  } catch (err) {
    console.error('[Auth] login error:', err.message);
    console.error('[Auth] login stack:', err.stack);
    return res.status(500).json({
      success: false,
      message: 'Login failed: ' + err.message
    });
  }
}

// ================================================
//   GET ME
// ================================================

async function getMe(req, res) {
  try {
    var user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.json({ success: true, user: buildUser(user) });
  } catch (err) {
    console.error('[Auth] getMe error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   UPDATE PROFILE
// ================================================

async function updateProfile(req, res) {
  try {
    var updates = {};
    if (req.body.firstName)  updates.firstName  = req.body.firstName.trim();
    if (req.body.lastName)   updates.lastName   = req.body.lastName.trim();
    if (req.body.university) updates.university = req.body.university.trim();
    if (req.body.phone)      updates.phone      = req.body.phone.trim();

    var user = await User.findByIdAndUpdate(
      req.user._id, updates, { new: true }
    );

    return res.json({ success: true, message: 'Profile updated.', user: buildUser(user) });
  } catch (err) {
    console.error('[Auth] updateProfile error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   CHANGE PASSWORD
// ================================================

async function changePassword(req, res) {
  try {
    var currentPassword = req.body.currentPassword || '';
    var newPassword     = req.body.newPassword     || '';

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Provide current and new password.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters.'
      });
    }

    var user = await User.findById(req.user._id).select('+password');
    var ok   = await user.comparePassword(currentPassword);

    if (!ok) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect.'
      });
    }

    user.password = newPassword;
    await user.save();

    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('[Auth] changePassword error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   FORGOT PASSWORD
// ================================================

async function forgotPassword(req, res) {
  try {
    console.log('[Auth] forgotPassword called');
    console.log('[Auth] email:', req.body.email);

    var email = (req.body.email || '').toLowerCase().trim();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your email address.'
      });
    }

    var user = await User.findOne({ email: email });

    // Always return success to prevent email enumeration
    if (!user) {
      console.log('[Auth] forgotPassword: email not found:', email);
      return res.json({
        success: true,
        message: 'If this email exists, a reset link has been sent.'
      });
    }

    // Generate token
    var crypto     = require('crypto');
    var resetToken = crypto.randomBytes(32).toString('hex');
    var resetHash  = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.passwordResetToken   = resetHash;
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    var frontendUrl = process.env.FRONTEND_URL ||
      'https://resilient-ganache-be5b9c.netlify.app';
    var resetUrl = frontendUrl + '/reset-password.html?token=' + resetToken;

    console.log('[Auth] Reset token saved for:', email);
    console.log('[Auth] Reset URL:', resetUrl);

    // Send email using emailService
    var emailService = require('../utils/emailService');
    var emailResult  = await emailService.sendPasswordReset(
      user.email,
      user.firstName || 'User',
      resetUrl
    );

    console.log('[Auth] Email result:', JSON.stringify(emailResult));

    // In development, include the token for testing
    var responseData = {
      success: true,
      message: 'If this email exists, a reset link has been sent.'
    };

    if (process.env.NODE_ENV !== 'production') {
      responseData.devResetUrl   = resetUrl;
      responseData.emailSent     = emailResult.success;
      responseData.emailMessage  = emailResult.message;
    }

    return res.json(responseData);

  } catch (err) {
    console.error('[Auth] forgotPassword error:', err.message);
    console.error('[Auth] stack:', err.stack);
    return res.status(500).json({
      success: false,
      message: 'Could not process request: ' + err.message
    });
  }
}

// ================================================
//   RESET PASSWORD
// ================================================

async function resetPassword(req, res) {
  try {
    console.log('[Auth] resetPassword called');

    var token    = (req.body.token    || '').trim();
    var password = req.body.password  || '';

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Reset token is required.'
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.'
      });
    }

    var crypto    = require('crypto');
    var resetHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    var user = await User.findOne({
      passwordResetToken:   resetHash,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Reset link is invalid or expired. Please request a new one.'
      });
    }

    user.password             = password;
    user.passwordResetToken   = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    console.log('[Auth] ✅ Password reset for:', user.email);

    return res.json({
      success: true,
      message: 'Password reset! You can now login with your new password.'
    });

  } catch (err) {
    console.error('[Auth] resetPassword error:', err.message);
    return res.status(500).json({
      success:false,
      message: 'Could not reset password: ' + err.message
    });
  }
}

// ================================================
//   EXPORTS
//   Named explicitly — no shorthand
// ================================================

module.exports.register       = register;
module.exports.login          = login;
module.exports.getMe          = getMe;
module.exports.updateProfile  = updateProfile;
module.exports.changePassword = changePassword;
module.exports.forgotPassword = forgotPassword;
module.exports.resetPassword  = resetPassword;

console.log('=== authController.js LOADED ===');
console.log('register:',       typeof module.exports.register);
console.log('login:',          typeof module.exports.login);
console.log('getMe:',          typeof module.exports.getMe);
console.log('updateProfile:',  typeof module.exports.updateProfile);
console.log('changePassword:', typeof module.exports.changePassword);
console.log('forgotPassword:', typeof module.exports.forgotPassword);
console.log('resetPassword:',  typeof module.exports.resetPassword);