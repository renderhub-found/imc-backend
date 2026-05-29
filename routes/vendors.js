'use strict';

const express     = require('express');
const router      = express.Router();
const ctrl        = require('../controllers/vendorController');
const { protect } = require('../middleware/auth');

// =============================================
// DEBUG — logs every request to /api/vendors/*
// =============================================

router.use(function (req, res, next) {
  console.log('VENDOR ROUTER HIT:', req.method, req.url);
  next();
});

// =============================================
// STATIC ROUTES — must all be above /:id
// =============================================

// GET /api/vendors/products/all
router.get('/products/all', function (req, res, next) {
  console.log('ROUTE HIT: /products/all');
  next();
}, ctrl.getAllProducts);

// GET /api/vendors/my-profile
router.get('/my-profile', function (req, res, next) {
  console.log('ROUTE HIT: /my-profile');
  next();
}, protect, ctrl.getMyVendorProfile);

// POST /api/vendors/register
router.post('/register', function (req, res, next) {
  console.log('ROUTE HIT: POST /register');
  next();
}, protect, ctrl.registerVendor);

// POST /api/vendors/products
router.post('/products', function (req, res, next) {
  console.log('ROUTE HIT: POST /products');
  next();
}, protect, ctrl.addProduct);

// DELETE /api/vendors/products/:productId
router.delete(
  '/products/:productId',
  protect,
  ctrl.deleteProduct
);

// GET /api/vendors
router.get('/', ctrl.getAllVendors);

// =============================================
// /:id MUST BE THE VERY LAST ROUTE
// =============================================

router.get('/:id', function (req, res, next) {
  console.log('ROUTE HIT: /:id with value:', req.params.id);
  next();
}, ctrl.getVendorById);

module.exports = router;