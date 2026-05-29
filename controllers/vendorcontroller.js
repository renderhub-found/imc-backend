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
    var existing = await Vendor.findOne({ user: req.user._id });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Already registered as a vendor.',
        vendor:  existing
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

    if (!fullName || !bizName || !university ||
        !category || !description || !whatsApp) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields.'
      });
    }

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

    await User.findByIdAndUpdate(req.user._id, { role: 'vendor' });

    // Credit ambassador referral
    if (refCode) {
      try {
        var Ambassador = require('../models/Ambassador');
        var amb = await Ambassador.findOne({ refCode: refCode });
        if (amb) {
          amb.referrals.push({
            vendorId:   vendor._id,
            vendorName: bizName,
            commission: 500
          });
          amb.earnings += 500;
          await amb.save();
        }
      } catch (refErr) {
        console.log('Referral credit failed:', refErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Vendor registration submitted! Pending admin approval.',
      vendor:  vendor
    });
  } catch (err) {
    console.error('Register vendor error:', err.message);
    return res.status(500).json({
      success: false,
      message: err.message
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