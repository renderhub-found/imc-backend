'use strict';

var mongoose = require('mongoose');

// One document per issued ticket — this is what eventController.js's
// issueTicketForPurchase() actually creates on every free/paid purchase,
// and what verifyTicket() looks up during door check-in via ticketCode.
// (The previous schema here modeled a completely different "ticket type
// with embedded purchases" shape that nothing in the codebase used —
// every Ticket.create() call was failing Mongoose validation because
// required fields like name/price/quantity/remaining were never passed,
// which is the exact "Ticket validation failed" error from Priority 2.)
var TicketSchema = new mongoose.Schema({
  event: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Event',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User'
  },
  ticketTypeId: {
    type: mongoose.Schema.Types.ObjectId
  },
  buyerName:  { type: String, default: '' },
  buyerEmail: { type: String, required: true },
  ticketCode: {
    type:     String,
    required: true,
    unique:   true,
    uppercase: true
  },
  qrData:     { type: String, default: '' },
  status: {
    type:    String,
    enum:    ['valid', 'used'],
    default: 'valid'
  },
  checkedInAt: { type: Date },
  checkedInBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User'
  },
  paymentRef: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Ticket', TicketSchema);