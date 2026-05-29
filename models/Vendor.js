// ================================================
//   VENDOR MODEL — models/Vendor.js
// ================================================

const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  price:       { type: Number, required: true },
  description: { type: String, default: '' },
  image:       { type: String, default: '' },
  video:       { type: String, default: '' },
  category:    { type: String, default: '' }
}, { timestamps: true });

const VendorSchema = new mongoose.Schema({
  user: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true
  },
  fullName:      { type: String, required: true },
  email:         { type: String, required: true },
  bizName:       { type: String, required: true },
  university:    { type: String, required: true },
  category:      { type: String, required: true },
  description:   { type: String, required: true },
  whatsApp:      { type: String, required: true },
  status: {
    type:    String,
    enum:    ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  paymentStatus: {
    type:    String,
    enum:    ['pending', 'paid'],
    default: 'pending'
  },
  paymentRef:    { type: String, default: '' },
  refCode:       { type: String, default: '' },
  products:      [ProductSchema],
  profileViews:  { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Vendor', VendorSchema);