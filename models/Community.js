'use strict';

const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason:     { type: String, default: '' },
  date:       { type: Date, default: Date.now }
}, { _id: false });

const CommunitySchema = new mongoose.Schema({
  // future-ready: default 'community' now, can add roommate_finder,
  // study_group, mentorship, etc. later without a schema redesign
  type: { type: String, default: 'community' },

  university: { type: String, required: true },
  faculty:    { type: String, default: '' },
  department: { type: String, default: '' },

  communityName: { type: String, required: true },
  platform: {
    type: String,
    enum: ['WhatsApp', 'Telegram', 'Discord'],
    required: true
  },
  groupLink:   { type: String, required: true },
  description: { type: String, default: '' },

  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  creatorName:  { type: String, default: '' },
  creatorEmail: { type: String, default: '' },

  memberCount: { type: Number, default: 0 },

  status: {
    type:    String,
    enum:    ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: { type: String, default: '' },
  verified:  { type: Boolean, default: false },
  featured:  { type: Boolean, default: false },

  reports: [ReportSchema],

  // future-ready free-form bucket for type-specific fields
  // (e.g. roommate budget range, study group subject) without
  // needing to alter the schema when those features are built
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

CommunitySchema.index({ university: 1, faculty: 1, department: 1 });

module.exports = mongoose.model('Community', CommunitySchema);