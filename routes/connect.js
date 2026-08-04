'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/connectController');
const { protect, adminOnly } = require('../middleware/auth');

// ---- Admin (static routes first) ----
router.get('/admin/all',        protect, adminOnly, ctrl.getAllCommunitiesAdmin);
router.put('/admin/:id/status', protect, adminOnly, ctrl.updateCommunityStatus);
router.put('/admin/:id',        protect, adminOnly, ctrl.updateCommunity);
router.delete('/admin/:id',     protect, adminOnly, ctrl.deleteCommunity);

// ---- Public ----
router.get('/universities', ctrl.getUniversities);
router.get('/communities',  ctrl.getCommunities);
router.post('/',            protect, ctrl.createCommunity);
router.post('/:id/report',  protect, ctrl.reportCommunity);

module.exports = router;