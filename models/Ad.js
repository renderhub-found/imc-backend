// ================================================
//   AD MODEL — models/Ad.js
// ================================================

const mongoose = require('mongoose');

const AdSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User'
    },

    ownerName:  { type: String, default: '' },
    ownerEmail: { type: String, required: true },

    title:       { type: String, required: true, trim: true },
    category:    { type: String, required: true },
    description: { type: String, required: true },
    location:    { type: String, required: true },
    contact:     { type: String, required: true },
    image:       { type: String, default: '' },

    duration: { type: Number, default: 7 },
    price:    { type: Number, required: true },

    status: {
      type:    String,
      enum:    ['pending', 'approved', 'rejected', 'expired'],
      default: 'pending'
    },

    paymentStatus: {
      type:    String,
      enum:    ['pending', 'paid'],
      default: 'pending'
    },

    paymentRef: { type: String, default: '' },

    expiryDate: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ad', AdSchema);