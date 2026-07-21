'use strict';

var express      = require('express');
var router       = express.Router();
var mongoose     = require('mongoose');
var rateLimit    = require('express-rate-limit');

var { adminProtect, auditLog } = require('../middleware/adminAuth');
var { uploadImage, uploadToCloudinary } = require('../middleware/upload');

var User       = require('../models/User');
var Vendor     = require('../models/Vendor');
var Ambassador = require('../models/Ambassador');
var Ad         = require('../models/Ad');
var News       = require('../models/News');
var Course     = require('../models/Course');
var AdminLog   = require('../models/AdminLog');
var Notification = require('../models/Notification');
var { createNotification } = require('../controllers/notificationController');

var Ad_model, Course_model;
try { Ad_model     = require('../models/Ad');     } catch(e) { Ad_model = null; }
try { Course_model = require('../models/Course'); } catch(e) { Course_model = null; }

console.log('[Admin Routes] Loading...');

// ---- Rate limit: 100 requests per 15 minutes per IP ----
var adminLimiter = null;
try {
  adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max:      100,
    message:  { success: false, message: 'Too many requests. Try again later.' }
  });
} catch (e) {
  console.log('[Admin] Rate limit not available:', e.message);
}

if (adminLimiter) router.use(adminLimiter);

// Apply admin protection to ALL routes in this file
router.use(adminProtect);

// ================================================
//   STATS
//   GET /api/admin/stats
// ================================================

