'use strict';

var mongoose = require('mongoose');
var bcrypt   = require('bcryptjs');

var UserSchema = new mongoose.Schema({

  firstName: {
    type:     String,
    required: [true, 'First name is required'],
    trim:     true
  },

  lastName: {
    type:     String,
    required: [true, 'Last name is required'],
    trim:     true
  },

  email: {
    type:      String,
    required:  [true, 'Email is required'],
    unique:    true,
    lowercase: true,
    trim:      true
  },

  password: {
    type:      String,
    minlength: 6,
    select:    false
    // Not required — Google users have no password
  },

  university: {
    type:    String,
    default: ''
  },

  role: {
    type:    String,
    enum:    ['student', 'vendor', 'ambassador', 'admin'],
    default: 'student'
  },

  isBlocked: {
    type:    Boolean,
    default: false
  },

  isVerified: {
    type:    Boolean,
    default: false
  },

  phone: {
    type:    String,
    default: ''
  },

  referredBy: {
    type:    String,
    default: ''
  },

  // Google OAuth fields — all in one object, correct syntax
  googleId: {
    type:    String,
    default: null,
    sparse:  true
  },

  profilePhoto: {
    type:    String,
    default: ''
  },

  // Password reset
  passwordResetToken: {
    type:    String,
    default: null
  },

  passwordResetExpires: {
    type:    Date,
    default: null
  }

}, {
  timestamps: true
});

// ================================================
//   PRE-SAVE: Hash password
// ================================================

UserSchema.pre('save', async function () {
  // Skip if password not modified or is null/empty
  if (!this.isModified('password')) return;
  if (!this.password) return;

  var salt      = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// ================================================
//   METHOD: Compare password
// ================================================

UserSchema.methods.comparePassword = async function (entered) {
  if (!this.password) return false;
  return await bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', UserSchema);