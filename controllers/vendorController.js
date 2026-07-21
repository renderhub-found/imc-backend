'use strict';
const { uploadToCloudinary } = require('../middleware/upload');
const Vendor = require('../models/Vendor');
const User   = require('../models/User');

// ================================================
//   GET ALL VENDORS - Public
//   GET /api/vendors
// ================================================

const getAllVendors = async function (req, res) {
  try {
    var filter = { status: 'approved' };
    if (req.query.category) {
      filter.category = new RegExp(req.query.category, 'i');
    }
    if (req.query.university) {
      filter.university = new RegExp(req.query.university, 'i');
    }
    if (req.query.search) {
      var q = new RegExp(req.query.search, 'i');
      filter.$or = [
        { bizName: q }, { category: q },
        { university: q }, { description: q }
      ];
    }

    var vendors = await Vendor.find(filter)
      .select('-products')
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: vendors.length, vendors: vendors });
  } catch (err) {
    console.error('[Vendor] getAllVendors:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
//   GET ALL PRODUCTS - Public
//   GET /api/vendors/products/all
// ================================================
const getAllProducts = async function (req, res) {
  try {
    var vendors = await Vendor.find({ status: 'approved' })
      .select('bizName university category products profilePicture');

    var all = [];
    vendors.forEach(function (v) {
      v.products.forEach(function (p) {
        var imgs = (p.images && p.images.length > 0) ? p.images : (p.image ? [p.image] : []);
        all.push({
          _id:        p._id,
          name:       p.name,
          price:      p.price,
          description:p.description,
          image:      imgs[0] || '',
          images:     imgs,
          video:      p.video,
          category:   p.category || v.category,
          vendorId:   v._id,
          vendorName: v.bizName,
          vendorLogo: v.profilePicture || '',
          vendorWhatsApp:  v.whatsApp,
          university: v.university
        });
      });
    });

    return res.json({ success: true, count: all.length, products: all });
  } catch (err) {

    console.error('[Vendor] getAllProducts:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
//   GET MY VENDOR PROFILE - Protected
//   GET /api/vendors/my-profile
// ================================================

const getMyVendorProfile = async function (req, res) {
  try {
    console.log('[Vendor] getMyVendorProfile - user:', req.user.email, '| id:', req.user._id);

    // Primary lookup - the correct, intended path.
    var vendor = await Vendor.findOne({ user: req.user._id });

    // Fallback: if a vendor record exists for this person's email but its
    // user link is missing, null, or points at a different/stale User
    // document, find it by email instead, then self-heal the link.
    if (!vendor && req.user.email) {
      var escapedEmail = req.user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      vendor = await Vendor.findOne({
        email: new RegExp('^' + escapedEmail + '$', 'i')
      });

      if (vendor) {
        console.warn('[Vendor] Found by case-insensitive email fallback, healing user link:', vendor._id);
        vendor.user  = req.user._id;
        vendor.email = req.user.email; // normalize stored email too
        await vendor.save();
      }
    }

    if (!vendor) {
      return res.json({
        success:  true,
        isVendor: false,
        vendor:   null
      });
    }

    return res.json({
      success:  true,
      isVendor: true,
      vendor:   vendor
    });
  } catch (err) {
    console.error('[Vendor] getMyVendorProfile:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
//   REGISTER VENDOR - Protected
//   POST /api/vendors/register
// ================================================

const registerVendor = async function (req, res) {
  try {
    console.log('[Vendor] registerVendor - user:', req.user.email);
    console.log('[Vendor] body:', JSON.stringify(req.body));

    // Already a vendor?
    var existing = await Vendor.findOne({ user: req.user._id });
    if (existing) {
      console.log('[Vendor] Already exists:', existing.bizName);
      return res.json({
        success:       true,
        message:       'Already registered as a vendor.',
        vendor:        existing,
        alreadyExists: true
      });
    }

    var fullName    = (req.body.fullName    || '').trim();
    var bizName     = (req.body.bizName     || '').trim();
    var university  = (req.body.university  || '').trim();
    var category    = (req.body.category    || '').trim();
    var description = (req.body.description || '').trim();
    var whatsApp    = (req.body.whatsApp    || '').trim();
    var refCode     = (req.body.refCode     || '').trim();
    var paymentRef  = (req.body.paymentRef  || '').trim();

    var missing = [];
    if (!fullName)    missing.push('fullName');
    if (!bizName)     missing.push('bizName');
    if (!university)  missing.push('university');
    if (!category)    missing.push('category');
    if (!description) missing.push('description');
    if (!whatsApp)    missing.push('whatsApp');

    if (missing.length > 0) {
      console.log('[Vendor] Missing fields:', missing);
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: ' + missing.join(', ')
      });
    }

    console.log('[Vendor] Creating document...');

    var vendor = await Vendor.create({
      user:          req.user._id,
      fullName:      fullName,
      email:         req.user.email,
      bizName:       bizName,
      university:    university,
      category:      category,
      description:   description,
      whatsApp:      whatsApp,
      refCode:       refCode,
      paymentRef:    paymentRef,
      paymentStatus: paymentRef ? 'paid' : 'pending',
      status:        'pending'
    });

    console.log('[Vendor] [OK] Created! ID:', vendor._id);

    await User.findByIdAndUpdate(req.user._id, { role: 'vendor' });
    console.log('[Vendor] User role -> vendor');

    if (refCode) {
      await creditAmbassador(refCode, vendor._id, bizName);
    }

    return res.status(201).json({
      success: true,
      message: 'Vendor registration submitted! Pending admin approval.',
      vendor:  vendor
    });

  } catch (err) {
    console.error('[Vendor] registerVendor error:', err.message);
    console.error('[Vendor] stack:', err.stack);
    return res.status(500).json({
      success: false,
      message: 'Registration failed: ' + err.message
    });
  }
};

// ================================================
//   ADD PRODUCT - Protected
//   POST /api/vendors/products
// ================================================

const addProduct = async function (req, res) {
  try {
    var vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) {
      return res.status(404).json({
        success: false, message: 'Vendor profile not found.'
      });
    }

    var name        = (req.body.name        || '').trim();
    var price       = parseFloat(req.body.price) || 0;
    var description = (req.body.description || '').trim();
    var images = [];
    var video  = '';

    // Up to 4 images per product.
    if (req.files && req.files.images && req.files.images.length > 0) {
      var filesToUpload = req.files.images.slice(0, 4);
      var uploadResults = await Promise.all(
        filesToUpload.map(function (f) {
          return uploadToCloudinary(f.buffer, 'imc/products', 'image');
        })
      );
      images = uploadResults.map(function (r) { return r.secure_url; });
    }

    if (req.files && req.files.video && req.files.video[0]) {
      var vidRes = await uploadToCloudinary(
        req.files.video[0].buffer, 'imc/products', 'video'
      );
      video = vidRes.secure_url;
    }

    var category = (req.body.category || vendor.category).trim();

    if (!name || !price || !description) {
      return res.status(400).json({
        success: false,
        message: 'Name, price and description are required.'
      });
    }
    if (images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please upload at least one product image.'
      });
    }

    vendor.products.push({
      name, price, description, video, category,
      images: images,
      image:  images[0]
    });
    await vendor.save();

    try {
      var emailService = require('../utils/emailService');
      emailService.sendVendorConfirmation(
        req.user.email,
        req.user.firstName || 'Vendor',
        vendor.bizName
      ).then(function (r) {
        console.log('[Vendor] Confirmation email:', r.success ? 'sent' : 'failed');
      });
    } catch (e) {
      console.log('[Vendor] Email error:', e.message);
    }

    var added = vendor.products[vendor.products.length - 1];
    return res.status(201).json({
      success: true,
      message: 'Product added!',
      product: added,
      total:   vendor.products.length
    });
  } catch (err) {
    console.error('[Vendor] addProduct:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
//   DELETE PRODUCT - Protected
//   DELETE /api/vendors/products/:productId
// ================================================

const deleteProduct = async function (req, res) {
  try {
    var vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }

    var idx = vendor.products.findIndex(function (p) {
      return p._id.toString() === req.params.productId;
    });

    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    vendor.products.splice(idx, 1);
    await vendor.save();

    return res.json({ success: true, message: 'Product deleted.', total: vendor.products.length });
  } catch (err) {
    console.error('[Vendor] deleteProduct:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
//   GET VENDOR BY ID - Public
//   GET /api/vendors/:id
// ================================================

const getVendorById = async function (req, res) {
  try {
    var vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }
    vendor.profileViews = (vendor.profileViews || 0) + 1;
    await vendor.save();
    return res.json({ success: true, vendor: vendor });
  } catch (err) {
    console.error('[Vendor] getVendorById:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
//   CREDIT AMBASSADOR HELPER
// ================================================

async function creditAmbassador(refCode, vendorId, bizName) {
  try {
    var Ambassador = require('../models/Ambassador');
    var amb = await Ambassador.findOne({ refCode: refCode });
    if (!amb) {
      console.log('[Vendor] Referral code not found:', refCode);
      return;
    }
    amb.referrals.push({
      vendorId:   vendorId,
      vendorName: bizName,
      commission: 2000
    });
    amb.earnings += 2000;
    await amb.save();
    console.log('[Vendor] [OK] Ambassador credited:', amb.fullName, '+ NGN 2000');
  } catch (err) {
    console.error('[Vendor] creditAmbassador error:', err.message);
  }
}

// ================================================
//   UPDATE VENDOR PROFILE
//   PUT /api/vendors/update
// ================================================

async function updateVendorProfile(req, res) {
  try {
    var vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }

    var updates = {};
    if (req.body.bizName)        updates.bizName        = req.body.bizName.trim();
    if (req.body.description)    updates.description    = req.body.description.trim();
    if (req.body.whatsApp)       updates.whatsApp       = req.body.whatsApp.trim();
    if (req.body.phone)          updates.phone          = req.body.phone.trim();
    if (req.body.category)       updates.category       = req.body.category.trim();
    if (req.body.campusLocation) updates.campusLocation = req.body.campusLocation.trim();

    if (req.body.instagram || req.body.facebook || req.body.twitter || req.body.tiktok) {
      updates.socialMedia = {
        instagram: (req.body.instagram || vendor.socialMedia.instagram || '').trim(),
        facebook:  (req.body.facebook  || vendor.socialMedia.facebook  || '').trim(),
        twitter:   (req.body.twitter   || vendor.socialMedia.twitter   || '').trim(),
        tiktok:    (req.body.tiktok    || vendor.socialMedia.tiktok    || '').trim()
      };
    }

    if (req.files && req.files.logo && req.files.logo[0]) {
      var logoRes = await uploadToCloudinary(req.files.logo[0].buffer, 'imc/vendor-profiles', 'image');
      updates.profilePicture = logoRes.secure_url;
    }
    if (req.files && req.files.cover && req.files.cover[0]) {
      var coverRes = await uploadToCloudinary(req.files.cover[0].buffer, 'imc/vendor-covers', 'image');
      updates.coverImage = coverRes.secure_url;
    }

    var updated = await Vendor.findByIdAndUpdate(vendor._id, updates, { new: true });

    return res.json({ success: true, message: 'Vendor profile updated.', vendor: updated });
  } catch (err) {
    console.error('[Vendor] updateVendorProfile error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   UPLOAD VENDOR PROFILE PICTURE
//   PUT /api/vendors/profile-picture
//   Requires: login token, vendor exists
// ================================================

const uploadProfilePicture = async function (req, res) {
  try {
    var vendor = await Vendor.findOne({ user: req.user._id });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided.'
      });
    }

    var result = await uploadToCloudinary(
      req.file.buffer,
      'imc/vendor-profiles',
      'image'
    );

    vendor.profilePicture = result.secure_url;
    await vendor.save();

    return res.status(200).json({
      success: true,
      message: 'Profile picture updated!',
      profilePicture: vendor.profilePicture
    });

  } catch (err) {
    console.error('Upload profile picture error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Could not upload picture: ' + err.message
    });
  }
};

const Notification = require('../models/Notification');

// ================================================
//   LOG PRODUCT ORDER LEAD (when customer clicks Order)
//   POST /api/vendors/products/:productId/lead
//   Public - no login required to express interest
// ================================================

const logProductLead = async function (req, res) {
  try {
    var vendor = await Vendor.findOne({
      'products._id': req.params.productId
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    var product = vendor.products.find(function (p) {
      return p._id.toString() === req.params.productId;
    });

 var customerName = (req.body.customerName || 'A customer').trim();

    if (product) product.orders = (product.orders || 0) + 1;
    await vendor.save();

    // NOTE: the Notification schema requires `recipient` (not `user`) and
    // uses `isRead` (not `read`) — this call was silently failing validation
    // before, which is why no order-lead notifications were ever appearing
    // anywhere (vendor bell, admin dashboard).
    await Notification.create({
      recipient: vendor.user,
      type:      'order_lead',
      title:     'New Order Interest!',
      message:   customerName + ' is interested in "' + (product ? product.name : 'your product') + '"',
      link:      'vendor-dashboard.html',
      icon:      '🛍️',
      isRead:    false
    });

    return res.status(200).json({
      success: true,
      message: 'Vendor notified.'
    });

  } catch (err) {
    console.error('Log product lead error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Could not log lead: ' + err.message
    });
  }
};

// ================================================
//   LOG PRODUCT CLICK (product page view)
//   POST /api/vendors/products/:productId/click
//   Public
// ================================================

const logProductClick = async function (req, res) {
  try {
    var vendor = await Vendor.findOne({ 'products._id': req.params.productId });
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    var product = vendor.products.find(function (p) {
      return p._id.toString() === req.params.productId;
    });
    if (product) product.clicks = (product.clicks || 0) + 1;
    await vendor.save();
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Log product click error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
//   RATE VENDOR
//   POST /api/vendors/:id/rate  — Protected, one rating per user
// ================================================

const rateVendor = async function (req, res) {
  try {
    var value = parseInt(req.body.value);
    if (!value || value < 1 || value > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be 1-5.' });
    }

    var vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }

    var existing = vendor.ratings.find(function (r) {
      return r.user.toString() === req.user._id.toString();
    });

    if (existing) {
      existing.value = value;
    } else {
      vendor.ratings.push({ user: req.user._id, value: value });
    }

    var total = vendor.ratings.reduce(function (sum, r) { return sum + r.value; }, 0);
    vendor.ratingCount = vendor.ratings.length;
    vendor.avgRating   = vendor.ratingCount ? (total / vendor.ratingCount) : 0;

    await vendor.save();

    return res.json({
      success:     true,
      avgRating:   vendor.avgRating,
      ratingCount: vendor.ratingCount
    });

  } catch (err) {
    console.error('Rate vendor error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};


module.exports = {
  getAllVendors,
  getMyVendorProfile,
  getAllProducts,
  registerVendor,
  addProduct,
  deleteProduct,
  getVendorById,
  uploadProfilePicture,
  updateVendorProfile,
  logProductLead,
  logProductClick,
  rateVendor
};   