// ================================================
//   COURSE CONTROLLER
// ================================================

const Course = require('../models/Course');

// GET /api/courses
const getAllCourses = async function (req, res) {
  try {
    var filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.free === 'true') filter.isFree = true;
    if (req.query.search) {
      var q    = new RegExp(req.query.search, 'i');
      filter.$or = [{ title: q }, { category: q }, { description: q }];
    }

    var courses = await Course.find(filter)
      .select('-purchases')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true, count: courses.length, courses: courses
    });
  } catch (err) {
    console.error('Get courses error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/courses/my-courses
const getMyCourses = async function (req, res) {
  try {
    var courses = await Course.find({
      'purchases.userEmail': req.user.email
    }).select('title category image fileUrl duration lessons level');

    return res.status(200).json({
      success: true, count: courses.length, courses: courses
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/courses/purchase
const purchaseCourse = async function (req, res) {
  try {
    var courseId   = req.body.courseId;
    var paymentRef = req.body.paymentRef || '';

    if (!courseId) {
      return res.status(400).json({
        success: false, message: 'Course ID required.'
      });
    }

    var course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false, message: 'Course not found.'
      });
    }

    var owned = course.purchases.find(function (p) {
      return p.userEmail === req.user.email;
    });

    if (owned) {
      return res.status(200).json({
        success: true,
        message: 'You already own this course.',
        fileUrl: course.fileUrl
      });
    }

    course.purchases.push({
      user: req.user._id, userEmail: req.user.email,
      amount: course.price, paymentRef: paymentRef
    });
    course.students = (course.students || 0) + 1;
    await course.save();

    return res.status(200).json({
      success: true,
      message: 'Course purchased successfully!',
      fileUrl: course.fileUrl
    });
  } catch (err) {
    console.error('Purchase course error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/courses (admin)
const createCourse = async function (req, res) {
  try {
    var title       = (req.body.title       || '').trim();
    var category    = (req.body.category    || '').trim();
    var description = (req.body.description || '').trim();
    var price       = parseFloat(req.body.price) || 0;
    var fileUrl     = (req.body.fileUrl     || '').trim();

    if (!title || !category || !description || !fileUrl) {
      return res.status(400).json({
        success: false,
        message: 'Title, category, description and fileUrl are required.'
      });
    }

    var course = await Course.create({
      title, category, description, price,
      isFree:   price === 0,
      fileUrl,
      image:    req.body.image    || '',
      duration: req.body.duration || '2 hours',
      lessons:  parseInt(req.body.lessons) || 10,
      level:    req.body.level    || 'Beginner',
      instructor: 'IMC Academy'
    });

    return res.status(201).json({
      success: true, message: 'Course created!', course: course
    });
  } catch (err) {
    console.error('Create course error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/courses/:id (admin)
const deleteCourse = async function (req, res) {
  try {
    await Course.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: 'Course deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/courses/:id
const getCourseById = async function (req, res) {
  try {
    var course = await Course.findById(req.params.id).select('-purchases');
    if (!course) {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }
    return res.status(200).json({ success: true, course: course });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAllCourses, getMyCourses, purchaseCourse,
  createCourse, deleteCourse, getCourseById
};