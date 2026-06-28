'use strict';
const { uploadToCloudinary } = require('../middleware/upload');
const Vendor = require('../models/Vendor');
const User   = require('../models/User');

// ================================================
//   GET ALL VENDORS — Public
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
//   GET ALL PRODUCTS — Public
//   GET /api/vendors/products/all
// ================================================

const getAllProducts = async function (req, res) {
  try {
    var vendors = await Vendor.find({ status: 'approved' })
      .select('bizName university category products');

    var all = [];
    vendors.forEach(function (v) {
      v.products.forEach(function (p) {
        all.push({
          _id:        p._id,
          name:       p.name,
          price:      p.price,
          description:p.description,
          image:      p.image,
          video:      p.video,
          category:   p.category || v.category,
          vendorId:   v._id,
          vendorName: v.bizName,
          vendorWhatsAPP:  v.whatsApp,
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
//   GET MY VENDOR PROFILE — Protected
//   GET /api/vendors/my-profile
// ================================================

const getMyVendorProfile = async function (req, res) {
  try {
    console.log('[Vendor] getMyVendorProfile — user:', req.user.email);

    var vendor = await Vendor.findOne({ user: req.user._id });

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
//   REGISTER VENDOR — Protected
//   POST /api/vendors/register
// ================================================

const registerVendor = async function (req, res) {
  try {
    console.log('[Vendor] registerVendor — user:', req.user.email);
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

    console.log('[Vendor] ✅ Created! ID:', vendor._id);

    await User.findByIdAndUpdate(req.user._id, { role: 'vendor' });
    console.log('[Vendor] User role → vendor');

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
//   ADD PRODUCT — Protected
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
    var image = '';
    var video = '';

    if (req.files && req.files.image && req.files.image[0]) {
      var imgRes = await uploadToCloudinary(
        req.files.image[0].buffer, 'imc/products', 'image'
      );
      image = imgRes.secure_url;
    }

    if (req.files && req.files.video && req.files.video[0]) {
      var vidRes = await uploadToCloudinary(
        req.files.video[0].buffer, 'imc/products', 'video'
      );
      video = vidRes.secure_url;
    }
    
    var category    = (req.body.category    || vendor.category).trim();

    if (!name || !price || !description) {
      return res.status(400).json({
        success: false,
        message: 'Name, price and description are required.'
      });
    }

    vendor.products.push({ name, price, description, image, video, category });
    await vendor.save();

    // Send confirmation email (non-blocking)
try {
  var emailService = require('../utils/emailService');
  emailService.sendVendorConfirmation(
    req.user.email,
    req.user.firstName || 'Vendor',
    bizName
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
//   DELETE PRODUCT — Protected
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
//   GET VENDOR BY ID — Public
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
    console.log('[Vendor] ✅ Ambassador credited:', amb.fullName, '+ ₦2000');
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
    if (req.body.bizName)     updates.bizName     = req.body.bizName.trim();
    if (req.body.description) updates.description = req.body.description.trim();
    if (req.body.whatsApp)    updates.whatsApp    = req.body.whatsApp.trim();
    if (req.body.category)    updates.category    = req.body.category.trim();
    if (req.body.campusLocation) updates.campusLocation = req.body.campusLocation.trim();

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
//   Public — no login required to express interest
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

    await Notification.create({
      user:               vendor.user,
      type:               'order_lead',
      title:              'New Order Interest!',
      message:            customerName + ' is interested in "' + (product ? product.name : 'your product') + '"',
      relatedProductId:   req.params.productId,
      relatedProductName: product ? product.name : '',
      customerName:       customerName,
      read:               false
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


module.exports = {
  getAllVendors:       getAllVendors,
  getAllProducts:      getAllProducts,
  getMyVendorProfile: getMyVendorProfile,
  registerVendor:     registerVendor,
  addProduct:         addProduct,
  deleteProduct:      deleteProduct,
  getVendorById:      getVendorById,
  updateVendorProfile: updateVendorProfile,
  uploadProfilePicture: uploadProfilePicture
  logProductLead:     logProductLead,
};