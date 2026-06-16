'use strict';

var cloudinary = require('cloudinary').v2;

console.log('[Cloudinary] Initializing...');

// Verify all required env vars exist
var required = [
  'CLOUDINARY_dozmwweuo',
  'CLOUDINARY_735185651841353',
  'CLOUDINARY_5T3PI7-agMD-P-vLTrFZmx1d8E4'
];

var missing = required.filter(function (key) {
  return !process.env[key];
});

if (missing.length > 0) {
  console.error('[Cloudinary] ❌ Missing environment variables:', missing.join(', '));
  console.error('[Cloudinary] Add them to your .env file and Render environment.');
  // Do not crash server — uploads will fail gracefully
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure:     true
  });

  console.log('[Cloudinary] ✅ Configured. Cloud:', process.env.CLOUDINARY_CLOUD_NAME);
}

// ================================================
//   TEST CONNECTION
// ================================================

async function testConnection() {
  try {
    var result = await cloudinary.api.ping();
    console.log('[Cloudinary] ✅ Connection verified. Status:', result.status);
    return true;
  } catch (err) {
    console.error('[Cloudinary] ❌ Connection failed:', err.message);
    return false;
  }
}

// ================================================
//   UPLOAD BUFFER DIRECTLY
//   Used when multer is not in the pipeline
// ================================================

async function uploadBuffer(buffer, options) {
  return new Promise(function (resolve, reject) {
    var uploadOptions = Object.assign({
      folder:   'imc',
      resource_type: 'image'
    }, options || {});

    var stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      function (err, result) {
        if (err) return reject(err);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

// ================================================
//   DELETE IMAGE
// ================================================

async function deleteImage(publicId) {
  try {
    var result = await cloudinary.uploader.destroy(publicId);
    console.log('[Cloudinary] Deleted:', publicId, '| Result:', result.result);
    return result;
  } catch (err) {
    console.error('[Cloudinary] Delete error:', err.message);
    throw err;
  }
}

module.exports = {
  cloudinary,
  testConnection,
  uploadBuffer,
  deleteImage
};