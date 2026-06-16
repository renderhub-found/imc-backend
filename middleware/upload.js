'use strict';

var multer   = require('multer');
var path     = require('path');
var crypto   = require('crypto');

var cloudinaryConfig = require('../config/cloudinary');
var cloudinary       = cloudinaryConfig.cloudinary;

// ================================================
//   ACCEPTED MIME TYPES
// ================================================

var ACCEPTED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
];

var ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// ================================================
//   FILE FILTER — security check
// ================================================

function fileFilter(req, file, cb) {
  console.log('[Upload] File received:', file.originalname, '| MIME:', file.mimetype);

  // Check MIME type
  if (!ACCEPTED_TYPES.includes(file.mimetype)) {
    console.log('[Upload] Rejected: unsupported MIME type');
    return cb(new Error(
      'Only JPG, PNG and WebP images are allowed. Got: ' + file.mimetype
    ), false);
  }

  // Check file extension
  var ext = path.extname(file.originalname).toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    console.log('[Upload] Rejected: unsupported extension:', ext);
    return cb(new Error(
      'Invalid file extension: ' + ext
    ), false);
  }

  // Prevent path traversal
  var safeName = path.basename(file.originalname);
  if (safeName !== file.originalname.replace(/.*[/\\]/, '')) {
    return cb(new Error('Invalid filename'), false);
  }

  console.log('[Upload] File accepted:', file.originalname);
  cb(null, true);
}

// ================================================
//   USE MEMORY STORAGE
//   We upload to Cloudinary directly from buffer
//   Never write to disk
// ================================================

var storage = multer.memoryStorage();

// ================================================
//   MULTER INSTANCE
// ================================================

var upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize:  5 * 1024 * 1024,  // 5MB
    files:     1,                  // 1 file at a time
    fieldSize: 10 * 1024 * 1024   // 10MB field size
  }
});

// ================================================
//   CLOUDINARY UPLOAD MIDDLEWARE
//   Runs AFTER multer — uploads buffer to Cloudinary
// ================================================

function uploadToCloudinary(folder) {
  return async function (req, res, next) {
    if (!req.file) {
      // No file uploaded — continue without error
      return next();
    }

    try {
      console.log('[Upload] Uploading to Cloudinary...');
      console.log('[Upload] Folder:', folder || 'imc/general');
      console.log('[Upload] Size:', req.file.size, 'bytes');

      // Generate safe unique public ID
      var ext      = path.extname(req.file.originalname).toLowerCase().replace('.', '');
      var safeName = crypto.randomBytes(16).toString('hex');
      var publicId = (folder || 'imc/general') + '/' + safeName;

      var result = await cloudinary.uploader.upload_stream_promise
        ? uploadViaStream(req.file.buffer, publicId, ext)
        : uploadDirect(req.file.buffer, publicId, ext);

      console.log('[Upload] ✅ Uploaded:', result.secure_url);

      // Attach to request for controllers
      req.cloudinaryUrl      = result.secure_url;
      req.cloudinaryPublicId = result.public_id;

      next();

    } catch (err) {
      console.error('[Upload] Cloudinary error:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Image upload failed: ' + err.message
      });
    }
  };
}

function uploadViaStream(buffer, publicId, ext) {
  var cloudinaryConfig = require('../config/cloudinary');
  return cloudinaryConfig.uploadBuffer(buffer, {
    public_id:     publicId,
    format:        ext,
    folder:        undefined, // already in publicId
    transformation: [
      { width: 1200, height: 900, crop: 'limit' },
      { quality: 'auto:good' },
      { fetch_format: 'auto' }
    ]
  });
}

function uploadDirect(buffer, publicId, ext) {
  var cloudinaryConfig = require('../config/cloudinary');
  return cloudinaryConfig.uploadBuffer(buffer, {
    public_id:     publicId,
    format:        ext,
    transformation: [
      { width: 1200, height: 900, crop: 'limit' },
      { quality: 'auto:good' },
      { fetch_format: 'auto' }
    ]
  });
}

// ================================================
//   ERROR HANDLER FOR MULTER
// ================================================

function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.'
      });
    }
    return res.status(400).json({
      success: false,
      message: 'Upload error: ' + err.message
    });
  }

  if (err && err.message) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  next(err);
}

// ================================================
//   EXPORTS
// ================================================

module.exports = {
  // Single image upload middleware
  single: function (fieldName, folder) {
    return [
      upload.single(fieldName),
      handleUploadErrors,
      uploadToCloudinary(folder)
    ];
  },

  // Just multer without Cloudinary (for base64 handling)
  multerSingle: function (fieldName) {
    return [upload.single(fieldName), handleUploadErrors];
  },

  handleUploadErrors: handleUploadErrors
};