// ================================================
//   AMBASSADOR MODEL — models/Ambassador.js
// ================================================

const mongoose = require('mongoose');

const ReferralSchema = new mongoose.Schema({
  vendorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  vendorName: { type: String, default: '' },
  commission: { type: Number, default: 500 },
  date:       { type: Date, default: Date.now }
});

const WithdrawalSchema = new mongoose.Schema({
  accountName: { type: String, required: true },
  bankName:    { type: String, required: true },
  accountNum:  { type: String, required: true },
  amount:      { type: Number, required: true },
  status: {
    type:    String,
    enum:    ['pending', 'approved', 'paid', 'rejected'],
    default: 'pending'
  },
  date: { type: Date, default: Date.now }
});

const AmbassadorSchema = new mongoose.Schema({
  user: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true
  },
  fullName:    { type: String, required: true },
  email:       { type: String, required: true },
  username:    { type: String, required: true, unique: true },
  university:  { type: String, required: true },
  whatsApp:    { type: String, required: true },
  social:      { type: String, default: '' },
  reason:      { type: String, default: '' },
  refCode:     { type: String, unique: true },
  referrals:   [ReferralSchema],
  withdrawals: [WithdrawalSchema],
  earnings:    { type: Number, default: 0 },
  tasksDone:   [String],
  status: {
    type:    String,
    enum:    ['active', 'suspended'],
    default: 'active'
  }
}, { timestamps: true });

module.exports = mongoose.model('Ambassador', AmbassadorSchema);