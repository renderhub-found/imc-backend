'use strict';

const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/contactController');
const { protect, adminOnly } = require('../middleware/auth');

// POST — submit contact message (public)
router.post('/', ctrl.submitMessage);

// GET — all messages (admin only)
router.get('/', protect, adminOnly, ctrl.getAllMessages);

// PUT — mark as read (admin only)
router.put('/:id/read', protect, adminOnly, ctrl.markAsRead);

module.exports = router;