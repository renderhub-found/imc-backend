'use strict';

// Load cloudinary v2
var cloudinary = require('cloudinary').v2;

console.log('[Cloudinary] Initializing...');

var CLOUD_NAME  = process.env.CLOUDINARY_dozmwweuo;
var API_KEY     = process.env.CLOUDINARY_735185651841353;
var API_SECRET  = process.env.CLOUDINARY_5T3PI7-agMD-P-vLTrFZmx1d8E4;

var configured = false;

if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  console.warn('[Cloudinary] ⚠️  Missing environment variables:');
  if (!CLOUD_NAME) console.warn('  - CLOUDINARY_CLOUD_NAME');
  if (!API_KEY)    console.warn('  - CLOUDINARY_API_KEY');
  if (!API_SECRET) console.warn('  - CLOUDINARY_API_SECRET');
  console.warn('[Cloudinary] Image uploads will fail until these are set.');
} else {
  // Configure ONCE
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key:    API_KEY,
    api_secret: API_SECRET,
    secure:     true
  });

  configured = true;
  console.log('[Cloudinary] ✅ Configured. Cloud:', CLOUD_NAME);
}

// ================================================
//   TEST CONNECTION
// ================================================

async function testConnection() {
  if (!configured) {
    console.warn('[Cloudinary] Cannot test: not configured');
    return false;
  }

  try {
    var result = await cloudinary.api.ping();
    console.log('[Cloudinary] ✅ Ping OK. Status:', result.status);
    return true;
  } catch (err) {
    console.error('[Cloudinary] ❌ Ping failed:', err.message);
    return false;
  }
}

// ================================================
//   UPLOAD FROM BUFFER
// ================================================

async function uploadBuffer(buffer, options) {
  if (!configured) {
    throw new Error('Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.');
  }

  return new Promise(function (resolve, reject) {
    var opts = Object.assign({
      resource_type: 'image',
      folder:        'imc'
    }, options || {});

    var stream = cloudinary.uploader.upload_stream(opts, function (err, result) {
      if (err) {
        console.error('[Cloudinary] Upload stream error:', err.message);
        return reject(err);
      }
      console.log('[Cloudinary] ✅ Uploaded:', result.secure_url);
      resolve(result);
    });

    stream.end(buffer);
  });
}

// ================================================
//   DELETE IMAGE
// ================================================

async function deleteImage(publicId) {
  if (!configured) return;

  try {
    var result = await cloudinary.uploader.destroy(publicId);
    console.log('[Cloudinary] Deleted:', publicId);
    return result;
  } catch (err) {
    console.error('[Cloudinary] Delete error:', err.message);
  }
}

module.exports = {
  cloudinary,
  configured,
  testConnection,
  uploadBuffer,
  deleteImage
};