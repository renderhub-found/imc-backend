'use strict';

var mongoose = require('mongoose');

var TicketTypeSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  description: { type: String, default: '' },
  price:       { type: Number, required: true, min: 0 },
  quantity:    { type: Number, required: true, min: 1 },
  remaining:   { type: Number, required: true },
  isFree:      { type: Boolean, default: false }
});

var PurchaseSchema = new mongoose.Schema({
  buyer:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  buyerEmail: { type: String, required: true },
  buyerName:  { type: String, default: '' },
  ticketTypeId: { type: mongoose.Schema.Types.ObjectId },
  ticketTypeName: { type: String },
  ticketCode: { type: String, required: true },
  paymentRef: { type: String, default: '' },
  amountPaid: { type: Number, default: 0 },
  purchasedAt:{ type: Date, default: Date.now }
});

var WalletSchema = new mongoose.Schema({
  balance:     { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  withdrawals: [{
    amount:      { type: Number, required: true },
    bankName:    { type: String, required: true },
    accountName: { type: String, required: true },
    accountNum:  { type: String, required: true },
    status:      { type: String, enum: ['pending','approved','paid','rejected'], default: 'pending' },
    requestedAt: { type: Date, default: Date.now }
  }]
});

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
  eventType:      { type: String, enum: ['free','paid'], default: 'free' },
  status:         { type: String, enum: ['published','cancelled','completed'], default: 'published' },
  commission:     { type: Number, default: 10 }, // platform % cut
  ticketTypes:    [TicketTypeSchema],
  purchases:      [PurchaseSchema],
  wallet:         { type: WalletSchema, default: () => ({}) },
  views:          { type: Number, default: 0 }
}, { timestamps: true });

// Virtual: total tickets sold
EventSchema.virtual('ticketsSold').get(function () {
  return this.purchases.length;
});

// Virtual: gross revenue
EventSchema.virtual('grossRevenue').get(function () {
  return this.purchases.reduce(function (s, p) { return s + (p.amountPaid || 0); }, 0);
});

module.exports = mongoose.model('Event', EventSchema);