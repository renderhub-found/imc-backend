// ================================================
//   NEWS CONTROLLER
// ================================================

const News = require('../models/News');

// GET /api/news
const getAllNews = async function (req, res) {
  try {
    var filter = { status: 'approved' };

    if (req.query.search) {
      var q    = new RegExp(req.query.search, 'i');
      filter.$or = [
        { title: q }, { content: q }, { university: q }
      ];
      filter.status = 'approved';
    }
    if (req.query.university) {
      filter.university = new RegExp(req.query.university, 'i');
    }

    var news = await News.find(filter).sort({ pinned: -1, createdAt: -1 });

    return res.status(200).json({
      success: true, count: news.length, news: news
    });
  } catch (err) {
    console.error('Get news error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/news/admin/all
const getAllNewsAdmin = async function (req, res) {
  try {
    var filter = {};
    if (req.query.status) filter.status = req.query.status;

    var news = await News.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true, count: news.length, news: news
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/news
const submitNews = async function (req, res) {
  try {
    var title      = (req.body.title      || '').trim();
    var university = (req.body.university || '').trim();
    var content    = (req.body.content    || '').trim();
    var image      = (req.body.image      || '').trim();
    var video      = (req.body.video      || '').trim();

    if (!title || !university || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title, university and content are required.'
      });
    }

    var isAdmin = req.user.role === 'admin';

    var news = await News.create({
      author:      req.user._id,
      authorName:  isAdmin ? 'IMC Editorial' : req.body.authorName || req.user.firstName,
      authorEmail: req.user.email,
      title:       title,
      university:  university,
      content:     content,
      image:       image,
      video:       video,
      tags:        [university],
      status:      isAdmin ? 'approved' : 'pending',
      pinned:      req.body.pinned === true
    });

    return res.status(201).json({
      success: true,
      message: isAdmin ? 'News published!' : 'News submitted! Pending approval.',
      news:    news
    });
  } catch (err) {
    console.error('Submit news error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/news/:id/status
const updateNewsStatus = async function (req, res) {
  try {
    var news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ success: false, message: 'News not found.' });
    }
    if (req.body.status) news.status = req.body.status;
    if (typeof req.body.pinned !== 'undefined') news.pinned = req.body.pinned;
    await news.save();

    return res.status(200).json({ success: true, message: 'News updated.', news: news });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/news/:id
const deleteNews = async function (req, res) {
  try {
    await News.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: 'News deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/news/:id
const getNewsById = async function (req, res) {
  try {
    var news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }
    news.views = (news.views || 0) + 1;
    await news.save();
    return res.status(200).json({ success: true, news: news });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAllNews, getAllNewsAdmin, submitNews,
  updateNewsStatus, deleteNews, getNewsById
};