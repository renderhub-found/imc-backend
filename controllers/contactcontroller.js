'use strict';

const ContactMessage = require('../models/ContactMessage');

// =============================================
// SUBMIT CONTACT MESSAGE — Public
// POST /api/contact
// =============================================

const submitMessage = async function (req, res) {
  try {
    var name    = (req.body.name    || '').trim();
    var email   = (req.body.email   || '').trim();
    var subject = (req.body.subject || '').trim();
    var message = (req.body.message || '').trim();

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required.'
      });
    }

    var msg = await ContactMessage.create({
      name, email, subject, message
    });

    return res.status(201).json({
      success: true,
      message: 'Message received! We will respond within 24 hours.',
      id:      msg._id
    });
  } catch (err) {
    console.error('Contact submit error:', err.message);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// =============================================
// GET ALL MESSAGES — Admin only
// GET /api/contact
// =============================================

const getAllMessages = async function (req, res) {
  try {
    var messages = await ContactMessage.find()
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success:  true,
      count:    messages.length,
      messages: messages
    });
  } catch (err) {
    return res.status(500).json({
      success: false, message: err.message
    });
  }
};

// =============================================
// MARK MESSAGE AS READ — Admin only
// PUT /api/contact/:id/read
// =============================================

const markAsRead = async function (req, res) {
  try {
    var msg = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    return res.status(200).json({
      success: true,
      message: 'Marked as read.',
      msg:     msg
    });
  } catch (err) {
    return res.status(500).json({
      success: false, message: err.message
    });
  }
};

module.exports = { submitMessage, getAllMessages, markAsRead };