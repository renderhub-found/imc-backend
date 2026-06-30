// ================================================
//   NEWS CONTROLLER
// ================================================
const { uploadToCloudinary } = require('../middleware/upload');
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
    var imageUrl = '';
    var videoUrl = '';

    if (req.files && req.files.image && req.files.image[0]) {
      var imgResult = await uploadToCloudinary(req.files.image[0].buffer, 'imc/news', 'image');
      imageUrl = imgResult.secure_url;
    }

    if (req.files && req.files.video && req.files.video[0]) {
      var vidResult = await uploadToCloudinary(req.files.video[0].buffer, 'imc/news', 'video');
      videoUrl = vidResult.secure_url;
    }

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


// ================================================
//   ADMIN: CREATE & PUBLISH NEWS DIRECTLY
//   POST /api/news/admin/create
//   Admin only — supports image + video file upload
// ================================================

const createNewsAdmin = async function (req, res) {
  try {
    var title    = (req.body.title    || '').trim();
    var category = (req.body.category || '').trim();
    var content  = (req.body.content  || '').trim();
    var status   = req.body.status === 'draft' ? 'pending' : 'approved';

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required.'
      });
    }

    var imageUrl = '';
    var videoUrl = '';

    // req.files comes from multer .fields() — see route below
    if (req.files && req.files.image && req.files.image[0]) {
      var imgResult = await uploadToCloudinary(
        req.files.image[0].buffer,
        'imc/news',
        'image'
      );
      imageUrl = imgResult.secure_url;
    }

    if (req.files && req.files.video && req.files.video[0]) {
      var vidResult = await uploadToCloudinary(
        req.files.video[0].buffer,
        'imc/news',
        'video'
      );
      videoUrl = vidResult.secure_url;
    }

    var news = await News.create({
      author:      req.user._id,
      authorName:  'IMC Editorial',
      authorEmail: req.user.email,
      title:       title,
      university:  category || 'General',
      content:     content,
      image:       imageUrl,
      video:       videoUrl,
      tags:        category ? [category] : [],
      status:      status,
      pinned:      req.body.pinned === 'true'
    });

    return res.status(201).json({
      success: true,
      message: status === 'approved'
        ? 'News published successfully!'
        : 'News saved as draft.',
      news: news
    });

  } catch (err) {
    console.error('Create news admin error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Could not create news: ' + err.message
    });
  }
};

module.exports = {
  getAllNews, getAllNewsAdmin, submitNews,
  updateNewsStatus, deleteNews, getNewsById, createNewsAdmin
};