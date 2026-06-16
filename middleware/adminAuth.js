'use strict';

var jwt      = require('jsonwebtoken');
var User     = require('../models/User');
var AdminLog = require('../models/AdminLog');

// ================================================
//   ADMIN PROTECT MIDDLEWARE
// ================================================

var adminProtect = async function (req, res, next) {
  try {
    var authHeader = req.headers['authorization'] || '';

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      await logUnauthorized(req, null, 'No token provided');
      return res.status(401).json({
        success: false,
        message: 'Admin access denied: no token provided.'
      });
    }

    var token = authHeader.substring(7).trim();

    var decoded;
    try {
      decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      await logUnauthorized(req, null, 'Invalid token: ' + jwtErr.message);
      return res.status(401).json({
        success: false,
        message: 'Admin access denied: invalid token.'
      });
    }

    var user = await User.findById(decoded.id).select('-password');

    if (!user) {
      await logUnauthorized(req, decoded.id, 'User not found');
      return res.status(401).json({
        success: false,
        message: 'Admin access denied: user not found.'
      });
    }

    if (user.isBlocked) {
      await logUnauthorized(req, user._id, 'Account blocked');
      return res.status(403).json({
        success: false,
        message: 'Admin access denied: account suspended.'
      });
    }

    if (user.role !== 'admin') {
      await logUnauthorized(req, user._id,
        'Role check failed: role is ' + user.role);
      console.warn('[AdminAuth] Unauthorized admin attempt:',
        user.email, '| role:', user.role, '| IP:', getIP(req));
      return res.status(403).json({
        success: false,
        message: 'Admin access denied: insufficient permissions.'
      });
    }

    req.user  = user;
    req.admin = user;
    next();

  } catch (err) {
    console.error('[AdminAuth] Middleware error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Authentication error.'
    });
  }
};

// ================================================
//   AUDIT LOGGER
// ================================================

var auditLog = async function (req, action, target, targetId, details, status) {
  try {
    if (!req.admin) return;
    await AdminLog.create({
      admin:      req.admin._id,
      adminEmail: req.admin.email,
      action:     action,
      target:     target    || '',
      targetId:   targetId  || '',
      details:    details   || '',
      ip:         getIP(req),
      userAgent:  req.headers['user-agent'] || '',
      status:     status    || 'success'
    });
  } catch (err) {
    console.error('[AdminAuth] Audit log error:', err.message);
  }
};

async function logUnauthorized(req, userId, reason) {
  try {
    await AdminLog.create({
      admin:      userId || new require('mongoose').Types.ObjectId(),
      adminEmail: 'unauthorized',
      action:     'UNAUTHORIZED_ACCESS',
      target:     req.originalUrl,
      targetId:   '',
      details:    reason,
      ip:         getIP(req),
      userAgent:  req.headers['user-agent'] || '',
      status:     'failed'
    });
  } catch (e) {}
}

function getIP(req) {
  return req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress        ||
    req.ip || '';
}

module.exports = { adminProtect, auditLog };