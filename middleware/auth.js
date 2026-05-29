'use strict';

const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// =============================================
//   PROTECT — verifies JWT Bearer token
// =============================================

const protect = async function (req, res, next) {
  try {
    var authHeader = req.headers['authorization'] || '';

    // Must start with "Bearer "
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Add header: Authorization: Bearer <token>'
      });
    }

    // Extract token after "Bearer "
    var token = authHeader.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token is empty.'
      });
    }

    // Verify the token
    var decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please login again.'
        });
      }
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Please login again.'
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Token error: ' + jwtError.message
      });
    }

    // Find user by decoded ID
    var user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token valid but user not found.'
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Account is blocked.'
      });
    }

    // Attach user to request
    req.user = user;
    next();

  } catch (err) {
    console.error('Protect error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Auth error: ' + err.message
    });
  }
};

// =============================================
//   ADMIN ONLY
// =============================================

const adminOnly = function (req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated.'
    });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access only. Your role: ' + req.user.role
    });
  }
  next();
};

// =============================================
//   VENDOR ONLY
// =============================================

const vendorOnly = function (req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated.'
    });
  }
  if (req.user.role !== 'vendor' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Vendor access only.'
    });
  }
  next();
};

module.exports = { protect, adminOnly, vendorOnly };