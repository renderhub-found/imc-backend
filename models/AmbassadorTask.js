// ================================================
//   AMBASSADOR TASK MODEL — models/AmbassadorTask.js
// ================================================

const mongoose = require('mongoose');

const AmbassadorTaskSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  rewardAmount: { type: Number, required: true, min: 0 },
  rules:       { type: String, default: '' },
  verificationMethod: {
    type: String,
    enum: ['manual', 'link_proof', 'auto_referral'],
    default: 'manual'
    // manual        — ambassador submits proof text/link, admin reviews & approves
    // link_proof    — ambassador must submit a URL as proof (e.g. shared post), admin reviews
    // auto_referral — reward tied to referral count already tracked on Ambassador.referrals
  },
  taskUrl: { type: String, default: '' },
  status: {
    type:    String,
    enum:    ['active', 'paused'],
    default: 'active'
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('AmbassadorTask', AmbassadorTaskSchema);