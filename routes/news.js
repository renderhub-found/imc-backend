'use strict';
const { uploadMedia } = require('../middleware/upload');
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

// POST /api/news/admin/create — admin creates & publishes news with files
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

// =============================================
// DYNAMIC ROUTES LAST
// =============================================

// PUT    /api/news/:id/status  (admin only)
router.put('/:id/status', protect, adminOnly, ctrl.updateNewsStatus);

// DELETE /api/news/:id  (admin only)
router.delete('/:id', protect, adminOnly, ctrl.deleteNews);

// GET    /api/news/:id
router.get('/:id', ctrl.getNewsById);

var uploadMw = require('../middleware/upload');

// POST /api/news/upload-image
router.post('/upload-image', protect, uploadMw.single('image', 'imc/news'),
  function (req, res) {
    if (!req.cloudinaryUrl) {
      return res.status(400).json({ success: false, message: 'No image uploaded.' });
    }
    return res.json({
      success: true, imageUrl: req.cloudinaryUrl, publicId: req.cloudinaryPublicId
    });
  }
);

module.exports = router;