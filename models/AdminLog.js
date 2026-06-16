'use strict';

var mongoose = require('mongoose');

var AdminLogSchema = new mongoose.Schema({
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User',
    required: true
  },
  adminEmail:  { type: String, required: true },
  action:      { type: String, required: true },
  target:      { type: String, default: '' },
  targetId:    { type: String, default: '' },
  details:     { type: String, default: '' },
  ip:          { type: String, default: '' },
  userAgent:   { type: String, default: '' },
  status:      { type: String, enum: ['success','failed'], default: 'success' }
}, { timestamps: true });

module.exports = mongoose.model('AdminLog', AdminLogSchema);