router.get('/stats', async function (req, res) {
  try {
    var totalUsers       = await User.countDocuments();
    var totalVendors     = await Vendor.countDocuments();
    var pendingVendors   = await Vendor.countDocuments({ status: 'pending' });
    var approvedVendors  = await Vendor.countDocuments({ status: 'approved' });
    var rejectedVendors  = await Vendor.countDocuments({ status: 'rejected' });
    var totalAmbassadors = await Ambassador.countDocuments();
    var totalNews        = await News.countDocuments();
    var pendingNews      = await News.countDocuments({ status: 'pending' });
    var totalCourses     = Course_model ? await Course_model.countDocuments() : 0;
    var totalAds         = Ad_model     ? await Ad_model.countDocuments()     : 0;
    var pendingAds       = Ad_model     ? await Ad_model.countDocuments({ status: 'pending' }) : 0;

    // Revenue
    var paidVendors   = await Vendor.find({ paymentStatus: 'paid' }).select('paymentRef');
    var vendorRevenue = paidVendors.length * 5000;

    var adRevenueDocs = Ad_model
      ? await Ad_model.find({ paymentStatus: 'paid' }).select('price')
      : [];
    var adRevenue = adRevenueDocs.reduce(function (s, a) { return s + (a.price || 0); }, 0);

    // Pending ambassador withdrawals
    var ambassadors        = await Ambassador.find();
    var pendingWithdrawals = 0;
    ambassadors.forEach(function (a) {
      a.withdrawals.forEach(function (w) {
        if (w.status === 'pending') pendingWithdrawals++;
      });
    });

    return res.json({
      success: true,
      stats: {
        totalUsers,
        totalVendors,
        pendingVendors,
        approvedVendors,
        rejectedVendors,
        totalAmbassadors,
        totalNews,
        pendingNews,
        totalCourses,
        totalAds,
        pendingAds,
        pendingWithdrawals,
        revenue: {
          vendors: vendorRevenue,
          ads:     adRevenue,
          total:   vendorRevenue + adRevenue
        }
      }
    });
  } catch (err) {
    console.error('[Admin] stats error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Notification = require('../models/Notification');

// ================================================
//   ADMIN: GET ALL EVENTS
//   GET /api/admin/events
// ================================================

const getAllEventsAdmin = async function (req, res) {
  try {
    var events = await Event.find({}).sort({ createdAt: -1 }).lean();

    var eventsWithStats = await Promise.all(events.map(async function (e) {
      var ticketCount = await Ticket.countDocuments({ event: e._id });
      return {
        _id:           e._id,
        title:         e.title,
        organizerName: e.organizer ? e.organizer.toString() : '—',
        eventDate:     e.eventDate,
        status:        e.status || 'active',
        eventType:     e.eventType,
        ticketsSold:   ticketCount,
        university:    e.university
      };
    }));

    return res.status(200).json({ success: true, events: eventsWithStats });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
//   ADMIN: GET ALL NOTIFICATIONS
//   GET /api/admin/notifications
// ================================================

const getAllNotificationsAdmin = async function (req, res) {
  try {
    var notifications = await Notification.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    var unreadCount = await Notification.countDocuments({ isRead: false });

    return res.status(200).json({
      success: true,
      notifications: notifications,
      totalCount: notifications.length,
      unreadCount: unreadCount
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
//   USERS
// ================================================

router.get('/users', async function (req, res) {
  try {
    var page  = parseInt(req.query.page)  || 1;
    var limit = parseInt(req.query.limit) || 20;
    var skip  = (page - 1) * limit;

    var filter = {};
    if (req.query.role)  filter.role      = req.query.role;
    if (req.query.blocked === 'true') filter.isBlocked = true;

    var users = await User.find(filter)
      .select('-password -passwordResetToken -passwordResetExpires')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    var total = await User.countDocuments(filter);

    return res.json({
      success: true,
      total, page, limit,
      totalPages: Math.ceil(total / limit),
      users: users
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/users/:id', async function (req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }
    var user = await User.findById(req.params.id)
      .select('-password -passwordResetToken -passwordResetExpires');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, user: user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/users/:id/block', async function (req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }
    var isBlocked = req.body.isBlocked === true || req.body.isBlocked === 'true';
    var user = await User.findByIdAndUpdate(
      req.params.id, { isBlocked: isBlocked }, { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    await auditLog(req,
      isBlocked ? 'BLOCK_USER' : 'UNBLOCK_USER',
      'User', user._id.toString(), user.email
    );

    return res.json({
      success: true,
      message: 'User ' + (isBlocked ? 'blocked' : 'unblocked') + '.',
      user: user
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/users/:id/role', async function (req, res) {
  try {
    var validRoles = ['student','vendor','ambassador','admin'];
    var role       = req.body.role || '';

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be: ' + validRoles.join(', ')
      });
    }

    var user = await User.findByIdAndUpdate(
      req.params.id, { role: role }, { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    await auditLog(req, 'CHANGE_USER_ROLE', 'User',
      user._id.toString(), user.email + ' → ' + role);

    return res.json({ success: true, message: 'Role updated to: ' + role, user: user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/users/:id', async function (req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }
    // Prevent deleting self
    if (req.params.id === req.admin._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account.' });
    }
    var user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    await auditLog(req, 'DELETE_USER', 'User', req.params.id, user.email);

    return res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ================================================
//   VENDORS
// ================================================

router.get('/vendors', async function (req, res) {
  try {
    var filter = {};
    if (req.query.status) filter.status = req.query.status;

    var vendors = await Vendor.find(filter).sort({ createdAt: -1 });
    return res.json({ success: true, count: vendors.length, vendors: vendors });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/vendors/:id/status', async function (req, res) {
  try {
    var allowed = ['approved','rejected','pending','suspended'];
    var status  = req.body.status || '';

    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false, message: 'Status must be: ' + allowed.join(', ')
      });
    }

    var vendor = await Vendor.findByIdAndUpdate(
      req.params.id, { status: status }, { new: true }
    );
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found.' });

    // Credit the referring ambassador the first time this vendor is approved.
    // Guarded against double-crediting if status is toggled more than once.
    if (status === 'approved' && vendor.refCode) {
      var ambassador = await Ambassador.findOne({ refCode: vendor.refCode });
      if (ambassador) {
        var alreadyCredited = ambassador.referrals.some(function (r) {
          return r.vendorId && r.vendorId.toString() === vendor._id.toString();
        });
        if (!alreadyCredited) {
          var commission = 2000;
          ambassador.referrals.push({
            vendorId:   vendor._id,
            vendorName: vendor.bizName,
            commission: commission
          });
          ambassador.earnings = (ambassador.earnings || 0) + commission;
          await ambassador.save();
        }
      }
    }
await auditLog(req, 'UPDATE_VENDOR_STATUS', 'Vendor',
      vendor._id.toString(), vendor.bizName + ' → ' + status);

    if (status === 'approved') {
      var emailService = require('../utils/emailService');
      emailService.sendVendorApproved(vendor.email, vendor.fullName, vendor.bizName).catch(function (err) {
        console.error('[Vendor] Approval email failed:', err.message);
      });
      createNotification(
        vendor.user, 'vendor_approved',
        'Your Store is Live! 🎉',
        vendor.bizName + ' has been approved and is now visible to students.',
        'vendor-dashboard.html', '🟢'
      );
    }

    return res.json({ success: true, message: 'Vendor ' + status + '.', vendor: vendor });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
// ================================================
//   AMBASSADORS
// ================================================

router.get('/ambassadors', async function (req, res) {
  try {
    var ambassadors = await Ambassador.find().sort({ createdAt: -1 });
    return res.json({ success: true, count: ambassadors.length, ambassadors: ambassadors });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/ambassadors/:id/status', async function (req, res) {
  try {
    var allowed = ['active','suspended'];
    var status  = req.body.status || '';

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be: active or suspended' });
    }

    var amb = await Ambassador.findByIdAndUpdate(
      req.params.id, { status: status }, { new: true }
    );
    if (!amb) return res.status(404).json({ success: false, message: 'Ambassador not found.' });

    await auditLog(req, 'UPDATE_AMBASSADOR_STATUS', 'Ambassador',
      amb._id.toString(), amb.fullName + ' → ' + status);

    return res.json({ success: true, message: 'Ambassador ' + status + '.', ambassador: amb });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ================================================
//   ADS
// ================================================

router.get('/ads', async function (req, res) {
  try {
    if (!Ad_model) return res.json({ success: true, count: 0, ads: [] });
    var filter = {};
    if (req.query.status) filter.status = req.query.status;
    var ads = await Ad_model.find(filter).sort({ createdAt: -1 });
    return res.json({ success: true, count: ads.length, ads: ads });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/ads/:id/status', async function (req, res) {
  try {
    if (!Ad_model) return res.status(404).json({ success: false, message: 'Ad model not loaded.' });
    var allowed = ['approved','rejected','pending','expired'];
    var status  = req.body.status || '';

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    var ad = await Ad_model.findByIdAndUpdate(
      req.params.id, { status: status }, { new: true }
    );
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found.' });

    await auditLog(req, 'UPDATE_AD_STATUS', 'Ad',
      ad._id.toString(), ad.title + ' → ' + status);

    return res.json({ success: true, message: 'Ad ' + status + '.', ad: ad });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/ads/:id', async function (req, res) {
  try {
    if (!Ad_model) return res.status(404).json({ success: false, message: 'Ad model not loaded.' });
    var ad = await Ad_model.findByIdAndDelete(req.params.id);
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found.' });

    await auditLog(req, 'DELETE_AD', 'Ad', req.params.id, ad.title);

    return res.json({ success: true, message: 'Ad deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ================================================
//   NEWS
// ================================================

router.get('/news', async function (req, res) {
  try {
    var filter = {};
    if (req.query.status) filter.status = req.query.status;
    var news = await News.find(filter).sort({ createdAt: -1 });
    return res.json({ success: true, count: news.length, news: news });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/news/:id/status', async function (req, res) {
  try {
    var allowed = ['approved','rejected','pending'];
    var status  = req.body.status || '';
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    var updates = { status: status };
    if (typeof req.body.pinned !== 'undefined') updates.pinned = req.body.pinned;

    var newsItem = await News.findByIdAndUpdate(
      req.params.id, updates, { new: true }
    );
    if (!newsItem) return res.status(404).json({ success: false, message: 'News not found.' });

    await auditLog(req, 'UPDATE_NEWS_STATUS', 'News',
      newsItem._id.toString(), newsItem.title + ' → ' + status);

    return res.json({ success: true, message: 'News updated.', news: newsItem });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/news/:id', async function (req, res) {
  try {
    var newsItem = await News.findByIdAndDelete(req.params.id);
    if (!newsItem) return res.status(404).json({ success: false, message: 'News not found.' });

    await auditLog(req, 'DELETE_NEWS', 'News', req.params.id, newsItem.title);

    return res.json({ success: true, message: 'News deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ================================================
//   COURSES
// ================================================

router.get('/courses', async function (req, res) {
  try {
    if (!Course_model) return res.json({ success: true, count: 0, courses: [] });
    var courses = await Course_model.find().select('-purchases').sort({ createdAt: -1 });
    return res.json({ success: true, count: courses.length, courses: courses });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/courses', uploadImage.single('image'), async function (req, res) {
  try {
    if (!Course_model) return res.status(404).json({ success: false, message: 'Course model not loaded.' });

    var title       = (req.body.title       || '').trim();
    var category    = (req.body.category    || '').trim();
    var description = (req.body.description || '').trim();
    var price       = parseFloat(req.body.price) || 0;
    var fileUrl     = (req.body.fileUrl     || '').trim();

    if (!title || !category || !description || !fileUrl) {
      return res.status(400).json({
        success: false,
        message: 'title, category, description and fileUrl are required.'
      });
    }

    var image = '';
    if (req.file) {
      var imgRes = await uploadToCloudinary(req.file.buffer, 'imc/courses', 'image');
      image = imgRes.secure_url;
    }

    var course = await Course_model.create({
      title, category, description, price,
      isFree:     price === 0,
      fileUrl,
      image:      image,
      duration:   req.body.duration   || '2 hours',
      lessons:    parseInt(req.body.lessons) || 10,
      level:      req.body.level      || 'Beginner',
      instructor: req.body.instructor || 'IMC Academy'
    });

    await auditLog(req, 'CREATE_COURSE', 'Course', course._id.toString(), course.title);

    return res.status(201).json({ success: true, message: 'Course created!', course: course });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/courses/:id', uploadImage.single('image'), async function (req, res) {
  try {
    if (!Course_model) return res.status(404).json({ success: false, message: 'Course model not loaded.' });

    var updates = {};
    var fields = ['title','category','description','price','fileUrl',
                  'duration','lessons','level','instructor'];
    fields.forEach(function (f) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    if (updates.price !== undefined) updates.isFree = parseFloat(updates.price) === 0;

    // Only touch the image if a new file was actually uploaded — otherwise
    // leave the course's existing image alone.
    if (req.file) {
      var imgRes = await uploadToCloudinary(req.file.buffer, 'imc/courses', 'image');
      updates.image = imgRes.secure_url;
    }

    var course = await Course_model.findByIdAndUpdate(
      req.params.id, updates, { new: true }
    );
    if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });

    await auditLog(req, 'UPDATE_COURSE', 'Course', course._id.toString(), course.title);

    return res.json({ success: true, message: 'Course updated.', course: course });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/courses/:id', async function (req, res) {
  try {
    if (!Course_model) return res.status(404).json({ success: false, message: 'Course model not loaded.' });
    var course = await Course_model.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });

    await auditLog(req, 'DELETE_COURSE', 'Course', req.params.id, course.title);

    return res.json({ success: true, message: 'Course deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ================================================
//   PAYMENTS
// ================================================

router.get('/payments', async function (req, res) {
  try {
    var paidVendors = await Vendor.find({ paymentStatus: 'paid' })
      .select('bizName email paymentRef createdAt');

    var paidAds = Ad_model
      ? await Ad_model.find({ paymentStatus: 'paid' }).select('title ownerEmail paymentRef price createdAt')
      : [];

    var coursePurchases = [];
    if (Course_model) {
      var courses = await Course_model.find({ 'purchases.0': { $exists: true } })
        .select('title price purchases');
      courses.forEach(function (c) {
        c.purchases.forEach(function (p) {
          coursePurchases.push({
            type:      'Course Purchase',
            name:      c.title,
            email:     p.userEmail,
            amount:    c.price || p.amount,
            ref:       p.paymentRef,
            date:      p.date || c.createdAt
          });
        });
      });
    }

    var vendorPayments = paidVendors.map(function (v) {
      return { type: 'Vendor Registration', name: v.bizName,
               email: v.email, amount: 5000, ref: v.paymentRef, date: v.createdAt };
    });

    var adPayments = paidAds.map(function (a) {
      return { type: 'Ad Posting', name: a.title,
               email: a.ownerEmail, amount: a.price, ref: a.paymentRef, date: a.createdAt };
    });

    var all = vendorPayments.concat(adPayments).concat(coursePurchases);
    all.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

    var total = all.reduce(function (s, p) { return s + (p.amount || 0); }, 0);

    return res.json({ success: true, count: all.length, totalRevenue: total, payments: all });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ================================================
//   WITHDRAWALS
// ================================================

router.get('/withdrawals', async function (req, res) {
  try {
    var ambassadors = await Ambassador.find({
      'withdrawals.0': { $exists: true }
    }).select('fullName email withdrawals');

    var all = [];
    ambassadors.forEach(function (a) {
      a.withdrawals.forEach(function (w) {
        all.push({
          _id:         w._id,
          ambId:       a._id,
          ambName:     a.fullName,
          ambEmail:    a.email,
          accountName: w.accountName,
          bankName:    w.bankName,
          accountNum:  w.accountNum,
          amount:      w.amount,
          status:      w.status,
          date:        w.date
        });
      });
    });

    all.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

    return res.json({ success: true, count: all.length, withdrawals: all });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/withdrawals/:ambId/:withdrawalId', async function (req, res) {
  try {
    var allowed = ['pending','approved','paid','rejected'];
    var status  = req.body.status || '';
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    var amb = await Ambassador.findById(req.params.ambId);
    if (!amb) return res.status(404).json({ success: false, message: 'Ambassador not found.' });

    var w = amb.withdrawals.id(req.params.withdrawalId);
    if (!w) return res.status(404).json({ success: false, message: 'Withdrawal not found.' });

    w.status = status;
    await amb.save();

    await auditLog(req, 'UPDATE_WITHDRAWAL', 'Withdrawal',
      req.params.withdrawalId, amb.fullName + ' ₦' + w.amount + ' → ' + status);

    return res.json({ success: true, message: 'Withdrawal ' + status + '.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ================================================
//   AUDIT LOGS
// ================================================

router.get('/logs', async function (req, res) {
  try {
    var page  = parseInt(req.query.page)  || 1;
    var limit = parseInt(req.query.limit) || 50;
    var skip  = (page - 1) * limit;

    var logs = await AdminLog.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    var total = await AdminLog.countDocuments();

    return res.json({ success: true, total, page, logs: logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

console.log('[Admin Routes] ✅ All routes registered');

// ================================================
//   TEST CLOUDINARY
//   GET /api/admin/test-cloudinary
// ================================================

router.get('/test-cloudinary', async function (req, res) {
  try {
    console.log('[Admin] Testing Cloudinary...');

    var cloudinaryConfig = require('../config/cloudinary');
    var connected        = await cloudinaryConfig.testConnection();

    if (!connected) {
      return res.status(500).json({
        success: false,
        message: 'Cloudinary connection failed. Check CLOUDINARY_* environment variables.'
      });
    }

    // Upload a tiny test image (1x1 pixel transparent PNG as base64)
    var testBase64 = 'data:image/png;base64,' +
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    var uploadResult = await cloudinaryConfig.cloudinary.uploader.upload(testBase64, {
      folder:    'imc/test',
      public_id: 'admin-test-' + Date.now()
    });

    // Clean up test image
    await cloudinaryConfig.cloudinary.uploader.destroy(uploadResult.public_id);

    await auditLog(req, 'TEST_CLOUDINARY', 'System', '', 'Connection test passed');

    return res.json({
      success:    true,
      message:    'Cloudinary is working correctly!',
      cloudName:  process.env.CLOUDINARY_CLOUD_NAME,
      testUrl:    uploadResult.secure_url,
      deleted:    true
    });

  } catch (err) {
    console.error('[Admin] Cloudinary test error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Cloudinary test failed: ' + err.message
    });
  }
});

// ================================================
//   TEST EMAIL
//   GET /api/admin/test-email
// ================================================

router.get('/test-email', async function (req, res) {
  try {
    console.log('[Admin] Testing email...');

    var emailService = require('../utils/emailService');
    var verified     = await emailService.verifyTransporter();

    if (!verified) {
      return res.status(500).json({
        success: false,
        message: 'Email transporter verification failed. Check EMAIL_USER and EMAIL_PASS.'
      });
    }

    var result = await emailService.sendEmail({
      to:      process.env.EMAIL_USER,
      subject: '[IMC Test] Email System Test — ' + new Date().toLocaleString(),
      html:    '<div style="font-family:Inter,sans-serif;padding:20px;">' +
               '<h2 style="color:#1a3c8f;">✅ Email Test Successful!</h2>' +
               '<p>This confirms your Inside My Campus email system is working correctly.</p>' +
               '<p>Time: <strong>' + new Date().toISOString() + '</strong></p>' +
               '</div>'
    });

    await auditLog(req, 'TEST_EMAIL', 'System', '', result.success ? 'Email sent' : result.message);

    if (result.success) {
      return res.json({
        success:   true,
        message:   'Test email sent to ' + process.env.EMAIL_USER,
        messageId: result.messageId
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Email send failed: ' + result.message
      });
    }

  } catch (err) {
    console.error('[Admin] Email test error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Email test failed: ' + err.message
    });
  }
});

router.get('/events', getAllEventsAdmin);
router.get('/notifications', getAllNotificationsAdmin);

module.exports = router;