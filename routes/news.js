'use strict';

const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/newsController');
const { protect, adminOnly } = require('../middleware/auth');

// =============================================
// STATIC ROUTES FIRST
// =============================================

// GET  /api/news/admin/all  (admin only)
router.get('/admin/all', protect, adminOnly, ctrl.getAllNewsAdmin);

// POST /api/news
router.post('/', protect, ctrl.submitNews);

// GET  /api/news
router.get('/', ctrl.getAllNews);

// =============================================
// DYNAMIC ROUTES LAST
// =============================================

// PUT    /api/news/:id/status  (admin only)
router.put('/:id/status', protect, adminOnly, ctrl.updateNewsStatus);

// DELETE /api/news/:id  (admin only)
router.delete('/:id', protect, adminOnly, ctrl.deleteNews);

// GET    /api/news/:id
router.get('/:id', ctrl.getNewsById);

module.exports = router;