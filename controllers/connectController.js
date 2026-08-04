'use strict';

var Community = require('../models/Community');

function isValidGroupLink(platform, link) {
  try {
    var u = new URL(link);
    if (u.protocol !== 'https:') return false;
    if (platform === 'WhatsApp')  return /(^|\.)whatsapp\.com$/.test(u.hostname);
    if (platform === 'Telegram')  return /(^|\.)t\.me$/.test(u.hostname) || /(^|\.)telegram\.(me|org)$/.test(u.hostname);
    if (platform === 'Discord')   return /(^|\.)discord\.(gg|com)$/.test(u.hostname);
    return false;
  } catch (e) {
    return false;
  }
}

// ================================================
//   GET /api/connect/universities — cards for the landing grid
// ================================================
async function getUniversities(req, res) {
  try {
    var agg = await Community.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$university', communityCount: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    var universities = agg.map(function (u) {
      return { university: u._id, communityCount: u.communityCount };
    });
    return res.json({ success: true, universities: universities });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   GET /api/connect/communities — filterable list
// ================================================
async function getCommunities(req, res) {
  try {
    var filter = { status: 'approved' };
    if (req.query.university) filter.university = req.query.university;
    if (req.query.faculty)    filter.faculty    = req.query.faculty;
    if (req.query.department) filter.department = req.query.department;

    var communities = await Community.find(filter)
      .select('-reports')
      .sort({ featured: -1, verified: -1, createdAt: -1 });

    return res.json({ success: true, count: communities.length, communities: communities });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   POST /api/connect — request a new community (moderation)
// ================================================
async function createCommunity(req, res) {
  try {
    var university     = (req.body.university     || '').trim();
    var faculty         = (req.body.faculty         || '').trim();
    var department      = (req.body.department      || '').trim();
    var communityName   = (req.body.communityName   || '').trim();
    var platform         = req.body.platform;
    var groupLink        = (req.body.groupLink       || '').trim();
    var description      = (req.body.description     || '').trim();

    if (!university || !communityName || !platform || !groupLink) {
      return res.status(400).json({
        success: false,
        message: 'University, community name, platform, and group link are required.'
      });
    }

    if (['WhatsApp', 'Telegram', 'Discord'].indexOf(platform) === -1) {
      return res.status(400).json({ success: false, message: 'Invalid platform.' });
    }

    if (!isValidGroupLink(platform, groupLink)) {
      return res.status(400).json({
        success: false,
        message: 'That link does not look like a valid ' + platform + ' link.'
      });
    }

    var duplicate = await Community.findOne({
      university: university, department: department,
      communityName: new RegExp('^' + communityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'),
      platform: platform,
      status: { $ne: 'rejected' }
    });
    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: 'A community with this name already exists for this university/department.'
      });
    }

    var community = await Community.create({
      university, faculty, department, communityName, platform, groupLink, description,
      createdBy:    req.user._id,
      creatorName:  (req.body.creatorName || (req.user.firstName + ' ' + (req.user.lastName || ''))).trim(),
      creatorEmail: req.body.creatorEmail || req.user.email,
      status: 'pending'
    });

    return res.status(201).json({
      success: true,
      message: 'Submitted for review. An admin will approve it shortly.',
      community: community
    });
  } catch (err) {
    console.error('[Connect] createCommunity:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   POST /api/connect/:id/report
// ================================================
async function reportCommunity(req, res) {
  try {
    var community = await Community.findById(req.params.id);
    if (!community) {
      return res.status(404).json({ success: false, message: 'Community not found.' });
    }
    community.reports.push({ reportedBy: req.user._id, reason: (req.body.reason || '').trim() });
    await community.save();
    return res.json({ success: true, message: 'Report submitted. Thank you.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   ADMIN
// ================================================
async function getAllCommunitiesAdmin(req, res) {
  try {
    var filter = {};
    if (req.query.status) filter.status = req.query.status;
    var communities = await Community.find(filter).sort({ createdAt: -1 });
    return res.json({ success: true, communities: communities });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function updateCommunityStatus(req, res) {
  try {
    var status = req.body.status;
    if (['approved', 'rejected'].indexOf(status) === -1) {
      return res.status(400).json({ success: false, message: 'status must be approved or rejected.' });
    }
    var community = await Community.findById(req.params.id);
    if (!community) {
      return res.status(404).json({ success: false, message: 'Community not found.' });
    }
    community.status = status;
    if (status === 'rejected') community.rejectionReason = req.body.reason || '';
    await community.save();
    return res.json({ success: true, message: 'Status updated.', community: community });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function updateCommunity(req, res) {
  try {
    var community = await Community.findById(req.params.id);
    if (!community) {
      return res.status(404).json({ success: false, message: 'Community not found.' });
    }
    var editable = [
      'university', 'faculty', 'department', 'communityName', 'platform',
      'groupLink', 'description', 'memberCount', 'featured', 'verified'
    ];
    editable.forEach(function (f) {
      if (req.body[f] !== undefined) community[f] = req.body[f];
    });
    await community.save();
    return res.json({ success: true, message: 'Community updated.', community: community });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteCommunity(req, res) {
  try {
    await Community.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Community deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getUniversities,
  getCommunities,
  createCommunity,
  reportCommunity,
  getAllCommunitiesAdmin,
  updateCommunityStatus,
  updateCommunity,
  deleteCommunity
};