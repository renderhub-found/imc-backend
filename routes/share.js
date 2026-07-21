'use strict';

const express = require('express');
const router  = express.Router();
const News    = require('../models/News');
const Event   = require('../models/Event');
const Vendor  = require('../models/Vendor');

var FRONTEND_URL = process.env.FRONTEND_URL || 'https://insidemycampus.netlify.app';
var FALLBACK_IMAGE = 'https://insidemycampus.netlify.app/favicon.png';

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderSharePage(res, opts) {
  var title       = esc(opts.title || 'Inside My Campus');
  var description = esc((opts.description || '').substring(0, 200));
  var image       = opts.image || FALLBACK_IMAGE;
  var redirectUrl = opts.redirectUrl;

  res.set('Content-Type', 'text/html');
  res.send(
    '<!DOCTYPE html><html><head>' +
    '<meta charset="utf-8"/>' +
    '<title>' + title + '</title>' +
    '<meta name="description" content="' + description + '"/>' +
    '<meta property="og:type" content="website"/>' +
    '<meta property="og:title" content="' + title + '"/>' +
    '<meta property="og:description" content="' + description + '"/>' +
    '<meta property="og:image" content="' + image + '"/>' +
    '<meta property="og:url" content="' + redirectUrl + '"/>' +
    '<meta name="twitter:card" content="summary_large_image"/>' +
    '<meta name="twitter:title" content="' + title + '"/>' +
    '<meta name="twitter:description" content="' + description + '"/>' +
    '<meta name="twitter:image" content="' + image + '"/>' +
    '<meta http-equiv="refresh" content="0; url=' + redirectUrl + '"/>' +
    '</head><body>' +
    '<p>Redirecting to <a href="' + redirectUrl + '">' + title + '</a>...</p>' +
    '<script>window.location.replace(' + JSON.stringify(redirectUrl) + ');</script>' +
    '</body></html>'
  );
}

// GET /api/share/product/:id
router.get('/product/:id', async function (req, res) {
  try {
    var vendor = await Vendor.findOne({ 'products._id': req.params.id });
    var product = vendor && vendor.products.find(function (p) {
      return p._id.toString() === req.params.id;
    });
    if (!product) {
      return renderSharePage(res, {
        title: 'Product not found',
        redirectUrl: FRONTEND_URL + '/marketplace.html'
      });
    }
    var image = (product.images && product.images[0]) || product.image || FALLBACK_IMAGE;
    renderSharePage(res, {
      title:       product.name,
      description: product.description,
      image:       image,
      redirectUrl: FRONTEND_URL + '/product-details.html?id=' + product._id
    });
  } catch (err) {
    console.error('[Share] product error:', err.message);
    renderSharePage(res, { title: 'Inside My Campus', redirectUrl: FRONTEND_URL });
  }
});

// GET /api/share/event/:id
router.get('/event/:id', async function (req, res) {
  try {
    var event = await Event.findById(req.params.id);
    if (!event) {
      return renderSharePage(res, {
        title: 'Event not found',
        redirectUrl: FRONTEND_URL + '/events.html'
      });
    }
    renderSharePage(res, {
      title:       event.title,
      description: event.description,
      image:       event.coverImage || FALLBACK_IMAGE,
      redirectUrl: FRONTEND_URL + '/event-details.html?id=' + event._id
    });
  } catch (err) {
    console.error('[Share] event error:', err.message);
    renderSharePage(res, { title: 'Inside My Campus', redirectUrl: FRONTEND_URL });
  }
});

// GET /api/share/news/:id
router.get('/news/:id', async function (req, res) {
  try {
    var news = await News.findById(req.params.id);
    if (!news) {
      return renderSharePage(res, {
        title: 'News not found',
        redirectUrl: FRONTEND_URL + '/campus-news.html'
      });
    }
    renderSharePage(res, {
      title:       news.title,
      description: news.content ? news.content.replace(/<[^>]*>/g, '').substring(0, 200) : '',
      image:       news.image || FALLBACK_IMAGE,
      redirectUrl: FRONTEND_URL + '/news-details.html?id=' + news._id
    });
  } catch (err) {
    console.error('[Share] news error:', err.message);
    renderSharePage(res, { title: 'Inside My Campus', redirectUrl: FRONTEND_URL });
  }
});

module.exports = router;