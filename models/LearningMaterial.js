// ================================================
//   LEARNING MATERIAL MODEL — models/LearningMaterial.js
//   Unified model for the Learning Hub: courses, e-books,
//   past questions, lecture notes, study materials, and exam
//   prep all live here under one `materialType`, sharing one
//   search/filter/purchase/download pipeline. This mirrors how
//   Event/Vendor already unify their own sub-concepts, and
//   avoids fragmenting into one model per content type.
// ================================================

const mongoose = require('mongoose');

const PurchaseSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userEmail:  { type: String, default: '' },
  userName:   { type: String, default: '' },
  amount:     { type: Number, default: 0 },
  paymentRef: { type: String, default: '' },
  date:       { type: Date, default: Date.now }
});

const DownloadLogSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userEmail: { type: String, default: '' },
  date:      { type: Date, default: Date.now }
});

const FileSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  url:  { type: String, default: '' }
}, { _id: false });

const LearningMaterialSchema = new mongoose.Schema({
  materialType: {
    type: String,
    enum: [
      'course', 'ebook', 'past_question',
      'lecture_note', 'study_material', 'exam_prep'
    ],
    required: true
  },

  title:       { type: String, required: true },
  description: { type: String, required: true },

  // ---- Academic filters (search/filter surface from the brief) ----
  university: { type: String, default: '' },
  faculty:    { type: String, default: '' },
  department: { type: String, default: '' },
  level:      { type: String, default: '' },   // '100', '200', ... or 'All Levels'
  courseCode: { type: String, default: '' },
  semester: {
    type: String,
    enum: ['', 'First', 'Second', 'Both'],
    default: ''
  },

  // ---- Files ----
  coverImage: { type: String, default: '' },
  fileUrl:    { type: String, default: '' },  // primary file
  files:      [FileSchema],                    // future-ready: multi-file materials

  // ---- Course-specific (kept for the online-courses -> Learning Hub migration) ----
  instructor: { type: String, default: '' },
  duration:   { type: String, default: '' },
  lessons:    { type: Number, default: 0 },

  // ---- Pricing ----
  isFree: { type: Boolean, default: true },
  pricingMode: {
    type:    String,
    enum:    ['fixed', 'auto_per_page'],
    default: 'fixed'
  },
  pricePerPage: { type: Number, default: 0 },  // used when pricingMode = auto_per_page
  pageCount:    { type: Number, default: 0 },
  price:        { type: Number, default: 0 },  // final, authoritative price — always
                                                  // read this at purchase time, never
                                                  // re-derive it, so a later pricePerPage
                                                  // change can't retroactively change what
                                                  // an already-listed item costs

  // ---- Ownership & moderation ----
  uploadedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploaderName:  { type: String, default: '' },
  uploaderEmail: { type: String, default: '' },
  uploaderRole: {
    type:    String,
    enum:    ['admin', 'student'],
    default: 'student'
  },
  status: {
    type:    String,
    enum:    ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: { type: String, default: '' },

  // ---- Engagement ----
  downloadCount: { type: Number, default: 0 },
  downloads:     [DownloadLogSchema],  // free-download log
  purchases:     [PurchaseSchema],      // paid-purchase log
  rating:        { type: Number, default: 0 },
  tags:          [String],
  featured:      { type: Boolean, default: false }
}, { timestamps: true });

LearningMaterialSchema.index({ title: 'text', description: 'text', courseCode: 'text', tags: 'text' });

module.exports = mongoose.model('LearningMaterial', LearningMaterialSchema);