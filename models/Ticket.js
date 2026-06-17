'use strict';

var mongoose = require('mongoose');

var PurchaseSchema = new mongoose.Schema({
  buyer:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  buyerEmail: { type: String, required: true },
  buyerName:  { type: String, default: '' },
  ticketId:   { type: String, required: true }, // unique generated ID
  qrCode:     { type: String, default: '' },
  paymentRef: { type: String, default: '' },
  paidAt:     { type: Date,   default: Date.now }
});

var TicketSchema = new mongoose.Schema({
  event: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Event',
    required: true
  },
  name:        { type: String, required: true },
  description: { type: String, default: '' },
  price:       { type: Number, required: true, min: 0 },
  isFree:      { type: Boolean, default: false },
  quantity:    { type: Number, required: true, min: 1 },
  remaining:   { type: Number, required: true },
  purchases:   [PurchaseSchema]
}, { timestamps: true });

module.exports = mongoose.model('Ticket', TicketSchema);