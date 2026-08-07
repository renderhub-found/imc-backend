'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/learningController');
const { protect, adminOnly } = require('../middleware/auth');
const { uploadMaterial } = require('../middleware/upload');

var uploadFields = uploadMaterial.fields([
  { name: 'file',       maxCount: 1 },
  { name: 'coverImage', maxCount: 1 }
]);

// =============================================
// STATIC ROUTES FIRST
// =============================================

// ---- Student dashboard ----
router.get('/my/uploads',   protect, ctrl.getMyUploads);
router.get('/my/downloads', protect, ctrl.getMyDownloads);
router.get('/my/purchases', protect, ctrl.getMyPurchases);

// ---- Admin ----
router.get('/admin/all',        protect, adminOnly, ctrl.getAllMaterialsAdmin);
router.put('/admin/:id/status', protect, adminOnly, ctrl.updateMaterialStatus);
router.put('/admin/:id',        protect, adminOnly, ctrl.updateMaterial);
router.delete('/admin/:id',     protect, adminOnly, ctrl.deleteMaterial);

// ---- Upload (student or admin — role decides moderation status) ----
router.post('/', protect, uploadFields, ctrl.uploadMaterial);

// ---- Browse ----
router.get('/', ctrl.getAllMaterials);

// =============================================
// DYNAMIC ROUTES LAST
// =============================================

router.post('/:id/free-download', protect, ctrl.downloadFreeMaterial);
router.get('/:id/download-url',   protect, ctrl.getDownloadUrl);
router.get('/:id',                ctrl.getMaterialById);

module.exports = router;