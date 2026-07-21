// ================================================
//   VENDOR MODEL - models/Vendor.js
// ================================================

const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  price:       { type: Number, required: true },
  description: { type: String, default: '' },
  // Legacy single-image field - kept so existing products still render.
  image:       { type: String, default: '' },
  // Up to 4 images per product. images[0] is used as the thumbnail
  // everywhere a single image is needed (homepage/marketplace cards).
  images:      { type: [String], default: [] },
  video:       { type: String, default: '' },
  category:    { type: String, default: '' },
  clicks:      { type: Number, default: 0 },
  orders:      { type: Number, default: 0 }
}, { timestamps: true });

const VendorSchema = new mongoose.Schema({
  user: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true
  },
  fullName:       { type: String, required: true },
  email:          { type: String, required: true },
  bizName:        { type: String, required: true },
  university:     { type: String, required: true },
  category:       { type: String, required: true },
  description:    { type: String, required: true },
  whatsApp:       { type: String, required: true },
  phone:          { type: String, default: '' },
  profilePicture: { type: String, default: '' },
  coverImage:     { type: String, default: '' },
  campusLocation: { type: String, default: '' },
  socialMedia: {
    instagram: { type: String, default: '' },
    facebook:  { type: String, default: '' },
    twitter:   { type: String, default: '' },
    tiktok:    { type: String, default: '' }
  },
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
  profileViews:  { type: Number, default: 0 },
  ratings: [{
    user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    value:     { type: Number, min: 1, max: 5 },
    createdAt: { type: Date, default: Date.now }
  }],
  avgRating:   { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Vendor', VendorSchema);