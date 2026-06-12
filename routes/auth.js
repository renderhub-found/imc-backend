'use strict';

const express     = require('express');
const router      = express.Router();
const ctrl        = require('../controllers/authcontroller');
const { protect } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', ctrl.register);

// POST /api/ao/login
router.post('/login', ctrl.login);

// GET  /api/auth/me
router.get('/me', protect, ctrl.getMe);

// PUT  /api/auth/update-profile
router.put('/update-profile', protect, ctrl.updateProfile);

// PUT  /api/auth/change-password
router.put('/change-password', protect, ctrl.changePassword);

router.post('/forgot-password', ctrl.forgotPassword);

router.post('/reset-password',  ctrl.resetPassword);

module.exports = router;