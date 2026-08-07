'use strict';

var express   = require('express');
var router    = express.Router();
var ctrl      = require('../controllers/ambassadorController');
var taskCtrl  = require('../controllers/ambassadorTaskController');
var { protect, adminOnly } = require('../middleware/auth');
var { adminProtect }       = require('../middleware/adminAuth');
var { uploadImage }        = require('../middleware/upload');

console.log('[Ambassador Routes] Loading...');
console.log('[Ambassador Routes] registerAmbassador:', typeof ctrl.registerAmbassador);
console.log('[Ambassador Routes] getMyProfile:', typeof ctrl.getMyProfile);

router.get('/my-profile',     protect,              ctrl.getMyProfile);
router.get('/my-withdrawals', protect,              ctrl.getMyWithdrawals);
router.post('/register',      protect,              ctrl.registerAmbassador);
router.post('/withdraw',      protect,              ctrl.requestWithdrawal);
router.get('/',               protect, adminOnly,   ctrl.getAllAmbassadors);
router.put('/profile',        protect,              ctrl.updateMyProfile);
router.put('/profile-picture', protect, uploadImage.single('image'), ctrl.uploadMyProfilePicture);

// ---- Tasks (ambassador side) ----
router.get('/tasks',                  protect,            taskCtrl.getActiveTasks);
router.post('/tasks/:taskId/submit',  protect,            taskCtrl.submitTask);
router.get('/my-submissions',         protect,            taskCtrl.getMySubmissions);

// ---- Tasks (admin side) ----
router.get('/tasks/admin/all',              protect, adminOnly, taskCtrl.getAllTasksAdmin);
router.post('/tasks/admin',                 protect, adminOnly, taskCtrl.createTask);
router.put('/tasks/admin/:id',              protect, adminOnly, taskCtrl.updateTask);
router.put('/tasks/admin/:id/status',       protect, adminOnly, taskCtrl.setTaskStatus);
router.delete('/tasks/admin/:id',           protect, adminOnly, taskCtrl.deleteTask);

// ---- Submissions (admin review) ----
router.get('/submissions/admin/all',        protect, adminOnly, taskCtrl.getAllSubmissionsAdmin);
router.put('/submissions/admin/:id/review', protect, adminOnly, taskCtrl.reviewSubmission);

console.log('[Ambassador Routes] ✅ All routes registered');

module.exports = router;