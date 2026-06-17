'use strict';

var express   = require('express');
var router    = express.Router();
var ctrl      = require('../controllers/notificationController');
var { protect } = require('../middleware/auth');

router.get('/',               protect, ctrl.getNotifications);
router.get('/unread-count',   protect, ctrl.getUnreadCount);
router.put('/read-all',       protect, ctrl.markAllRead);
router.put('/:id/read',       protect, ctrl.markAsRead);

module.exports = router;