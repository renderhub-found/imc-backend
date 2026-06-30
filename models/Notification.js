'use strict';

var mongoose = require('mongoose');

var NotificationSchema = new mongoose.Schema({
  recipient: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true
  },
  type: {
    type:    String,
    enum:    ['order_lead', 'vendor_approved', 'news_approved', 'withdrawal_update', 'general'],
    default: 'general'
  },
  title:     { type: String, required: true },
  message:   { type: String, required: true },
  link:      { type: String, default: '' },
  isRead:    { type: Boolean, default: false },
  icon:      { type: String, default: '🔔' }
}, { timestamps: true });


// Index for fast queries
NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);