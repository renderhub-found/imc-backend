'use strict';

var { OAuth2Client } = require('google-auth-library');
var jwt              = require('jsonwebtoken');
var User             = require('../models/User');

var client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

console.log('[GoogleAuth] Controller loaded');
console.log('[GoogleAuth] GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET ✅' : 'NOT SET ❌');

// ================================================
//   GOOGLE LOGIN / REGISTER
//   POST /api/auth/google
// ================================================

async function googleAuth(req, res) {
  try {
    var credential = req.body.credential || req.body.token || '';

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Google credential token is required.'
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        success: false,
        message: 'Google OAuth not configured on server.'
      });
    }

    console.log('[GoogleAuth] Verifying Google token...');

    // Verify the token with Google
    var ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken:  credential,
        audience: process.env.GOOGLE_CLIENT_ID
      });
    } catch (verifyErr) {
      console.error('[GoogleAuth] Token verify failed:', verifyErr.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid Google token. Please try again.'
      });
    }

    var payload = ticket.getPayload();

    if (!payload) {
      return res.status(401).json({
        success: false,
        message: 'Could not read Google account information.'
      });
    }

    var googleId  = payload.sub;
    var email     = (payload.email || '').toLowerCase().trim();
    var firstName = payload.given_name  || payload.name || 'User';
    var lastName  = payload.family_name || '';
    var picture   = payload.picture     || '';
    var verified  = payload.email_verified || false;

    console.log('[GoogleAuth] Google user:', email, '| verified:', verified);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Could not get email from Google account.'
      });
    }

    // Find existing user by email OR googleId
    var user = await User.findOne({
      $or: [
        { email:    email    },
        { googleId: googleId }
      ]
    });

    if (user) {
      // Existing user — update Google info if needed
      var updated = false;

      if (!user.googleId) {
        user.googleId  = googleId;
        updated = true;
      }
      if (!user.isVerified) {
        user.isVerified = verified;
        updated = true;
      }
      if (!user.profilePhoto && picture) {
        user.profilePhoto = picture;
        updated = true;
      }

      if (updated) {
        await user.save();
        console.log('[GoogleAuth] Existing user updated:', email);
      }

      if (user.isBlocked) {
        return res.status(403).json({
          success: false,
          message: 'Account is suspended. Contact support.'
        });
      }

      console.log('[GoogleAuth] ✅ Existing user logged in:', email);

    } else {
      // New user — create account
      console.log('[GoogleAuth] Creating new user from Google:', email);

      user = new User({
        firstName:    firstName,
        lastName:     lastName,
        email:        email,
        googleId:     googleId,
        profilePhoto: picture,
        isVerified:   verified,
        role:         'student',
        password:     null  // no password for Google users
      });

      // Skip password validation for Google users
      await user.save({ validateBeforeSave: false });

      console.log('[GoogleAuth] ✅ New user created:', email);

      // Send welcome email non-blocking
      try {
        var emailService = require('../utils/emailService');
        emailService.sendWelcome(email, firstName).catch(function () {});
      } catch (e) {}
    }

    // Generate JWT
    var token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Google login successful!',
      token:   token,
      user: {
        id:           user._id,
        firstName:    user.firstName,
        lastName:     user.lastName,
        email:        user.email,
        role:         user.role,
        university:   user.university   || '',
        profilePhoto: user.profilePhoto || '',
        isVerified:   user.isVerified
      }
    });

  } catch (err) {
    console.error('[GoogleAuth] Error:', err.message);
    console.error('[GoogleAuth] Stack:', err.stack);
    return res.status(500).json({
      success: false,
      message: 'Google login failed: ' + err.message
    });
  }
}

module.exports = { googleAuth };