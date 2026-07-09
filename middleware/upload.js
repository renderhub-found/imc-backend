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
  uploadToCloudinary
};