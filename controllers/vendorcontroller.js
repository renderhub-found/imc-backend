// ================================================
//   VENDOR CONTROLLER
// ================================================

const Vendor = require('../models/Vendor');
const User   = require('../models/User');

// GET /api/vendors
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
      var q    = new RegExp(req.query.search, 'i');
      filter.$or = [
        { bizName: q }, { category: q },
        { university: q }, { description: q }
      ];
    }

    var vendors = await Vendor.find(filter)
      .select('-products')
      .sort({ createdAt: -1 });

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
};

// GET /api/vendors/my-profile
const getMyVendorProfile = async function (req, res) {
  try {
    var vendor = await Vendor.findOne({ user: req.user._id });

    if (!vendor) {
      return res.status(200).json({
        success:  true,
        isVendor: false,
        message:  'Not registered as vendor yet.',
        vendor:   null
      });
    }

    return res.status(200).json({
      success:  true,
      isVendor: true,
      vendor:   vendor
    });
  } catch (err) {
    console.error('Get my vendor error:', err.message);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// GET /api/vendors/products/all
const getAllProducts = async function (req, res) {
  try {
    var vendors = await Vendor.find({ status: 'approved' })
      .select('bizName university category products');

    var allProducts = [];
    vendors.forEach(function (v) {
      v.products.forEach(function (p) {
        allProducts.push({
          _id:         p._id,
          name:        p.name,
          price:       p.price,
          description: p.description,
          image:       p.image,
          video:       p.video,
          category:    p.category || v.category,
          vendorId:    v._id,
          vendorName:  v.bizName,
          university:  v.university
        });
      });
    });

    return res.status(200).json({
      success:  true,
      count:    allProducts.length,
      products: allProducts
    });
  } catch (err) {
    console.error('Get all products error:', err.message);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// POST /api/vendors/register
const registerVendor = async function (req, res) {
  try {
    var userId = req.user._id;

    console.log('[registerVendor] Called by:', req.user.email);
    console.log('[registerVendor] Body:', JSON.stringify(req.body));

    // Check if already a vendor
    var existingVendor = await Vendor.findOne({ user: userId });

    if (existingVendor) {
      console.log('[registerVendor] Already a vendor:', existingVendor.bizName);

      // If already paid and exists — just return it
      return res.status(200).json({
        success: true,
        message: 'Already registered as a vendor.',
        vendor:  existingVendor,
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

    // Validate required fields
    var missing = [];
    if (!fullName)    missing.push('fullName');
    if (!bizName)     missing.push('bizName');
    if (!university)  missing.push('university');
    if (!category)    missing.push('category');
    if (!description) missing.push('description');
    if (!whatsApp)    missing.push('whatsApp');

    if (missing.length > 0) {
      console.log('[registerVendor] Missing fields:', missing);
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: ' + missing.join(', ')
      });
    }

    console.log('[registerVendor] Creating vendor document...');

    var vendor = await Vendor.create({
      user:          userId,
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

    console.log('[registerVendor] Vendor created! ID:', vendor._id);

    // Update user role to vendor
    await User.findByIdAndUpdate(userId, { role: 'vendor' });
    console.log('[registerVendor] User role updated to vendor');

    // Credit ambassador referral
    if (refCode) {
      try {
        var Ambassador = require('../models/Ambassador');
        var amb = await Ambassador.findOne({ refCode: refCode });
        if (amb) {
          amb.referrals.push({
            vendorId:   vendor._id,
            vendorName: bizName,
            commission: 2000
          });
          amb.earnings += 2000;
          await amb.save();
          console.log('[registerVendor] Ambassador credited:', amb.fullName);
        }
      } catch (refErr) {
        console.log('[registerVendor] Referral credit failed:', refErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Vendor registration submitted! Pending admin approval.',
      vendor:  vendor
    });

  } catch (err) {
    console.error('[registerVendor] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Vendor registration failed: ' + err.message
    });
  }
};

// POST /api/vendors/products
const addProduct = async function (req, res) {
  try {
    var vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found.'
      });
    }

    var name        = (req.body.name        || '').trim();
    var price       = parseFloat(req.body.price) || 0;
    var description = (req.body.description || '').trim();
    var image       = (req.body.image       || '').trim();
    var video       = (req.body.video       || '').trim();
    var category    = (req.body.category    || vendor.category).trim();

    if (!name || !price || !description) {
      return res.status(400).json({
        success: false,
        message: 'Name, price and description are required.'
      });
    }

    vendor.products.push({
      name:        name,
      price:       price,
      description: description,
      image:       image,
      video:       video,
      category:    category
    });

    await vendor.save();

    var added = vendor.products[vendor.products.length - 1];

    return res.status(201).json({
      success:       true,
      message:       'Product added successfully!',
      product:       added,
      totalProducts: vendor.products.length
    });
  } catch (err) {
    console.error('Add product error:', err.message);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// DELETE /api/vendors/products/:productId
const deleteProduct = async function (req, res) {
  try {
    var vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) {
      return res.status(404).json({
        success: false, message: 'Vendor not found.'
      });
    }

    var idx = vendor.products.findIndex(function (p) {
      return p._id.toString() === req.params.productId;
    });

    if (idx === -1) {
      return res.status(404).json({
        success: false, message: 'Product not found.'
      });
    }

    vendor.products.splice(idx, 1);
    await vendor.save();

    return res.status(200).json({
      success: true,
      message: 'Product deleted.',
      totalProducts: vendor.products.length
    });
  } catch (err) {
    console.error('Delete product error:', err.message);
    return res.status(500).json({
      success: false, message: err.message
    });
  }
};

// GET /api/vendors/:id
const getVendorById = async function (req, res) {
  try {
    var vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({
        success: false, message: 'Vendor not found.'
      });
    }
    vendor.profileViews = (vendor.profileViews || 0) + 1;
    await vendor.save();
    return res.status(200).json({ success: true, vendor: vendor });
  } catch (err) {
    console.error('Get vendor by id error:', err.message);
    return res.status(500).json({
      success: false, message: err.message
    });
  }
};
// PUT /api/vendors/update
const updateVendorProfile = async function (req, res) {
  try {
    var vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found.'
      });
    }

    var updates = {};
    if (req.body.bizName)     updates.bizName     = req.body.bizName.trim();
    if (req.body.description) updates.description = req.body.description.trim();
    if (req.body.whatsApp)    updates.whatsApp    = req.body.whatsApp.trim();
    if (req.body.category)    updates.category    = req.body.category.trim();

    var updated = await Vendor.findByIdAndUpdate(
      vendor._id,
      updates,
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Vendor profile updated.',
      vendor:  updated
    });
  } catch (err) {
    console.error('Update vendor profile error:', err.message);
    return res.status(500).json({
      success: false,
      message: err.message
    });
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
  updateVendorProfile
};