'use strict';

var jwt             = require('jsonwebtoken');
var User            = require('../models/User');

console.log('[GoogleAuth] Controller loaded');

async function googleAuth(req, res) {
  try {
    var credential = req.body.credential || req.body.token || '';

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Google credential is required.'
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        success: false,
        message: 'Google OAuth not configured on server.'
      });
    }

    // Verify with google-auth-library
    var OAuth2Client = require('google-auth-library').OAuth2Client;
    var client       = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
        message: 'Could not read Google account info.'
      });
    }

    var googleId  = payload.sub;
    var email     = (payload.email || '').toLowerCase().trim();
    var firstName = payload.given_name  || payload.name || 'User';
    var lastName  = payload.family_name || '';
    var picture   = payload.picture     || '';
    var verified  = payload.email_verified || false;

    console.log('[GoogleAuth] User:', email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Could not get email from Google account.'
      });
    }

    // Find by email or googleId
    var user = await User.findOne({
      $or: [{ email: email }, { googleId: googleId }]
    });

    if (user) {
      // Update Google fields if missing
      var changed = false;
      if (!user.googleId)           { user.googleId  = googleId;  changed = true; }
      if (!user.isVerified)         { user.isVerified = verified;  changed = true; }
      if (!user.profilePhoto && picture) {
        user.profilePhoto = picture;  changed = true;
      }
      if (changed) await user.save({ validateBeforeSave: false });

      if (user.isBlocked) {
        return res.status(403).json({
          success: false,
          message: 'Account suspended. Contact support.'
        });
      }

      console.log('[GoogleAuth] Existing user login:', email);

    } else {
      // Create new user
      console.log('[GoogleAuth] Creating new user:', email);

      user = new User({
        firstName:    firstName,
        lastName:     lastName,
        email:        email,
        googleId:     googleId,
        profilePhoto: picture,
        isVerified:   verified,
        role:         'student',
        password:     undefined
      });

      await user.save({ validateBeforeSave: false });

      // Welcome email non-blocking
      try {
        var emailSvc = require('../utils/emailService');
        emailSvc.sendWelcome(email, firstName).catch(function () {});
      } catch (e) {}
    }

    var token = require('jsonwebtoken').sign(
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
    return res.status(500).json({
      success: false,
      message: 'Google login failed: ' + err.message
    });
  }
}

module.exports = { googleAuth };