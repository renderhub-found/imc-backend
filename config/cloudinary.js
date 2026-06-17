'use strict';

var cloudinary = require('cloudinary').v2;

console.log('[Cloudinary] Initializing...');

var cloudName  = process.env.CLOUDINARY_CLOUD_NAME  || '';
var apiKey     = process.env.CLOUDINARY_API_KEY      || '';
var apiSecret  = process.env.CLOUDINARY_API_SECRET   || '';

var configured = false;

if (!cloudName || !apiKey || !apiSecret) {
  console.warn('[Cloudinary] Missing env vars:');
  if (!cloudName)  console.warn('  CLOUDINARY_CLOUD_NAME');
  if (!apiKey)     console.warn('  CLOUDINARY_API_KEY');
  if (!apiSecret)  console.warn('  CLOUDINARY_API_SECRET');
} else {
  cloudinary.config({
    cloud_name: cloudName,
    api_key:    apiKey,
    api_secret: apiSecret,
    secure:     true
  });
  configured = true;
  console.log('[Cloudinary] Configured. Cloud:', cloudName);
}

async function testConnection() {
  if (!configured) return false;
  try {
    var r = await cloudinary.api.ping();
    console.log('[Cloudinary] Ping OK:', r.status);
    return true;
  } catch (err) {
    console.error('[Cloudinary] Ping failed:', err.message);
    return false;
  }
}

async function uploadBuffer(buffer, options) {
  if (!configured) throw new Error('Cloudinary not configured');

  return new Promise(function (resolve, reject) {
    var opts = Object.assign({ resource_type: 'image', folder: 'imc' }, options || {});

    var stream = cloudinary.uploader.upload_stream(opts, function (err, result) {
      if (err) return reject(err);
      resolve(result);
    });

    stream.end(buffer);
  });
}

async function deleteImage(publicId) {
  if (!configured) return;
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('[Cloudinary] Delete error:', err.message);
  }
}

module.exports = { cloudinary, configured, testConnection, uploadBuffer, deleteImage };