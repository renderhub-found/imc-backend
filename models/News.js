// ================================================
//   NEWS MODEL — models/News.js
// ================================================

const mongoose = require('mongoose');

const NewsSchema = new mongoose.Schema({
  author:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorName:  { type: String, default: 'IMC Editorial' },
  authorEmail: { type: String, default: '' },
  title:       { type: String, required: true },
  university:  { type: String, required: true },
  content:     { type: String, required: true },
  image:       { type: String, default: '' },
  video:       { type: String, default: '' },
  tags:        [String],
  status: {
    type:    String,
    enum:    ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  pinned: { type: Boolean, default: false },
  views:  { type: Number,  default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('News', NewsSchema);