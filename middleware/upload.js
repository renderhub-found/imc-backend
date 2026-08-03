// ================================================
//   UPLOAD MIDDLEWARE — middleware/upload.js
//   Multer (memory) + Cloudinary upload helper
// ================================================

const multer     = require('multer');
const { uploadBuffer } = require('../config/cloudinary');

// Store files in memory temporarily before sending to Cloudinary
const storage = multer.memoryStorage();

const imageFilter = function (req, file, cb) {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed.'), false);
  }
};

const mediaFilter = function (req, file, cb) {
  if (
    file.mimetype.startsWith('image/') ||
    file.mimetype.startsWith('video/')
  ) {
    cb(null, true);
  } else {
    cb(new Error('Only image or video files are allowed.'), false);
  }
};

// Learning Hub materials: PDFs/docs for the main file, images for the cover.
const materialFilter = function (req, file, cb) {
  var allowed = [
    'image/', 'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];
  var ok = allowed.some(function (prefix) {
    return file.mimetype.indexOf(prefix) === 0;
  });
  if (ok) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, Word, PowerPoint, or image files are allowed.'), false);
  }
};

const uploadImage = multer({
  storage:   storage,
  fileFilter: imageFilter,
  limits:    { fileSize: 5 * 1024 * 1024 } // 5MB
});

const uploadMedia = multer({
  storage:    storage,
  fileFilter: mediaFilter,
  limits:     { fileSize: 50 * 1024 * 1024 } // 50MB (covers video)
});

const uploadMaterial = multer({
  storage:    storage,
  fileFilter: materialFilter,
  limits:     { fileSize: 50 * 1024 * 1024 } // 50MB (covers large PDFs)
});

// ---- Helper: upload a buffer to Cloudinary ----
function uploadToCloudinary(fileBuffer, folder, resourceType) {
  return uploadBuffer(fileBuffer, {
    folder:        folder,
    resource_type: resourceType || 'image'
  });
}

module.exports = {
  uploadImage,
  uploadMedia,
  uploadMaterial,
  uploadToCloudinary
};