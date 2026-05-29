'use strict';

const Ad = require('../models/Ad');

// =============================================
// GET ALL APPROVED ADS — Public
// GET /api/ads
// =============================================

const getAllAds = async function (req, res) {
  try {
    var filter = { status: 'approved', paymentStatus: 'paid' };

    if (req.query.category) {
      filter.category = new RegExp(req.query.category, 'i');
    }
    if (req.query.location) {
      filter.location = new RegExp(req.query.location, 'i');
    }

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
};

// =============================================
// GET MY ADS — Protected
// GET /api/ads/my-ads
// =============================================

const getMyAds = async function (req, res) {
  try {
    var ads = await Ad.find({
      ownerEmail: req.user.email
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count:   ads.length,
      ads:     ads
    });
  } catch (err) {
    console.error('Get my ads error:', err.message);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// =============================================
// SUBMIT AD — Protected
// POST /api/ads
// =============================================

const submitAd = async function (req, res) {
  try {
    var title       = (req.body.title       || '').trim();
    var category    = (req.body.category    || '').trim();
    var description = (req.body.description || '').trim();
    var location    = (req.body.location    || '').trim();
    var contact     = (req.body.contact     || '').trim();
    var image       = (req.body.image       || '').trim();
    var duration    = parseInt(req.body.duration) || 7;
    var paymentRef  = (req.body.paymentRef  || '').trim();

    // Validate
    if (!title) {
      return res.status(400).json({
        success: false, message: 'Ad title is required.'
      });
    }
    if (!category) {
      return res.status(400).json({
        success: false, message: 'Category is required.'
      });
    }
    if (!description) {
      return res.status(400).json({
        success: false, message: 'Description is required.'
      });
    }
    if (!location) {
      return res.status(400).json({
        success: false, message: 'Location is required.'
      });
    }
    if (!contact) {
      return res.status(400).json({
        success: false, message: 'Contact number is required.'
      });
    }

    // Pricing based on duration
    var priceMap = { 7: 2000, 14: 3500, 30: 6000 };
    var price    = priceMap[duration] || 2000;

    // Calculate expiry date
    var expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + duration);

    var ad = await Ad.create({
      owner:         req.user._id,
      ownerName:     req.user.firstName + ' ' + (req.user.lastName || ''),
      ownerEmail:    req.user.email,
      title:         title,
      category:      category,
      description:   description,
      location:      location,
      contact:       contact,
      image:         image,
      duration:      duration,
      price:         price,
      paymentRef:    paymentRef,
      paymentStatus: paymentRef ? 'paid' : 'pending',
      status:        'pending',
      expiryDate:    expiryDate
    });

    return res.status(201).json({
      success: true,
      message: 'Ad submitted successfully! Pending admin approval.',
      ad:      ad
    });
  } catch (err) {
    console.error('Submit ad error:', err.message);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// =============================================
// UPDATE AD STATUS — Admin only
// PUT /api/ads/:id/status
// =============================================

const updateAdStatus = async function (req, res) {
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
        success: false, message: 'Ad not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Ad status updated to: ' + req.body.status,
      ad:      ad
    });
  } catch (err) {
    console.error('Update ad status error:', err.message);
    return res.status(500).json({
      success: false, message: err.message
    });
  }
};

// =============================================
// DELETE AD — Admin only
// DELETE /api/ads/:id
// =============================================

const deleteAd = async function (req, res) {
  try {
    var ad = await Ad.findByIdAndDelete(req.params.id);
    if (!ad) {
      return res.status(404).json({
        success: false, message: 'Ad not found.'
      });
    }
    return res.status(200).json({
      success: true, message: 'Ad deleted.'
    });
  } catch (err) {
    return res.status(500).json({
      success: false, message: err.message
    });
  }
};

// =============================================
// GET ALL ADS — Admin (including pending)
// GET /api/ads/admin/all
// =============================================

const getAllAdsAdmin = async function (req, res) {
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
    return res.status(500).json({
      success: false, message: err.message
    });
  }
};

module.exports = {
  getAllAds,
  getMyAds,
  submitAd,
  updateAdStatus,
  deleteAd,
  getAllAdsAdmin
};