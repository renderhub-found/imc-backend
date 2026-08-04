'use strict';

// ================================================
//   LEARNING HUB CONTROLLER — controllers/learningController.js
// ================================================

var LearningMaterial = require('../models/LearningMaterial');
var { uploadToCloudinary } = require('../middleware/upload');
var { sendMaterialPurchaseConfirmation } = require('../utils/emailService');

var DEFAULT_PRICE_PER_PAGE = 18; // midpoint of the brief's ₦15-20/page range

function computePrice(body) {
  var isFree = body.isFree === 'true' || body.isFree === true;
  if (isFree) return { isFree: true, price: 0 };

  var pricingMode = body.pricingMode === 'auto_per_page' ? 'auto_per_page' : 'fixed';

  if (pricingMode === 'auto_per_page') {
    var pageCount    = parseInt(body.pageCount) || 0;
    var pricePerPage = parseFloat(body.pricePerPage) || DEFAULT_PRICE_PER_PAGE;
    var price        = pageCount * pricePerPage;
    return { isFree: false, pricingMode: 'auto_per_page', pageCount: pageCount, pricePerPage: pricePerPage, price: price };
  }

  return { isFree: false, pricingMode: 'fixed', price: parseFloat(body.price) || 0 };
}

// ================================================
//   GET /api/learning — public browse + search + filter
// ================================================
async function getAllMaterials(req, res) {
  try {
    var filter = { status: 'approved' };

    if (req.query.materialType) filter.materialType = req.query.materialType;
    if (req.query.university)   filter.university   = req.query.university;
    if (req.query.faculty)      filter.faculty       = req.query.faculty;
    if (req.query.department)   filter.department    = req.query.department;
    if (req.query.level)        filter.level         = req.query.level;
    if (req.query.courseCode)   filter.courseCode    = new RegExp(req.query.courseCode, 'i');
    if (req.query.semester)     filter.semester       = req.query.semester;
    if (req.query.free === 'true')  filter.isFree = true;
    if (req.query.paid === 'true')  filter.isFree = false;

    if (req.query.search) {
      var q = new RegExp(req.query.search, 'i');
      filter.$or = [{ title: q }, { description: q }, { courseCode: q }, { tags: q }];
    }

    var sortMap = {
      newest:         { createdAt: -1 },
      mostDownloaded: { downloadCount: -1 },
      priceAsc:       { price: 1 },
      priceDesc:      { price: -1 }
    };
    var sort = sortMap[req.query.sort] || sortMap.newest;

    var materials = await LearningMaterial.find(filter)
      .select('-purchases -downloads')
      .sort(sort)
      .limit(200);

    // Never expose fileUrl for paid items until the user has purchased it.
    var out = materials.map(function (m) {
      var obj = m.toObject();
      if (!obj.isFree) delete obj.fileUrl;
      return obj;
    });

    return res.json({ success: true, count: out.length, materials: out });
  } catch (err) {
    console.error('[Learning] getAllMaterials:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   GET /api/learning/:id
// ================================================
async function getMaterialById(req, res) {
  try {
    var material = await LearningMaterial.findById(req.params.id).select('-purchases -downloads');
    if (!material || material.status !== 'approved') {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }
    var obj = material.toObject();
    if (!obj.isFree) delete obj.fileUrl;
    return res.json({ success: true, material: obj });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   POST /api/learning — upload (student or admin)
//   Student submissions go to moderation; admin uploads
//   publish immediately — same pattern News already uses.
// ================================================
async function uploadMaterial(req, res) {
  try {
    var title       = (req.body.title       || '').trim();
    var description = (req.body.description || '').trim();
    var materialType = req.body.materialType;

    var validTypes = ['course', 'ebook', 'past_question', 'lecture_note', 'study_material', 'exam_prep'];
    if (!title || !description || validTypes.indexOf(materialType) === -1) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and a valid materialType are required.'
      });
    }

    if (!req.files || !req.files.file || !req.files.file[0]) {
      return res.status(400).json({ success: false, message: 'A file upload is required.' });
    }

    var fileResult = await uploadToCloudinary(req.files.file[0].buffer, 'imc/learning', 'raw');
    var fileUrl    = fileResult.secure_url;

    var coverUrl = '';
    if (req.files.coverImage && req.files.coverImage[0]) {
      var coverResult = await uploadToCloudinary(req.files.coverImage[0].buffer, 'imc/learning/covers', 'image');
      coverUrl = coverResult.secure_url;
    }

    var isAdmin = req.user.role === 'admin';
    var pricing = computePrice(req.body);

    var material = await LearningMaterial.create({
      materialType:  materialType,
      title:         title,
      description:   description,
      university:    (req.body.university || '').trim(),
      faculty:       (req.body.faculty    || '').trim(),
      department:    (req.body.department || '').trim(),
      level:         (req.body.level      || '').trim(),
      courseCode:    (req.body.courseCode || '').trim(),
      semester:      req.body.semester || '',
      coverImage:    coverUrl,
      fileUrl:       fileUrl,
      instructor:    (req.body.instructor || '').trim(),
      duration:      (req.body.duration   || '').trim(),
      lessons:       parseInt(req.body.lessons) || 0,
      isFree:        pricing.isFree,
      pricingMode:   pricing.pricingMode || 'fixed',
      pricePerPage:  pricing.pricePerPage || 0,
      pageCount:     pricing.pageCount || 0,
      price:         pricing.price,
      uploadedBy:    req.user._id,
      uploaderName:  (req.user.firstName || '') + ' ' + (req.user.lastName || ''),
      uploaderEmail: req.user.email,
      uploaderRole:  isAdmin ? 'admin' : 'student',
      status:        isAdmin ? 'approved' : 'pending',
      tags:          (req.body.tags || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean)
    });

    return res.status(201).json({
      success: true,
      message: isAdmin ? 'Material published!' : 'Submitted for review. An admin will approve it shortly.',
      material: material
    });
  } catch (err) {
    console.error('[Learning] uploadMaterial:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   GRANT ACCESS — shared by the free-download endpoint
//   (called directly) and the paid flow (called from
//   paymentController.processPayment after Paystack
//   verification, exactly like issueTicketForPurchase).
//   Building the paid path in from day one here, rather
//   than bolting it on later — that gap is exactly what
//   broke event ticket purchases earlier in this project.
// ================================================
async function grantMaterialAccess(material, buyer, paymentRef) {
  var alreadyOwns = material.isFree
    ? material.downloads.find(function (d) { return d.userEmail === buyer.email; })
    : material.purchases.find(function (p) { return p.userEmail === buyer.email; });

  if (alreadyOwns) {
    return { alreadyGranted: true, fileUrl: material.fileUrl, title: material.title };
  }

  var buyerName = ((buyer.firstName || '') + ' ' + (buyer.lastName || '')).trim();

  if (material.isFree) {
    material.downloads.push({ user: buyer._id, userEmail: buyer.email });
  } else {
    material.purchases.push({
      user: buyer._id, userEmail: buyer.email, userName: buyerName,
      amount: material.price, paymentRef: paymentRef || ''
    });
  }

  material.downloadCount = (material.downloadCount || 0) + 1;
  await material.save();

  if (!material.isFree) {
    sendMaterialPurchaseConfirmation(buyer.email, buyer.firstName || 'there', {
      title:   material.title,
      amount:  material.price,
      fileUrl: material.fileUrl
    }).catch(function (err) {
      console.error('[Learning] Confirmation email failed:', err.message);
    });
  }

  return { granted: true, fileUrl: material.fileUrl, title: material.title };
}

// ================================================
//   POST /api/learning/:id/free-download — free items only
// ================================================
async function downloadFreeMaterial(req, res) {
  try {
    var material = await LearningMaterial.findById(req.params.id);
    if (!material || material.status !== 'approved') {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }
    if (!material.isFree) {
      return res.status(400).json({ success: false, message: 'This material requires payment.' });
    }

    var result = await grantMaterialAccess(material, req.user, '');
    return res.json({ success: true, fileUrl: result.fileUrl, title: result.title });
  } catch (err) {
    console.error('[Learning] downloadFreeMaterial:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   GET /api/learning/:id/download-url — safe re-fetch
//   for something the user already owns/downloaded
// ================================================
async function getDownloadUrl(req, res) {
  try {
    var material = await LearningMaterial.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    var owns = material.isFree
      ? material.downloads.find(function (d) { return d.userEmail === req.user.email; })
      : material.purchases.find(function (p) { return p.userEmail === req.user.email; });

    if (!owns && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have access to this material.' });
    }

    return res.json({ success: true, fileUrl: material.fileUrl, title: material.title });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   Student dashboard queries
// ================================================
async function getMyUploads(req, res) {
  try {
    var materials = await LearningMaterial.find({ uploadedBy: req.user._id })
      .select('-purchases -downloads')
      .sort({ createdAt: -1 });
    return res.json({ success: true, materials: materials });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getMyDownloads(req, res) {
  try {
    var materials = await LearningMaterial.find({ 'downloads.userEmail': req.user.email })
      .select('title materialType coverImage fileUrl university courseCode');
    return res.json({ success: true, materials: materials });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getMyPurchases(req, res) {
  try {
    var materials = await LearningMaterial.find({ 'purchases.userEmail': req.user.email })
      .select('title materialType coverImage fileUrl university courseCode price');
    return res.json({ success: true, materials: materials });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   ADMIN
// ================================================
async function getAllMaterialsAdmin(req, res) {
  try {
    var filter = {};
    if (req.query.status) filter.status = req.query.status;
    var materials = await LearningMaterial.find(filter)
      .select('-purchases -downloads')
      .sort({ createdAt: -1 });
    return res.json({ success: true, materials: materials });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function updateMaterialStatus(req, res) {
  try {
    var status = req.body.status;
    if (['approved', 'rejected'].indexOf(status) === -1) {
      return res.status(400).json({ success: false, message: 'status must be approved or rejected.' });
    }
    var material = await LearningMaterial.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }
    material.status = status;
    if (status === 'rejected') material.rejectionReason = req.body.reason || '';
    await material.save();
    return res.json({ success: true, message: 'Status updated.', material: material });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function updateMaterial(req, res) {
  try {
    var material = await LearningMaterial.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    var editableFields = [
      'title', 'description', 'university', 'faculty', 'department',
      'level', 'courseCode', 'semester', 'instructor', 'duration', 'featured'
    ];
    editableFields.forEach(function (f) {
      if (req.body[f] !== undefined) material[f] = req.body[f];
    });

    if (req.body.isFree !== undefined || req.body.price !== undefined || req.body.pricingMode !== undefined) {
      var pricing = computePrice(req.body);
      material.isFree       = pricing.isFree;
      material.price        = pricing.price;
      material.pricingMode  = pricing.pricingMode || material.pricingMode;
      material.pricePerPage = pricing.pricePerPage || material.pricePerPage;
      material.pageCount    = pricing.pageCount || material.pageCount;
    }

    await material.save();
    return res.json({ success: true, message: 'Material updated.', material: material });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteMaterial(req, res) {
  try {
    await LearningMaterial.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Material deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getAllMaterials,
  getMaterialById,
  uploadMaterial,
  grantMaterialAccess,
  downloadFreeMaterial,
  getDownloadUrl,
  getMyUploads,
  getMyDownloads,
  getMyPurchases,
  getAllMaterialsAdmin,
  updateMaterialStatus,
  updateMaterial,
  deleteMaterial
};