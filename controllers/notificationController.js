'use strict';

var Notification = require('../models/Notification');

// GET /api/notifications
async function getNotifications(req, res) {
  try {
    var page  = parseInt(req.query.page)  || 1;
    var limit = parseInt(req.query.limit) || 20;
    var skip  = (page - 1) * limit;

    var notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    var unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead:    false
    });

    return res.json({
      success:     true,
      unreadCount: unreadCount,
      count:       notifications.length,
      notifications: notifications
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/notifications/:id/read
async function markAsRead(req, res) {
  try {
    var n = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true },
      { new: true }
    );
    if (!n) return res.status(404).json({ success: false, message: 'Not found.' });
    return res.json({ success: true, notification: n });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/notifications/read-all
async function markAllRead(req, res) {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true }
    );
    return res.json({ success: true, message: 'All marked as read.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/notifications/unread-count
async function getUnreadCount(req, res) {
  try {
    var count = await Notification.countDocuments({
      recipient: req.user._id,
      isRead:    false
    });
    return res.json({ success: true, count: count });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Helper: Create notification (used by other controllers)
async function createNotification(recipientId, type, title, message, link, icon) {
  try {
    await Notification.create({
      recipient: recipientId,
      type:      type    || 'general',
      title:     title,
      message:   message,
      link:      link    || '',
      icon:      icon    || '🔔'
    });
  } catch (err) {
    console.error('[Notification] Create error:', err.message);
  }
}

module.exports = {
  getNotifications,
  markAsRead,
  markAllRead,
  getUnreadCount,
  createNotification
};