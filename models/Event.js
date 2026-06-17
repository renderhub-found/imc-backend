'use strict';

var mongoose = require('mongoose');

var EventSchema = new mongoose.Schema({
  organizer: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true
  },
  organizerName:  { type: String, required: true },
  organizerEmail: { type: String, required: true },
  title:          { type: String, required: true, trim: true },
  description:    { type: String, required: true },
  university:     { type: String, required: true },
  location:       { type: String, required: true },
  eventDate:      { type: Date,   required: true },
  eventTime:      { type: String, required: true },
  coverImage:     { type: String, default: '' },
  contactInfo:    { type: String, default: '' },
  status: {
    type:    String,
    enum:    ['draft', 'published', 'cancelled'],
    default: 'published'
  },
  views:        { type: Number, default: 0 },
  ticketTypes:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }]
}, { timestamps: true });

module.exports = mongoose.model('Event', EventSchema);