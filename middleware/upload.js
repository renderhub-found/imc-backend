'use strict';

var multer = require('multer');
var path   = require('path');
var crypto = require('crypto');

var ACCEPTED_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
];

var ACCEPTED_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

// ---- File filter ----
function fileFilter(req, file, cb) {
  console.log('[Upload] File:', file.originalname, '| MIME:', file.mimetype);

  if (!ACCEPTED_MIMES.includes(file.mimetype)) {
    return cb(new Error(
      'Only JPG, PNG and WebP images allowed. Got: ' + file.mimetype
    ), false);
  }

  var ext = path.extname(file.originalname).toLowerCase();
  if (!ACCEPTED_EXTS.includes(ext)) {
    return cb(new Error('Invalid file extension: ' + ext), false);
  }

  cb(null, true);
}

// ---- Memory storage — never write to disk ----
var upload = multer({
  storage:    multer.memoryStorage(),
  fileFilter: fileFilter,
  limits: {
    fileSize:  5 * 1024 * 1024,  // 5MB
    files:     1
  }
});

// ---- Upload to Cloudinary middleware ----
function uploadToCloudinary(folder) {
  return async function (req, res, next) {
    if (!req.file) return next();

    try {
      var cloudinaryConfig = require('../config/cloudinary');

      if (!cloudinaryConfig.configured) {
        console.warn('[Upload] Cloudinary not configured — skipping upload');
        req.cloudinaryUrl      = '';
        req.cloudinaryPublicId = '';
        return next();
      }

      var ext      = path.extname(req.file.originalname).toLowerCase().replace('.', '');
      var safeName = crypto.randomBytes(16).toString('hex');

      var result = await cloudinaryConfig.uploadBuffer(req.file.buffer, {
        folder:    folder || 'imc/general',
        public_id: safeName,
        format:    ext,
        transformation: [
          { width: 1200, height: 900, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ]
      });

      req.cloudinaryUrl      = result.secure_url;
      req.cloudinaryPublicId = result.public_id;

      console.log('[Upload] ✅ Cloudinary URL:', result.secure_url);
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

// ---- Multer error handler ----
function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false, message: 'File too large. Maximum 5MB.'
      });
    }
    return res.status(400).json({ success: false, message: 'Upload error: ' + err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
}

module.exports = {
  single: function (fieldName, folder) {
    return [
      upload.single(fieldName),
      handleUploadErrors,
      uploadToCloudinary(folder)
    ];
  },
  multerSingle: function (fieldName) {
    return [upload.single(fieldName), handleUploadErrors];
  },
  handleUploadErrors: handleUploadErrors
};