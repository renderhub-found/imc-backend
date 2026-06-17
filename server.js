'use strict';

var express  = require('express');
var mongoose = require('mongoose');
var cors     = require('cors');
var dotenv   = require('dotenv');

dotenv.config();

// ================================================
//   NON-BLOCKING STARTUP CHECKS
//   Server starts even if these fail
// ================================================

// Test Cloudinary
setImmediate(function () {
  try {
    var cloudCfg = require('./config/cloudinary');
    if (cloudCfg.configured) {
      cloudCfg.testConnection().then(function (ok) {
        console.log(ok ? '✅ Cloudinary connected' : '⚠️  Cloudinary ping failed');
      }).catch(function (err) {
        console.warn('[Cloudinary] Startup test error:', err.message);
      });
    } else {
      console.warn('⚠️  Cloudinary not configured — set CLOUDINARY_* env vars');
    }
  } catch (err) {
    console.warn('[Cloudinary] Init error:', err.message);
  }
});

// Test Email
setImmediate(function () {
  try {
    var emailSvc = require('./utils/emailService');
    emailSvc.verifyTransporter().then(function (ok) {
      console.log(ok ? '✅ Email SMTP connected' : '⚠️  Email SMTP failed — check EMAIL_USER/EMAIL_PASS');
    }).catch(function (err) {
      console.warn('[Email] Startup test error:', err.message);
    });
  } catch (err) {
    console.warn('[Email] Init error:', err.message);
  }
});

// ================================================
//   VERIFY TRANSPORTER
// ================================================

try {
  var emailService = require('./utils/emailService');
  emailService.verifyTransporter().then(function (ok) {
    if (ok) {
      console.log('✅ Email transporter ready');
    } else {
      console.warn('⚠️  Email not configured — forgot password emails will not send');
    }
  });
} catch (emailErr) {
  console.error('❌ Email service error:', emailErr.message);
}

var app  = express();
var PORT = process.env.PORT || 5000;

// ================================================
//   STARTUP CHECK
// ================================================

console.log('');
console.log('========================================');
console.log('   INSIDE MY CAMPUS — BACKEND SERVER   ');
console.log('========================================');
console.log('📦 MongoDB URI: ' +
  (process.env.MONGO_URI || 'NOT SET').replace(/:([^@]+)@/, ':****@'));
console.log('🔑 JWT Secret:  ' + (process.env.JWT_SECRET ? 'Loaded ✅' : 'MISSING ❌'));
console.log('');

if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET not set. Exiting.');
  process.exit(1);
}

// ================================================
//   MIDDLEWARE
// ================================================

// Webhook needs raw body before json parser
app.use(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS
var allowedOrigins = [
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://localhost:3000',
  'https://resilient-ganache-be5b9c.netlify.app',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(function (req, res, next) {
  var origin = req.headers.origin;

  if (origin && allowedOrigins.indexOf(origin) !== -1) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    console.log('OPTIONS preflight for: ' + req.originalUrl);
    return res.status(200).end();
  }

  next();
});

// Request logger
app.use(function (req, res, next) {
  console.log(req.method + ' ' + req.originalUrl +
    ' origin:' + (req.headers.origin || 'none'));
  next();
});

// ================================================
//   HEALTH CHECK
// ================================================

app.get('/api/health', function (req, res) {
  var states = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting'
  };
  res.json({
    success:     true,
    message:     'IMC API is running!',
    database:    states[mongoose.connection.readyState] || 'Unknown',
    dbName:      mongoose.connection.name || 'none',
    environment: process.env.NODE_ENV || 'development',
    timestamp:   new Date().toISOString()
  });
});

// ================================================
//   SAFE ROUTE LOADER
// ================================================

function loadRoute(filePath, mountPath) {
  try {
    var router = require(filePath);
    app.use(mountPath, router);
    console.log('✅ Route loaded: ' + mountPath);
  } catch (err) {
    console.error('❌ Route FAILED: ' + mountPath + ' → ' + err.message);
    console.error('   Stack: ' + err.stack);
  }
}

