'use strict';
const { uploadImage, uploadMedia, uploadToCloudinary } = require('../middleware/upload');
const express     = require('express');
const router      = express.Router();
const ctrl        = require('../controllers/vendorController');
const { protect } = require('../middleware/auth');
const Vendor      = require('../models/Vendor');

// =============================================
// STATIC ROUTES — must all be above /:id
// =============================================

// GET /api/vendors/products/all
router.get('/products/all', ctrl.getAllProducts);

// GET /api/vendors/my-profile
router.get('/my-profile', protect, ctrl.getMyVendorProfile);

// POST /api/vendors/register
router.post('/register', protect, ctrl.registerVendor);

// POST /api/vendors/products
router.post(
  '/products',
  protect,
  uploadMedia.fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 }
  ]),
  ctrl.addProduct
);

// DELETE /api/vendors/products/:productId
router.delete(
  '/products/:productId',
  protect,
  ctrl.deleteProduct
);

// GET /api/vendors
router.get('/', ctrl.getAllVendors);

// POST /api/vendors/upload-image — upload product/vendor image
router.post('/upload-image', protect, uploadImage.single('image'),
  async function (req, res) {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image uploaded.'
      });
    }
    try {
      var result = await uploadToCloudinary(req.file.buffer, 'imc/vendors', 'image');
      return res.json({
        success:  true,
        message:  'Image uploaded!',
        imageUrl: result.secure_url,
        publicId: result.public_id
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PUT /api/vendors/profile-picture
router.put(
  '/profile-picture',
  protect,
  uploadImage.single('image'),
  ctrl.uploadProfilePicture
);

router.post('/products/:productId/lead', ctrl.logProductLead);

// =============================================
// /:id MUST BE THE VERY LAST GET ROUTE
// =============================================

router.get('/:id', ctrl.getVendorById);

// POST /api/vendors/complete-registration
// For users who paid but vendor record was not created
router.post('/complete-registration', protect, async function (req, res) {
  try {
    var existing = await Vendor.findOne({ user: req.user._id });
    if (existing) {
      return res.status(200).json({
        success:       true,
        message:       'Already a vendor.',
        vendor:        existing,
        alreadyExists: true
      });
    }
    return ctrl.registerVendor(req, res);

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;