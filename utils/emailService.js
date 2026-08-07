'use strict';

var { Resend } = require('resend');

console.log('[Email] Loading emailService...');
console.log('[Email] RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'SET ✅' : 'NOT SET ❌');
console.log('[Email] EMAIL_FROM:', process.env.EMAIL_FROM || 'NOT SET ❌');

// ================================================
//   RESEND CLIENT
// ================================================

function getResendClient() {
  var key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[Email] No client: RESEND_API_KEY missing');
    return null;
  }
  return new Resend(key);
}

// ================================================
//   VERIFY (kept for compatibility with existing callers)
// ================================================

async function verifyTransporter() {
  var client = getResendClient();
  if (!client || !process.env.EMAIL_FROM) {
    console.warn('[Email] Cannot verify: RESEND_API_KEY or EMAIL_FROM missing');
    return false;
  }
  console.log('[Email] ✅ Resend configured OK');
  return true;
}

// ================================================
//   CORE SEND — never throws
// ================================================

async function sendEmail(options) {
  var client = getResendClient();
  if (!client) {
    console.warn('[Email] Skipping: no client');
    return { success: false, message: 'Email not configured' };
  }
  if (!options.to || !options.subject || !options.html) {
    return { success: false, message: 'Missing to/subject/html' };
  }
  try {
    console.log('[Email] Sending to:', options.to);
    var result = await client.emails.send({
      from:    process.env.EMAIL_FROM,
      to:      options.to,
      subject: options.subject,
      html:    options.html,
      text:    (options.html || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()
    });
    if (result.error) {
      console.error('[Email] ❌ Failed:', result.error.message);
      return { success: false, message: result.error.message };
    }
    console.log('[Email] ✅ Sent! ID:', result.data && result.data.id);
    return { success: true, messageId: result.data && result.data.id };
  } catch (err) {
    console.error('[Email] ❌ Failed:', err.message);
    return { success: false, message: err.message };
  }
}
// ================================================
//   BASE HTML TEMPLATE
// ================================================

function base(content) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>' +
    'body{font-family:Inter,Arial,sans-serif;background:#f4f6fb;margin:0;padding:20px;}' +
    '.w{max-width:560px;margin:0 auto;background:#fff;border-radius:16px;' +
    'overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);}' +
    '.h{background:#1a3c8f;padding:24px 32px;text-align:center;}' +
    '.h h1{color:#fff;font-size:20px;font-weight:800;margin:0;}' +
    '.h p{color:rgba(255,255,255,0.7);font-size:12px;margin:4px 0 0;}' +
    '.b{padding:28px 32px;}' +
    '.b p{color:#444;font-size:15px;line-height:1.6;margin:0 0 14px;}' +
    '.btn{display:inline-block;background:#1a3c8f;color:#fff;padding:13px 28px;' +
    'border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;margin:16px 0;}' +
    '.hl{background:#f0f4ff;border-left:4px solid #1a3c8f;padding:12px 16px;' +
    'border-radius:0 8px 8px 0;margin:16px 0;font-weight:600;color:#1a1a2e;}' +
    '.ft{background:#f8f9ff;padding:16px 32px;text-align:center;color:#aaa;font-size:12px;}' +
    '</style></head><body><div class="w">' +
    '<div class="h"><h1>📚 Inside My Campus</h1>' +
    "<p>Nigeria's Campus Marketplace</p></div>" +
    '<div class="b">' + content + '</div>' +
    '<div class="ft">© 2024 Inside My Campus · Nigeria</div>' +
    '</div></body></html>';
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ================================================
//   TEMPLATES
// ================================================

async function sendPasswordReset(email, firstName, resetUrl) {
  return sendEmail({
    to:      email,
    subject: 'Reset Your Password — Inside My Campus',
    html: base(
      '<p>Hello <strong>' + esc(firstName) + '</strong>,</p>' +
      '<p>We received a password reset request. Click below — expires in <strong>1 hour</strong>:</p>' +
      '<a href="' + resetUrl + '" class="btn">Reset My Password</a>' +
      '<div class="hl">Or copy this link:<br/>' +
      '<span style="color:#1a3c8f;font-size:12px;word-break:break-all;">' + resetUrl + '</span></div>' +
      '<p style="color:#888;font-size:13px;">Did not request this? Ignore this email.</p>'
    )
  });
}

async function sendWelcome(email, firstName) {
  return sendEmail({
    to:      email,
    subject: 'Welcome to Inside My Campus! 🎉',
    html: base(
      '<p>Hello <strong>' + esc(firstName) + '</strong>! 🎉</p>' +
      '<p>Welcome to <strong>Inside My Campus</strong> — Nigeria\'s campus marketplace.</p>' +
      '<a href="' + (process.env.FRONTEND_URL||'') + '" class="btn">Explore Now</a>'
    )
  });
}

async function sendVendorConfirmation(email, firstName, bizName) {
  return sendEmail({
    to:      email,
    subject: 'Vendor Registration Received — Inside My Campus',
    html: base(
      '<p>Hello <strong>' + esc(firstName) + '</strong>,</p>' +
      '<p>Your vendor registration for <strong>' + esc(bizName) + '</strong> was received!</p>' +
      '<div class="hl">Status: ⏳ Pending Admin Review</div>' +
      '<p>We review within <strong>24 hours</strong>.</p>' +
      '<a href="' + (process.env.FRONTEND_URL||'') + '/vendor-dashboard.html" class="btn">Dashboard</a>'
    )
  });
}

async function sendVendorApproved(email, firstName, bizName) {
  return sendEmail({
    to:      email,
    subject: 'Your Vendor Store is Live! 🎉 — Inside My Campus',
    html: base(
      '<p>Hello <strong>' + esc(firstName) + '</strong>,</p>' +
      '<p><strong>' + esc(bizName) + '</strong> has been ' +
      '<span style="color:#2d8653;font-weight:700;">approved</span>! 🎉</p>' +
      '<a href="' + (process.env.FRONTEND_URL||'') + '/vendor-dashboard.html" class="btn">Set Up Store</a>'
    )
  });
}

async function sendAmbassadorConfirmation(email, firstName, refCode) {
  var link = (process.env.FRONTEND_URL||'') + '/vendor.html?ref=' + refCode;
  return sendEmail({
    to:      email,
    subject: 'Welcome, IMC Ambassador! 🌟 Your Referral Code Inside',
    html: base(
      '<p>Hello <strong>' + esc(firstName) + '</strong>,</p>' +
      '<p>You are now an official <strong>IMC Ambassador</strong>! 🌟</p>' +
      '<div class="hl">Referral Code: <strong>' + esc(refCode) + '</strong></div>' +
      '<p>Share your link — earn <strong>₦500</strong> per vendor:</p>' +
      '<div style="background:#f0f0f0;padding:12px;border-radius:8px;' +
      'word-break:break-all;font-size:13px;color:#1a3c8f;">' + link + '</div>' +
      '<a href="' + (process.env.FRONTEND_URL||'') + '/ambassador-dashboard.html" class="btn">View Dashboard</a>'
    )
  });
}

async function sendPaymentConfirmation(email, firstName, type, amount, reference) {
  var labels = {
    vendor_registration: 'Vendor Registration',
    ad_posting:          'Advertisement Posting',
    course_purchase:     'Course Purchase'
  };
  return sendEmail({
    to:      email,
    subject: 'Payment Confirmed ₦' + (parseInt(amount)||0).toLocaleString() + ' — Inside My Campus',
    html: base(
      '<p>Hello <strong>' + esc(firstName) + '</strong>,</p>' +
      '<p>Your payment has been confirmed! ✅</p>' +
      '<div class="hl">Type: <strong>' + esc(labels[type]||type) + '</strong><br/>' +
      'Amount: <strong>₦' + (parseInt(amount)||0).toLocaleString() + '</strong><br/>' +
      'Ref: <code>' + esc(reference) + '</code></div>'
    )
  });
}

async function sendAdminNotification(subject, message) {
  if (!process.env.EMAIL_FROM) return;
  return sendEmail({
    to:      process.env.EMAIL_FROM,
    subject: '[IMC Admin] ' + subject,
    html:    base('<p>' + esc(message).replace(/\n/g,'</p><p>') + '</p>')
  });
}

async function sendTicketConfirmation(email, firstName, details) {
  return sendEmail({
    to:      email,
    subject: 'Your Ticket for ' + details.eventTitle + ' — Inside My Campus',
    html: base(
      '<p>Hello <strong>' + esc(firstName) + '</strong>,</p>' +
      '<p>Your ticket is confirmed! 🎉</p>' +
      '<div class="hl">' +
      'Event: <strong>' + esc(details.eventTitle) + '</strong><br/>' +
      'Date: <strong>' + esc(details.eventDate) + '</strong><br/>' +
      'Time: <strong>' + esc(details.eventTime) + '</strong><br/>' +
      'Venue: <strong>' + esc(details.location) + '</strong><br/>' +
      'Ticket Type: <strong>' + esc(details.ticketType) + '</strong><br/>' +
      'Quantity: <strong>' + esc(details.ticketQuantity || 1) + '</strong><br/>' +
      'Ticket ID: <code>' + esc(details.ticketCode) + '</code><br/>' +
      (details.orderReference
        ? 'Order Reference: <code>' + esc(details.orderReference) + '</code>'
        : '') +
      '</div>' +
      '<p>Show your ticket code or QR code at the entrance to check in.</p>' +
      (details.qrImage
        ? '<div style="text-align:center;margin:20px 0;"><img src="' + details.qrImage +
          '" alt="Ticket QR Code" style="width:180px;height:180px;"/></div>'
        : '')
    )
  });
}

async function sendTicketSaleNotification(email, organizerName, details) {
  return sendEmail({
    to:      email,
    subject: 'New Ticket Sold — ' + details.eventTitle + ' — Inside My Campus',
    html: base(
      '<p>Hello <strong>' + esc(organizerName) + '</strong>,</p>' +
      '<p>You just sold a ticket! 🎟️</p>' +
      '<div class="hl">' +
      'Event: <strong>' + esc(details.eventTitle) + '</strong><br/>' +
      'Date: <strong>' + esc(details.eventDate) + '</strong><br/>' +
      'Location: <strong>' + esc(details.location) + '</strong><br/>' +
      'Ticket Type: <strong>' + esc(details.ticketType) + '</strong><br/>' +
      'Quantity: <strong>' + esc(details.ticketQuantity || 1) + '</strong><br/>' +
      'Buyer: <strong>' + esc(details.buyerName || details.buyerEmail) + '</strong><br/>' +
      'Ticket ID: <code>' + esc(details.ticketCode) + '</code><br/>' +
      (details.orderReference
        ? 'Order Reference: <code>' + esc(details.orderReference) + '</code>'
        : '') +
      '</div>' +
      '<a href="' + (process.env.FRONTEND_URL||'') + '/event-dashboard.html" class="btn">View Dashboard</a>'
    )
  });
}

async function sendMaterialPurchaseConfirmation(email, firstName, details) {
  return sendEmail({
    to:      email,
    subject: 'Your Download: ' + details.title + ' — Inside My Campus',
    html: base(
      '<p>Hello <strong>' + esc(firstName) + '</strong>,</p>' +
      '<p>Thanks for your purchase! Your material is ready to download. 📚</p>' +
      '<div class="hl">' +
      'Title: <strong>' + esc(details.title) + '</strong><br/>' +
      'Amount Paid: <strong>₦' + (parseInt(details.amount) || 0).toLocaleString() + '</strong>' +
      '</div>' +
      '<p><a href="' + esc(details.fileUrl) + '" style="display:inline-block;margin-top:10px;padding:12px 24px;' +
      'background:#1a3c8f;color:#fff;text-decoration:none;border-radius:8px;">Download Now</a></p>' +
      '<p style="font-size:13px;color:#888;margin-top:16px;">You can also find this in "My Purchases" on your Inside My Campus dashboard anytime.</p>'
    )
  });
}

module.exports = {
  sendEmail, verifyTransporter,
  sendPasswordReset, sendWelcome,
  sendVendorConfirmation, sendVendorApproved,
  sendAmbassadorConfirmation, sendPaymentConfirmation,
  sendAdminNotification, sendTicketConfirmation,
  sendTicketSaleNotification,
  sendMaterialPurchaseConfirmation
};