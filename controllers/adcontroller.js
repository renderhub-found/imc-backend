'use strict';

const Ad = require('../models/Ad');

// GET /api/ads — Public
const getAllAds = async function (req, res) {
  try {
    var filter = { status: 'approved', paymentStatus: 'paid' };
    if (req.query.category) filter.category = new RegExp(req.query.category, 'i');
    if (req.query.location) filter.location = new RegExp(req.query.location, 'i');

    var ads = await Ad.find(filter).sort({ createdAt: -1 });
    return res.json({ success: true, count: ads.length, ads: ads });
  } catch (err) {
    console.error('[Ad] getAllAds:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/ads/my-ads — Protected
const getMyAds = async function (req, res) {
  try {
    console.log('[Ad] getMyAds — user:', req.user.email);
    var ads = await Ad.find({ ownerEmail: req.user.email }).sort({ createdAt: -1 });
    return res.json({ success: true, count: ads.length, ads: ads });
  } catch (err) {
    console.error('[Ad] getMyAds:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/ads — Protected
const submitAd = async function (req, res) {
  try {
    console.log('[Ad] submitAd — user:', req.user.email);
    console.log('[Ad] body:', JSON.stringify(req.body));

    var title       = (req.body.title       || '').trim();
    var category    = (req.body.category    || '').trim();
    var description = (req.body.description || '').trim();
    var location    = (req.body.location    || '').trim();
    var contact     = (req.body.contact     || '').trim();
    var image       = (req.body.image       || '').trim();
    var duration    = parseInt(req.body.duration) || 7;
    var paymentRef  = (req.body.paymentRef  || '').trim();

    var missing = [];
    if (!title)       missing.push('title');
    if (!category)    missing.push('category');
    if (!description) missing.push('description');
    if (!location)    missing.push('location');
    if (!contact)     missing.push('contact');

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing fields: ' + missing.join(', ')
      });
    }

    var priceMap = { 7: 2000, 14: 3500, 30: 6000 };
    var price    = priceMap[duration] || 2000;
    var expiry   = new Date();
    expiry.setDate(expiry.getDate() + duration);

    console.log('[Ad] Creating document...');

    var ad = await Ad.create({
      owner:         req.user._id,
      ownerName:     ((req.user.firstName || '') + ' ' + (req.user.lastName || '')).trim(),
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
      expiryDate:    expiry
    });

    console.log('[Ad] ✅ Created! ID:', ad._id, '| title:', ad.title);

    return res.status(201).json({
      success: true,
      message: 'Ad submitted! Pending admin approval.',
      ad:      ad
    });

  } catch (err) {
    console.error('[Ad] submitAd error:', err.message);
    console.error('[Ad] stack:', err.stack);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/ads/:id/status — Admin
const updateAdStatus = async function (req, res) {
  try {
    var allowed = ['approved', 'rejected', 'pending', 'expired'];
    if (!allowed.includes(req.body.status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }
    var ad = await Ad.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found.' });
    return res.json({ success: true, ad: ad });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/ads/:id — Admin
const deleteAd = async function (req, res) {
  try {
    await Ad.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Ad deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/ads/admin/all — Admin
const getAllAdsAdmin = async function (req, res) {
  try {
    var filter = {};
    if (req.query.status) filter.status = req.query.status;
    var ads = await Ad.find(filter).sort({ createdAt: -1 });
    return res.json({ success: true, count: ads.length, ads: ads });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAllAds, getMyAds, submitAd,
  updateAdStatus, deleteAd, getAllAdsAdmin
};