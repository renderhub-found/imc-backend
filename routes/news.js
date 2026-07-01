'use strict';

const { uploadImage, uploadMedia } = require('../middleware/upload');
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/newsController');
const { protect, adminOnly } = require('../middleware/auth');

// =============================================
// STATIC ROUTES FIRST
// =============================================

// GET /api/news/admin/all
router.get('/admin/all', protect, adminOnly, ctrl.getAllNewsAdmin);

// POST /api/news/admin/create
router.post(
  '/admin/create',
  protect,
  adminOnly,
  uploadMedia.fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 }
  ]),
  ctrl.createNewsAdmin
);

// POST /api/news
router.post(
  '/',
  protect,
  uploadMedia.fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 }
  ]),
  ctrl.submitNews
);

// GET /api/news
router.get('/', ctrl.getAllNews);

// =============================================
// DYNAMIC ROUTES LAST
// =============================================

// PUT /api/news/:id/status
router.put('/:id/status', protect, adminOnly, ctrl.updateNewsStatus);

// DELETE /api/news/:id
router.delete('/:id', protect, adminOnly, ctrl.deleteNews);

// GET /api/news/:id
router.get('/:id', ctrl.getNewsById);

module.exports = router;