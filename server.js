// ================================================
//   INSIDE MY CAMPUS — server.js
//   Stable version — database connects FIRST
//   then server starts
// ================================================

'use strict';

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const dotenv   = require('dotenv');

// Load environment variables
dotenv.config();

const app       = express();
const PORT      = process.env.PORT      || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/imc_db';
const JWT_SECRET = process.env.JWT_SECRET;

// ---- Safety check ----
if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET is not defined in .env');
  process.exit(1);
}

console.log('');
console.log('========================================');
console.log('   INSIDE MY CAMPUS — BACKEND SERVER   ');
console.log('========================================');
console.log('📦 MongoDB URI: ' + MONGO_URI);
console.log('🔑 JWT Secret:  ' + (JWT_SECRET ? 'Loaded ✅' : 'Missing ❌'));
console.log('');

// ================================================
//   MIDDLEWARE
// ================================================

// Allow both local development and production frontend
var allowedOrigins = [
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://localhost:3000',
  process.env.https://6a26daade5ed4421dbc77fbc--resilient-ganache-be5b9c.netlify.app/
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }

    // In development allow everything
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods:      ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Webhook needs raw body — must come before json parser
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// All other routes use JSON parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---- Request logger (shows every incoming request) ----
app.use(function (req, res, next) {
  console.log('[' + new Date().toLocaleTimeString() + '] ' +
    req.method + ' ' + req.originalUrl);
  next();
});

// ================================================
//   HEALTH CHECK — always works, no DB needed
// ================================================

app.get('/api/health', function (req, res) {
  var dbStates = {
    0: 'Disconnected ❌',
    1: 'Connected ✅',
    2: 'Connecting...',
    3: 'Disconnecting...'
  };
  res.json({
    success:     true,
    message:     'IMC API is running!',
    database:    dbStates[mongoose.connection.readyState] || 'Unknown',
    dbName:      mongoose.connection.name || 'none',
    port:        PORT,
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
    console.log('✅ Route mounted: ' + mountPath);
  } catch (err) {
    console.error('❌ Route failed [' + mountPath + ']: ' + err.message);
  }
}

// ================================================
//   LOAD ALL ROUTES
// ================================================

loadRoute('./routes/auth',        '/api/auth');
// Vendor routes — inline to prevent route caching issues
(function () {
  var express      = require('express');
  var vRouter      = express.Router();
  var vCtrl        = require('./controllers/vendorcontroller');
  var authMw       = require('./middleware/auth');

  vRouter.use(function (req, res, next) {
    console.log('[VENDORS]', req.method, req.path);
    next();
  });

  vRouter.get('/products/all',           vCtrl.getAllProducts);
  vRouter.get('/my-profile',             authMw.protect, vCtrl.getMyVendorProfile);
  vRouter.post('/register',              authMw.protect, vCtrl.registerVendor);
  vRouter.post('/products',              authMw.protect, vCtrl.addProduct);
  vRouter.delete('/products/:productId', authMw.protect, vCtrl.deleteProduct);
  vRouter.put('/update',                 authMw.protect, vCtrl.updateVendorProfile);
  vRouter.get('/',                       vCtrl.getAllVendors);
  vRouter.get('/:id',                    vCtrl.getVendorById);

  app.use('/api/vendors', vRouter);
  console.log('✅ Vendor routes inline loaded');
})();
loadRoute('./routes/ambassadors', '/api/ambassadors');
loadRoute('./routes/news',        '/api/news');
loadRoute('./routes/courses',     '/api/courses');
loadRoute('./routes/admin',       '/api/admin');
loadRoute('./routes/payments',    '/api/payments');
loadRoute('./routes/ads',     '/api/ads');
loadRoute('./routes/contact', '/api/contact');
// ================================================
//   404 — catches unknown routes
// ================================================

app.use(function (req, res) {
  console.log('404: ' + req.method + ' ' + req.originalUrl);
  res.status(404).json({
    success: false,
    message: 'Route not found: ' + req.method + ' ' + req.originalUrl
  });
});

// ================================================
//   GLOBAL ERROR HANDLER
// ================================================

app.use(function (err, req, res, next) {
  console.error('💥 Unhandled error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// ================================================
//   MONGOOSE CONNECTION OPTIONS
// ================================================

var mongooseOptions = {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS:          45000,
  connectTimeoutMS:         10000,
  family:                   4,
  maxPoolSize:              10
};

// ================================================
//   CONNECT TO MONGODB THEN START SERVER
//   Server only starts AFTER DB connects
// ================================================

console.log('📡 Connecting to MongoDB...');

mongoose.connect(MONGO_URI, mongooseOptions)
  .then(function () {
    console.log('');
    console.log('✅ MongoDB connected successfully!');
    console.log('📂 Database: ' + mongoose.connection.name);
    console.log('🔗 Host: '     + mongoose.connection.host);
    console.log('');

    // Start server ONLY after DB is ready
    app.listen(PORT, function () {
      console.log('🚀 Server running on port: ' + PORT);
      console.log('🔍 Health: http://localhost:' + PORT + '/api/health');
      console.log('');
      console.log('--- AVAILABLE ROUTES ---');
      console.log('POST   /api/auth/register');
      console.log('POST   /api/auth/login');
      console.log('GET    /api/auth/me');
      console.log('GET    /api/vendors');
      console.log('POST   /api/vendors/register');
      console.log('GET    /api/vendors/my-profile');
      console.log('GET    /api/vendors/products/all');
      console.log('POST   /api/vendors/products');
      console.log('GET    /api/ambassadors/my-profile');
      console.log('POST   /api/ambassadors/register');
      console.log('GET    /api/news');
      console.log('POST   /api/news');
      console.log('GET    /api/courses');
      console.log('POST   /api/courses/purchase');
      console.log('GET    /api/admin/stats');
      console.log('POST   /api/payments/verify');
      console.log('------------------------');
      console.log('');
    });
  })
  .catch(function (err) {
    console.error('');
    console.error('❌ MongoDB connection FAILED!');
    console.error('Error: ' + err.message);
    console.error('');
    console.error('==== HOW TO FIX ====');
    console.error('1. Open Command Prompt as Administrator');
    console.error('2. Run: net start MongoDB');
    console.error('3. Run: npm run dev again');
    console.error('====================');
    console.error('');
    process.exit(1);
  });

// Handle unexpected disconnection after startup
mongoose.connection.on('disconnected', function () {
  console.error('⚠️  MongoDB disconnected unexpectedly!');
});

mongoose.connection.on('reconnected', function () {
  console.log('✅ MongoDB reconnected!');
});

module.exports = app;