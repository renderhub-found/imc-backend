'use strict';

const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/coursecontroller');
const { protect, adminOnly } = require('../middleware/auth');

// =============================================
// STATIC ROUTES FIRST
// =============================================

// GET  /api/courses/my-courses
router.get('/my-courses', protect, ctrl.getMyCourses);

// POST /api/courses/purchase
router.post('/purchase', protect, ctrl.purchaseCourse);

// POST /api/courses  (admin only — create course)
router.post('/', protect, adminOnly, ctrl.createCourse);

// GET  /api/courses
router.get('/', ctrl.getAllCourses);

// =============================================
// DYNAMIC ROUTES LAST
// =============================================

// DELETE /api/courses/:id  (admin only)
router.delete('/:id', protect, adminOnly, ctrl.deleteCourse);

// GET    /api/courses/:id
router.get('/:id', ctrl.getCourseById);

module.exports = router;