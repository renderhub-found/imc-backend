'use strict';

var nodemailer = require('nodemailer');

console.log('[Email] emailService.js loaded');
console.log('[Email] EMAIL_USER:', process.env.EMAIL_USER || 'NOT SET');
console.log('[Email] EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET ✅' : 'NOT SET ❌');

// ================================================
//   CREATE TRANSPORTER
// ================================================

function createTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('[Email] Cannot create transporter: EMAIL_USER or EMAIL_PASS missing');
    return null;
  }

  const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

  return transporter;
}

// ================================================
//   SEND EMAIL — core function
// ================================================

async function sendEmail(options) {
  var transporter = createTransporter();

  if (!transporter) {
    console.error('[Email] No transporter available. Email not sent.');
    return { success: false, message: 'Email not configured' };
  }

  var mailOptions = {
    from:    process.env.EMAIL_FROM || '"Inside My Campus" <' + process.env.EMAIL_USER + '>',
    to:      options.to,
    subject: options.subject,
    html:    options.html,
    text:    options.text || ''
  };

  try {
    console.log('[Email] Sending to:', options.to);
    console.log('[Email] Subject:', options.subject);

    var info = await transporter.sendMail(mailOptions);

    console.log('[Email] ✅ Sent! Message ID:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (err) {
    console.error('[Email] ❌ Send failed:', err.message);
    console.error('[Email] Error code:', err.code);
    return { success: false, message: err.message, code: err.code };
  }
}

// ================================================
//   VERIFY TRANSPORTER
// ================================================

async function verifyTransporter() {
  var transporter = createTransporter();
  if (!transporter) return false;

  try {
    await transporter.verify();
    console.log('[Email] ✅ Transporter verified');
    return true;
  } catch (err) {
    console.error('[Email] ❌ Transporter verify failed:', err.message);
    return false;
  }
}

// ================================================
//   EMAIL TEMPLATES
// ================================================

// Base HTML wrapper
function baseTemplate(content) {
  return '<!DOCTYPE html>' +
    '<html><head><meta charset="UTF-8"/>' +
    '<style>' +
    'body{font-family:Inter,Arial,sans-serif;background:#f4f6fb;margin:0;padding:20px;}' +
    '.container{max-width:560px;margin:0 auto;background:#fff;border-radius:16px;' +
    'overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);}' +
    '.header{background:#1a3c8f;padding:28px 32px;text-align:center;}' +
    '.header h1{color:#fff;font-size:22px;font-weight:800;margin:0;}' +
    '.header p{color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px;}' +
    '.body{padding:32px;}' +
    '.body p{color:#444;font-size:15px;line-height:1.6;margin-bottom:14px;}' +
    '.btn{display:inline-block;background:#1a3c8f;color:#fff;padding:14px 28px;' +
    'border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;' +
    'margin:20px 0;}' +
    '.footer{background:#f8f9ff;padding:20px 32px;text-align:center;' +
    'color:#aaa;font-size:12px;}' +
    '.highlight{background:#f0f4ff;border-left:4px solid #1a3c8f;' +
    'padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0;font-weight:600;}' +
    '</style></head><body>' +
    '<div class="container">' +
    '<div class="header">' +
    '<h1>📚 Inside My Campus</h1>' +
    '<p>Nigeria\'s Campus Marketplace</p>' +
    '</div>' +
    '<div class="body">' + content + '</div>' +
    '<div class="footer">© 2024 Inside My Campus · Nigeria<br/>' +
    'You received this because you have an account with us.</div>' +
    '</div></body></html>';
}

// ---- Forgot Password ----
async function sendPasswordReset(email, firstName, resetUrl) {
  var content =
    '<p>Hello <strong>' + firstName + '</strong>,</p>' +
    '<p>We received a request to reset your Inside My Campus password.</p>' +
    '<p>Click the button below to reset it. This link expires in <strong>1 hour</strong>.</p>' +
    '<a href="' + resetUrl + '" class="btn">Reset My Password</a>' +
    '<div class="highlight">If the button does not work, copy this link:<br/>' +
    '<span style="color:#1a3c8f;font-size:12px;word-break:break-all;">' + resetUrl + '</span></div>' +
    '<p style="color:#888;font-size:13px;">If you did not request this, please ignore this email. ' +
    'Your password will not change.</p>';

  return await sendEmail({
    to:      email,
    subject: 'Reset Your Password — Inside My Campus',
    html:    baseTemplate(content)
  });
}

// ---- Welcome Email ----
async function sendWelcome(email, firstName) {
  var content =
    '<p>Hello <strong>' + firstName + '</strong>! 🎉</p>' +
    '<p>Welcome to <strong>Inside My Campus</strong> — Nigeria\'s #1 campus marketplace.</p>' +
    '<p>You can now:</p>' +
    '<ul style="color:#444;font-size:15px;line-height:2;">' +
    '<li>🏪 Discover and shop from campus vendors</li>' +
    '<li>📰 Stay updated with campus news</li>' +
    '<li>🎓 Access exclusive campus courses</li>' +
    '<li>📢 Post ads to reach your campus community</li>' +
    '</ul>' +
    '<a href="' + (process.env.FRONTEND_URL || '') + '" class="btn">Explore Now</a>';

  return await sendEmail({
    to:      email,
    subject: 'Welcome to Inside My Campus! 🎉',
    html:    baseTemplate(content)
  });
}

// ---- Vendor Registration ----
async function sendVendorConfirmation(email, firstName, bizName) {
  var content =
    '<p>Hello <strong>' + firstName + '</strong>,</p>' +
    '<p>Your vendor registration for <strong>' + bizName + '</strong> has been received!</p>' +
    '<div class="highlight">Status: ⏳ Pending Admin Review</div>' +
    '<p>We will review your application within <strong>24 hours</strong>. ' +
    'You will receive another email once approved.</p>' +
    '<p>While you wait, you can log in to your vendor dashboard to add products.</p>' +
    '<a href="' + (process.env.FRONTEND_URL || '') + '/vendor-dashboard.html" class="btn">Go to Dashboard</a>';

  return await sendEmail({
    to:      email,
    subject: 'Vendor Registration Received — Inside My Campus',
    html:    baseTemplate(content)
  });
}

// ---- Ambassador Registration ----
async function sendAmbassadorConfirmation(email, firstName, refCode) {
  var content =
    '<p>Hello <strong>' + firstName + '</strong>,</p>' +
    '<p>You are now an official <strong>Inside My Campus Ambassador</strong>! 🌟</p>' +
    '<div class="highlight">Your Referral Code: <strong>' + refCode + '</strong></div>' +
    '<p>Share your referral link with vendors to earn commissions:</p>' +
    '<div style="background:#f0f0f0;padding:12px;border-radius:8px;word-break:break-all;' +
    'font-size:13px;color:#1a3c8f;">' +
    (process.env.FRONTEND_URL || '') + '/vendor.html?ref=' + refCode +
    '</div>' +
    '<p>You earn <strong>₦500</strong> for every vendor that registers using your link.</p>' +
    '<a href="' + (process.env.FRONTEND_URL || '') + '/ambassador-dashboard.html" class="btn">' +
    'View Ambassador Dashboard</a>';

  return await sendEmail({
    to:      email,
    subject: 'Welcome, IMC Ambassador! Your Referral Code Inside 🌟',
    html:    baseTemplate(content)
  });
}

// ---- Payment Success ----
async function sendPaymentConfirmation(email, firstName, type, amount, reference) {
  var typeLabels = {
    vendor_registration: 'Vendor Registration',
    ad_posting:          'Advertisement Posting',
    course_purchase:     'Course Purchase'
  };

  var content =
    '<p>Hello <strong>' + firstName + '</strong>,</p>' +
    '<p>Your payment has been confirmed! ✅</p>' +
    '<div class="highlight">' +
    'Type: <strong>' + (typeLabels[type] || type) + '</strong><br/>' +
    'Amount: <strong>₦' + (amount || 0).toLocaleString() + '</strong><br/>' +
    'Reference: <code>' + reference + '</code>' +
    '</div>' +
    '<p>Thank you for your payment. Your account has been updated.</p>';

  return await sendEmail({
    to:      email,
    subject: 'Payment Confirmed — ₦' + (amount || 0).toLocaleString() + ' | Inside My Campus',
    html:    baseTemplate(content)
  });
}

// ---- Vendor Approved (Admin notification) ----
async function sendVendorApproved(email, firstName, bizName) {
  var content =
    '<p>Hello <strong>' + firstName + '</strong>,</p>' +
    '<p>Great news! Your vendor application for <strong>' + bizName + '</strong> ' +
    'has been <span style="color:#2d8653;font-weight:700;">approved</span>! 🎉</p>' +
    '<p>Your store is now live on Inside My Campus. Start adding products and ' +
    'reach thousands of students on campus.</p>' +
    '<a href="' + (process.env.FRONTEND_URL || '') + '/vendor-dashboard.html" class="btn">' +
    'Set Up Your Store</a>';

  return await sendEmail({
    to:      email,
    subject: 'Your Vendor Store is Live! 🎉 — Inside My Campus',
    html:    baseTemplate(content)
  });
}

// ---- Admin notification ----
async function sendAdminNotification(subject, message) {
  if (!process.env.EMAIL_USER) return;

  var content = '<p>' + message.replace(/\n/g, '</p><p>') + '</p>';

  return await sendEmail({
    to:      process.env.EMAIL_USER,
    subject: '[IMC Admin] ' + subject,
    html:    baseTemplate(content)
  });
}

module.exports = {
  sendEmail,
  verifyTransporter,
  sendPasswordReset,
  sendWelcome,
  sendVendorConfirmation,
  sendAmbassadorConfirmation,
  sendPaymentConfirmation,
  sendVendorApproved,
  sendAdminNotification
};