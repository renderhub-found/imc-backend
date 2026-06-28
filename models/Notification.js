'use strict';

var mongoose = require('mongoose');

var NotificationSchema = new mongoose.Schema({
  recipient: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true
  },
  type: {
    type: String,
    enum: ['new_vendor','new_product','new_event',
           'campus_announcement','admin_notification',
           'payment','general'],
    default: 'general'
  },
  title:     { type: String, required: true },
  message:   { type: String, required: true },
  link:      { type: String, default: '' },
  isRead:    { type: Boolean, default: false },
  icon:      { type: String, default: '🔔' }
}, { timestamps: true });

type: {
      type:    String,
      enum:    ['order_lead', 'vendor_approved', 'news_approved', 'withdrawal_update', 'general'],
      default: 'general'
    },
    relatedProductId: {
      type:    mongoose.Schema.Types.ObjectId,
      default: null
    },
    relatedProductName: {
      type:    String,
      default: ''
    },
    customerName: {
      type:    String,
      default: ''
    },

// Index for fast queries
NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);