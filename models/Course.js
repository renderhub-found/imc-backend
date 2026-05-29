// ================================================
//   COURSE MODEL — models/Course.js
// ================================================

const mongoose = require('mongoose');

const PurchaseSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userEmail:  { type: String, default: '' },
  amount:     { type: Number, default: 0 },
  paymentRef: { type: String, default: '' },
  date:       { type: Date, default: Date.now }
});

const CourseSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  category:    { type: String, required: true },
  instructor:  { type: String, default: 'IMC Academy' },
  description: { type: String, required: true },
  price:       { type: Number, required: true, default: 0 },
  isFree:      { type: Boolean, default: false },
  image:       { type: String, default: '' },
  fileUrl:     { type: String, required: true },
  duration:    { type: String, default: '2 hours' },
  lessons:     { type: Number, default: 10 },
  level: {
    type:    String,
    enum:    ['Beginner','Intermediate','Advanced','All Levels'],
    default: 'Beginner'
  },
  rating:    { type: Number, default: 4.5 },
  students:  { type: Number, default: 0 },
  tags:      [String],
  purchases: [PurchaseSchema]
}, { timestamps: true });

module.exports = mongoose.model('Course', CourseSchema);