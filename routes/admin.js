'use strict';

const express    = require('express');
const router     = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const User            = require('../models/User');
const Vendor          = require('../models/Vendor');
const Ambassador      = require('../models/Ambassador');
const News            = require('../models/News');
const Course          = require('../models/Course');
const Ad              = require('../models/Ad');
const ContactMessage  = require('../models/ContactMessage');

// =============================================
// GET PLATFORM STATS
// GET /api/admin/stats
// =============================================

router.get('/stats', protect, adminOnly,
  async function (req, res) {
    try {
      var totalUsers       = await User.countDocuments();
      var totalVendors     = await Vendor.countDocuments();
      var pendingVendors   = await Vendor.countDocuments({ status: 'pending'  });
      var approvedVendors  = await Vendor.countDocuments({ status: 'approved' });
      var rejectedVendors  = await Vendor.countDocuments({ status: 'rejected' });
      var totalAmbassadors = await Ambassador.countDocuments();
      var totalNews        = await News.countDocuments();
      var pendingNews      = await News.countDocuments({ status: 'pending'  });
      var approvedNews     = await News.countDocuments({ status: 'approved' });
      var totalCourses     = await Course.countDocuments();
      var totalAds         = await Ad.countDocuments();
      var pendingAds       = await Ad.countDocuments({ status: 'pending' });
      var approvedAds      = await Ad.countDocuments({ status: 'approved' });
      var totalMessages    = await ContactMessage.countDocuments();
      var unreadMessages   = await ContactMessage.countDocuments({ isRead: false });

      // Revenue calculation
      var paidVendors      = await Vendor.countDocuments({ paymentStatus: 'paid' });
      var vendorRevenue    = paidVendors * 5000;

      var adDocs           = await Ad.find({ paymentStatus: 'paid' }).select('price');
      var adRevenue        = adDocs.reduce(function (sum, a) {
        return sum + (a.price || 0);
      }, 0);

      var totalRevenue = vendorRevenue + adRevenue;

      return res.status(200).json({
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
          approvedNews,
          totalCourses,
          totalAds,
          pendingAds,
          approvedAds,
          totalMessages,
          unreadMessages,
          revenue: {
            vendors: vendorRevenue,
            ads:     adRevenue,
            total:   totalRevenue
          }
        }
      });
    } catch (err) {
      console.error('Admin stats error:', err.message);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// =============================================
// GET ALL USERS
// GET /api/admin/users
// =============================================

router.get('/users', protect, adminOnly,
  async function (req, res) {
    try {
      var filter = {};
      if (req.query.role)      filter.role      = req.query.role;
      if (req.query.isBlocked) filter.isBlocked = req.query.isBlocked === 'true';

      var users = await User.find(filter).sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        count:   users.length,
        users:   users
      });
    } catch (err) {
      console.error('Get users error:', err.message);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// =============================================
// BLOCK OR UNBLOCK USER
// PUT /api/admin/users/:id/block
// =============================================

router.put('/users/:id/block', protect, adminOnly,
  async function (req, res) {
    try {
      var user = await User.findByIdAndUpdate(
        req.params.id,
        { isBlocked: req.body.isBlocked },
        { new: true }
      );
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found.'
        });
      }
      return res.status(200).json({
        success: true,
        message: 'User ' + (req.body.isBlocked ? 'blocked' : 'unblocked') + ' successfully.',
        user:    user
      });
    } catch (err) {
      console.error('Block user error:', err.message);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// =============================================
// CHANGE USER ROLE
// PUT /api/admin/users/:id/role
// =============================================

router.put('/users/:id/role', protect, adminOnly,
  async function (req, res) {
    try {
      var validRoles = ['student', 'vendor', 'ambassador', 'admin'];
      if (!validRoles.includes(req.body.role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Must be one of: ' + validRoles.join(', ')
        });
      }
      var user = await User.findByIdAndUpdate(
        req.params.id,
        { role: req.body.role },
        { new: true }
      );
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found.'
        });
      }
      return res.status(200).json({
        success: true,
        message: 'Role updated to: ' + req.body.role,
        user:    user
      });
    } catch (err) {
      console.error('Change role error:', err.message);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// =============================================
// GET ALL VENDORS (admin view)
// GET /api/admin/vendors
// =============================================

router.get('/vendors', protect, adminOnly,
  async function (req, res) {
    try {
      var filter = {};
      if (req.query.status) filter.status = req.query.status;

      var vendors = await Vendor.find(filter).sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        count:   vendors.length,
        vendors: vendors
      });
    } catch (err) {
      console.error('Get vendors error:', err.message);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// =============================================
// APPROVE OR REJECT VENDOR
// PUT /api/admin/vendors/:id
// =============================================

router.put('/vendors/:id', protect, adminOnly,
  async function (req, res) {
    try {
      var allowed = ['approved', 'rejected', 'pending'];
      if (!allowed.includes(req.body.status)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be: approved, rejected or pending.'
        });
      }

      var vendor = await Vendor.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status },
        { new: true }
      );

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Vendor status updated to: ' + req.body.status,
        vendor:  vendor
      });
    } catch (err) {
      console.error('Update vendor status error:', err.message);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// =============================================
// GET ALL AMBASSADORS
// GET /api/admin/ambassadors
// =============================================

router.get('/ambassadors', protect, adminOnly,
  async function (req, res) {
    try {
      var ambassadors = await Ambassador.find().sort({ createdAt: -1 });

      return res.status(200).json({
        success:     true,
        count:       ambassadors.length,
        ambassadors: ambassadors
      });
    } catch (err) {
      console.error('Get ambassadors error:', err.message);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// =============================================
// GET ALL NEWS (admin view including pending)
// GET /api/admin/news
// =============================================

router.get('/news', protect, adminOnly,
  async function (req, res) {
    try {
      var filter = {};
      if (req.query.status) filter.status = req.query.status;

      var news = await News.find(filter).sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        count:   news.length,
        news:    news
      });
    } catch (err) {
      console.error('Get news error:', err.message);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// =============================================
// APPROVE REJECT OR PIN NEWS
// PUT /api/admin/news/:id
// =============================================

router.put('/news/:id', protect, adminOnly,
  async function (req, res) {
    try {
      var updates = {};
      if (req.body.status !== undefined) updates.status = req.body.status;
      if (req.body.pinned !== undefined) updates.pinned = req.body.pinned;

      var news = await News.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true }
      );

      if (!news) {
        return res.status(404).json({
          success: false,
          message: 'News not found.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'News updated.',
        news:    news
      });
    } catch (err) {
      console.error('Update news error:', err.message);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// =============================================
// GET ALL ADS (admin view)
// GET /api/admin/ads
// =============================================

router.get('/ads', protect, adminOnly,
  async function (req, res) {
    try {
      var filter = {};
      if (req.query.status) filter.status = req.query.status;

      var ads = await Ad.find(filter).sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        count:   ads.length,
        ads:     ads
      });
    } catch (err) {
      console.error('Get ads error:', err.message);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// =============================================
// APPROVE OR REJECT AD
// PUT /api/admin/ads/:id
// =============================================

router.put('/ads/:id', protect, adminOnly,
  async function (req, res) {
    try {
      var allowed = ['approved', 'rejected', 'pending', 'expired'];
      if (!allowed.includes(req.body.status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status.'
        });
      }

      var ad = await Ad.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status },
        { new: true }
      );

      if (!ad) {
        return res.status(404).json({
          success: false,
          message: 'Ad not found.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Ad status updated to: ' + req.body.status,
        ad:      ad
      });
    } catch (err) {
      console.error('Update ad error:', err.message);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// =============================================
// GET ALL COURSES (admin view)
// GET /api/admin/courses
// =============================================

router.get('/courses', protect, adminOnly,
  async function (req, res) {
    try {
      var courses = await Course.find()
        .select('-purchases')
        .sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        count:   courses.length,
        courses: courses
      });
    } catch (err) {
      console.error('Get courses error:', err.message);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// =============================================
// GET ALL CONTACT MESSAGES
// GET /api/admin/messages
// =============================================

router.get('/messages', protect, adminOnly,
  async function (req, res) {
    try {
      var filter = {};
      if (req.query.isRead !== undefined) {
        filter.isRead = req.query.isRead === 'true';
      }

      var messages = await ContactMessage.find(filter)
        .sort({ createdAt: -1 });

      return res.status(200).json({
        success:  true,
        count:    messages.length,
        messages: messages
      });
    } catch (err) {
      console.error('Get messages error:', err.message);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// =============================================
// MARK MESSAGE AS READ
// PUT /api/admin/messages/:id/read
// =============================================

router.put('/messages/:id/read', protect, adminOnly,
  async function (req, res) {
    try {
      var msg = await ContactMessage.findByIdAndUpdate(
        req.params.id,
        { isRead: true },
        { new: true }
      );

      if (!msg) {
        return res.status(404).json({
          success: false,
          message: 'Message not found.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Marked as read.',
        data:    msg
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// =============================================
// GET ALL WITHDRAWAL REQUESTS
// GET /api/admin/withdrawals
// =============================================

router.get('/withdrawals', protect, adminOnly,
  async function (req, res) {
    try {
      var ambassadors = await Ambassador.find({
        'withdrawals.0': { $exists: true }
      }).select('fullName email withdrawals');

      var allWithdrawals = [];

      ambassadors.forEach(function (amb) {
        amb.withdrawals.forEach(function (w) {
          allWithdrawals.push({
            _id:         w._id,
            ambName:     amb.fullName,
            ambEmail:    amb.email,
            accountName: w.accountName,
            bankName:    w.bankName,
            accountNum:  w.accountNum,
            amount:      w.amount,
            status:      w.status,
            date:        w.date
          });
        });
      });

      // Sort by date newest first
      allWithdrawals.sort(function (a, b) {
        return new Date(b.date) - new Date(a.date);
      });

      return res.status(200).json({
        success:     true,
        count:       allWithdrawals.length,
        withdrawals: allWithdrawals
      });
    } catch (err) {
      console.error('Get withdrawals error:', err.message);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// =============================================
// UPDATE WITHDRAWAL STATUS
// PUT /api/admin/withdrawals/:ambId/:withdrawalId
// =============================================

router.put('/withdrawals/:ambId/:withdrawalId', protect, adminOnly,
  async function (req, res) {
    try {
      var allowed = ['pending', 'approved', 'paid', 'rejected'];
      if (!allowed.includes(req.body.status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status.'
        });
      }

      var ambassador = await Ambassador.findById(req.params.ambId);

      if (!ambassador) {
        return res.status(404).json({
          success: false,
          message: 'Ambassador not found.'
        });
      }

      var withdrawal = ambassador.withdrawals.id(req.params.withdrawalId);

      if (!withdrawal) {
        return res.status(404).json({
          success: false,
          message: 'Withdrawal not found.'
        });
      }

      withdrawal.status = req.body.status;
      await ambassador.save();

      return res.status(200).json({
        success: true,
        message: 'Withdrawal status updated to: ' + req.body.status
      });
    } catch (err) {
      console.error('Update withdrawal error:', err.message);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// =============================================
// GET PAYMENT RECORDS
// GET /api/admin/payments
// =============================================

router.get('/payments', protect, adminOnly,
  async function (req, res) {
    try {
      var paidVendors = await Vendor.find({
        paymentStatus: 'paid'
      }).select('bizName email paymentRef createdAt');

      var paidAds = await Ad.find({
        paymentStatus: 'paid'
      }).select('title ownerEmail paymentRef price createdAt');

      var vendorPayments = paidVendors.map(function (v) {
        return {
          type:      'Vendor Registration',
          name:      v.bizName,
          email:     v.email,
          amount:    5000,
          ref:       v.paymentRef,
          date:      v.createdAt
        };
      });

      var adPayments = paidAds.map(function (a) {
        return {
          type:      'Ad Posting',
          name:      a.title,
          email:     a.ownerEmail,
          amount:    a.price,
          ref:       a.paymentRef,
          date:      a.createdAt
        };
      });

      var allPayments = vendorPayments.concat(adPayments);

      allPayments.sort(function (a, b) {
        return new Date(b.date) - new Date(a.date);
      });

      var totalRevenue = allPayments.reduce(function (sum, p) {
        return sum + (p.amount || 0);
      }, 0);

      return res.status(200).json({
        success:      true,
        count:        allPayments.length,
        totalRevenue: totalRevenue,
        payments:     allPayments
      });
    } catch (err) {
      console.error('Get payments error:', err.message);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

module.exports = router;