// ================================================
//   LOAD ALL ROUTES
// ================================================

console.log('--- Loading routes ---');

loadRoute('./routes/auth',        '/api/auth');
loadRoute('./routes/ambassadors', '/api/ambassadors');
loadRoute('./routes/news',        '/api/news');
loadRoute('./routes/courses',     '/api/courses');
// ---- ADMIN ROUTES ----
console.log('MOUNTING_ADMIN_ROUTES...');
try {
  var adminRoutes = require('./routes/admin');
  app.use('/api/admin', adminRoutes);
  console.log('✅ Admin routes mounted');
} catch (err) {
  console.error('❌ Admin routes FAILED:', err.message);
  console.error(err.stack);
}
loadRoute('./routes/payments',    '/api/payments');
loadRoute('./routes/ads',         '/api/ads');
loadRoute('./routes/contact',     '/api/contact');
loadRoute('./routes/events', '/api/events');
loadRoute('./routes/notifications', '/api/notifications');

// Vendor routes inline
(function () {
  try {
    var vExpress  = require('express');
    var vRouter   = vExpress.Router();
    var vCtrl     = require('./controllers/vendorController');
    var authMw    = require('./middleware/auth');

    vRouter.use(function (req, res, next) {
      console.log('[VENDORS]', req.method, req.path);
      next();
    });

    vRouter.get('/products/all', vCtrl.getAllProducts);
    vRouter.get('/my-profile',   authMw.protect, vCtrl.getMyVendorProfile);
    vRouter.post('/register',    authMw.protect, vCtrl.registerVendor);
    vRouter.post('/products',    authMw.protect, vCtrl.addProduct);
    vRouter.delete('/products/:productId', authMw.protect, vCtrl.deleteProduct);
    vRouter.get('/',             vCtrl.getAllVendors);
    vRouter.get('/:id',          vCtrl.getVendorById);

    app.use('/api/vendors', vRouter);
    console.log('✅ Vendor routes inline loaded');
  } catch (err) {
    console.error('❌ Vendor routes FAILED:', err.message);
    console.error('   Stack:', err.stack);
  }
})();

console.log('--- Routes done ---');
console.log('');

// ================================================
//   404 HANDLER
// ================================================

app.use(function (req, res) {
  console.log('404: ' + req.method + ' ' + req.originalUrl);
  res.status(404).json({
    success: false,
    message: 'Route not found: ' + req.method + ' ' + req.originalUrl
  });
});

// ================================================
//   ERROR HANDLER
// ================================================

app.use(function (err, req, res, next) {
  console.error('Server error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// ================================================
//   MONGODB + START SERVER
// ================================================

var MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ FATAL: MONGO_URI not set. Exiting.');
  process.exit(1);
}

var isAtlas = MONGO_URI.includes('mongodb+srv') ||
              MONGO_URI.includes('mongodb.net');

console.log('📡 Connecting to MongoDB (' +
  (isAtlas ? 'Atlas' : 'Local') + ')...');

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: isAtlas ? 30000 : 10000,
  connectTimeoutMS:         isAtlas ? 30000 : 10000,
  socketTimeoutMS:          45000,
  maxPoolSize:              10
})
.then(function () {
  console.log('');
  console.log('✅ MongoDB connected successfully!');
  console.log('📂 Database: ' + mongoose.connection.name);
  console.log('🔗 Host: '     + mongoose.connection.host);
  console.log('');

  app.listen(PORT, function () {
    console.log('🚀 Server running on port: ' + PORT);
    console.log('🔍 Health: http://localhost:' + PORT + '/api/health');
    console.log('');
  });
})
.catch(function (err) {
  console.error('❌ MongoDB FAILED:', err.message);
  process.exit(1);
});

mongoose.connection.on('disconnected', function () {
  console.error('⚠️ MongoDB disconnected');
});

module.exports = app;