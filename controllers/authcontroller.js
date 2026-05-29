// ================================================
//   AUTH CONTROLLER
// ================================================

const jwt  = require('jsonwebtoken');
const User = require('../models/User');

function generateToken(id) {
  return jwt.sign(
    { id: id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function userResponse(user) {
  return {
    id:         user._id,
    firstName:  user.firstName,
    lastName:   user.lastName,
    email:      user.email,
    university: user.university,
    role:       user.role,
    phone:      user.phone || '',
    createdAt:  user.createdAt
  };
}

// POST /api/auth/register
const register = async function (req, res) {
  try {
    var firstName  = (req.body.firstName  || '').trim();
    var lastName   = (req.body.lastName   || '').trim();
    var email      = (req.body.email      || '').toLowerCase().trim();
    var password   = (req.body.password   || '');
    var university = (req.body.university || '').trim();

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.'
      });
    }

    var exists = await User.findOne({ email: email });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered. Please login.'
      });
    }

    var user = new User({
      firstName:  firstName,
      lastName:   lastName,
      email:      email,
      password:   password,
      university: university
    });

    await user.save();

    var token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token:   token,
      user:    userResponse(user)
    });

  } catch (err) {
    console.error('Register error:', err.message);
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered.'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Registration failed: ' + err.message
    });
  }
};

// POST /api/auth/login
const login = async function (req, res) {
  try {
    var email    = (req.body.email    || '').toLowerCase().trim();
    var password = (req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please enter email and password.'
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
        message: 'Account is blocked. Contact support.'
      });
    }

    var isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect email or password.'
      });
    }

    var token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Login successful!',
      token:   token,
      user:    userResponse(user)
    });

  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Login failed: ' + err.message
    });
  }
};

// GET /api/auth/me
const getMe = async function (req, res) {
  try {
    var user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false, message: 'User not found.'
      });
    }
    return res.status(200).json({
      success: true,
      user:    userResponse(user)
    });
  } catch (err) {
    console.error('GetMe error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Could not get profile: ' + err.message
    });
  }
};

// PUT /api/auth/update-profile
const updateProfile = async function (req, res) {
  try {
    var updates = {};
    if (req.body.firstName)  updates.firstName  = req.body.firstName.trim();
    if (req.body.lastName)   updates.lastName   = req.body.lastName.trim();
    if (req.body.university) updates.university = req.body.university.trim();
    if (req.body.phone)      updates.phone      = req.body.phone.trim();

    var user = await User.findByIdAndUpdate(
      req.user._id, updates, { new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Profile updated.',
      user:    userResponse(user)
    });
  } catch (err) {
    console.error('Update profile error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Update failed: ' + err.message
    });
  }
};

// PUT /api/auth/change-password
const changePassword = async function (req, res) {
  try {
    var currentPassword = req.body.currentPassword || '';
    var newPassword     = req.body.newPassword     || '';

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password.'
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

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (err) {
    console.error('Change password error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Password change failed: ' + err.message
    });
  }
};

module.exports = { register, login, getMe, updateProfile, changePassword };