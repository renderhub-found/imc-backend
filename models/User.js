// ================================================
//   USER MODEL — models/User.js
// ================================================

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  firstName:  { type: String, required: true, trim: true },
  lastName:   { type: String, required: true, trim: true },
  email: {
    type:      String,
    required:  true,
    unique:    true,
    lowercase: true,
    trim:      true
  },
  password: {
  type:      String,
  minlength: 6,
  select:    false
  // Note: required removed — Google users have no password
},
  university:  { type: String, default: '' },
  role: {
    type:    String,
    enum:    ['student', 'vendor', 'ambassador', 'admin'],
    default: 'student'
  },
  isBlocked:   { type: Boolean, default: false },
  isVerified:  { type: Boolean, default: false },
  phone:       { type: String, default: '' },
  referredBy:  { type: String, default: '' }
}, { timestamps: true });

googleId: {
  type:    String,
  default: null,
  sparse:  true
},
profilePhoto: {
  type:    String,
  default: ''
},

// Hash password before save
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  if (!this.password) return;          // ← add this line
  var salt      = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
UserSchema.methods.comparePassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', UserSchema);