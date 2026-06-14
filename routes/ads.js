'use strict';

const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/adController');
const { protect, adminOnly } = require('../middleware/auth');

// Static routes first
router.get('/admin/all', protect, adminOnly, ctrl.getAllAdsAdmin);
router.get('/my-ads',    protect,            ctrl.getMyAds);
router.post('/',         protect,            ctrl.submitAd);
router.get('/',                              ctrl.getAllAds);

// Dynamic routes last
router.put('/:id/status',  protect, adminOnly, ctrl.updateAdStatus);
router.delete('/:id',      protect, adminOnly, ctrl.deleteAd);

module.exports = router;