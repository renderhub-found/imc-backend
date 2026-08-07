'use strict';

var AmbassadorTask  = require('../models/AmbassadorTask');
var TaskSubmission  = require('../models/TaskSubmission');
var Ambassador      = require('../models/Ambassador');

// ================================================
//   ADMIN — CREATE / EDIT / DELETE / PAUSE / ACTIVATE
// ================================================

async function createTask(req, res) {
  try {
    var title  = (req.body.title  || '').trim();
    var reward = parseFloat(req.body.rewardAmount);

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required.' });
    }
    if (isNaN(reward) || reward < 0) {
      return res.status(400).json({ success: false, message: 'A valid rewardAmount is required.' });
    }

    var task = await AmbassadorTask.create({
      title:       title,
      description: (req.body.description || '').trim(),
      rewardAmount: reward,
      rules:       (req.body.rules || '').trim(),
      verificationMethod: ['manual', 'link_proof', 'auto_referral'].indexOf(req.body.verificationMethod) !== -1
        ? req.body.verificationMethod : 'manual',
      taskUrl:  (req.body.taskUrl || '').trim(),
      status:   'active',
      createdBy: req.user._id
    });

    return res.status(201).json({ success: true, task: task });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function updateTask(req, res) {
  try {
    var task = await AmbassadorTask.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    var editable = ['title', 'description', 'rewardAmount', 'rules', 'verificationMethod', 'taskUrl'];
    editable.forEach(function (f) {
      if (req.body[f] !== undefined) task[f] = req.body[f];
    });

    await task.save();
    return res.json({ success: true, task: task });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function setTaskStatus(req, res) {
  try {
    var status = req.body.status;
    if (['active', 'paused'].indexOf(status) === -1) {
      return res.status(400).json({ success: false, message: 'status must be active or paused.' });
    }
    var task = await AmbassadorTask.findByIdAndUpdate(req.params.id, { status: status }, { new: true });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    return res.json({ success: true, task: task });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteTask(req, res) {
  try {
    await AmbassadorTask.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Task deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getAllTasksAdmin(req, res) {
  try {
    var tasks = await AmbassadorTask.find({}).sort({ createdAt: -1 });
    return res.json({ success: true, tasks: tasks });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   ADMIN — REVIEW SUBMISSIONS (approve/reject)
//   This is the ONLY place a reward is credited.
// ================================================

async function getAllSubmissionsAdmin(req, res) {
  try {
    var filter = {};
    if (req.query.status) filter.status = req.query.status;
    var submissions = await TaskSubmission.find(filter)
      .populate('task', 'title rewardAmount verificationMethod')
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 });
    return res.json({ success: true, submissions: submissions });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function reviewSubmission(req, res) {
  try {
    var decision = req.body.status; // 'approved' | 'rejected'
    if (['approved', 'rejected'].indexOf(decision) === -1) {
      return res.status(400).json({ success: false, message: 'status must be approved or rejected.' });
    }

    var submission = await TaskSubmission.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found.' });
    }
    if (submission.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Submission was already reviewed.' });
    }

    submission.status     = decision;
    submission.reviewedBy = req.user._id;
    submission.reviewedAt = new Date();
    if (decision === 'rejected') {
      submission.rejectionReason = (req.body.reason || '').trim();
    }
    await submission.save();

    // Reward is credited here and ONLY here — server-controlled amount
    // from the snapshot taken at submission time, never from client input.
    if (decision === 'approved') {
      var ambassador = await Ambassador.findById(submission.ambassador);
      if (ambassador) {
        ambassador.earnings += submission.rewardAmount;
        await ambassador.save();
      }
    }

    return res.json({ success: true, message: 'Submission ' + decision + '.', submission: submission });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   AMBASSADOR — VIEW ACTIVE TASKS
// ================================================

async function getActiveTasks(req, res) {
  try {
    var tasks = await AmbassadorTask.find({ status: 'active' }).sort({ createdAt: -1 });
    return res.json({ success: true, tasks: tasks });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   AMBASSADOR — SUBMIT PROOF FOR A TASK
//   Replaces the old client-controlled claimTaskReward.
//   No reward is credited here — status starts 'pending'.
// ================================================

async function submitTask(req, res) {
  try {
    var ambassador = await Ambassador.findOne({ user: req.user._id });
    if (!ambassador) {
      return res.status(404).json({ success: false, message: 'Ambassador profile not found.' });
    }

    var task = await AmbassadorTask.findById(req.params.taskId);
    if (!task || task.status !== 'active') {
      return res.status(404).json({ success: false, message: 'Task not found or not currently active.' });
    }

    var existing = await TaskSubmission.findOne({
      task: task._id,
      ambassador: ambassador._id,
      status: { $in: ['pending', 'approved'] }
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: existing.status === 'approved'
          ? 'You already completed this task.'
          : 'You already have a pending submission for this task.'
      });
    }

    var proof = (req.body.proof || '').trim();
    if (task.verificationMethod !== 'auto_referral' && !proof) {
      return res.status(400).json({ success: false, message: 'Proof (link or description) is required for this task.' });
    }

    // auto_referral tasks verify against real data already tracked on the
    // ambassador record instead of trusting anything the client submits.
    if (task.verificationMethod === 'auto_referral') {
      var requiredCount = parseInt(task.rules) || 0; // admin sets required referral count in `rules`, e.g. "5"
      var actualCount    = (ambassador.referrals || []).length;
      if (requiredCount > 0 && actualCount < requiredCount) {
        return res.status(400).json({
          success: false,
          message: 'You have ' + actualCount + ' verified referral(s); this task requires ' + requiredCount + '.'
        });
      }
      // Enough real referrals exist — auto-approve, still through the same
      // reward-crediting path so nothing bypasses the snapshot/ledger.
      var submission = await TaskSubmission.create({
        task: task._id, ambassador: ambassador._id, user: req.user._id,
        proof: 'Auto-verified: ' + actualCount + ' referrals',
        rewardAmount: task.rewardAmount,
        status: 'approved', reviewedAt: new Date()
      });
      ambassador.earnings += task.rewardAmount;
      await ambassador.save();
      return res.json({ success: true, message: 'Task auto-verified and reward credited!', submission: submission });
    }

    var submission = await TaskSubmission.create({
      task: task._id,
      ambassador: ambassador._id,
      user: req.user._id,
      proof: proof,
      rewardAmount: task.rewardAmount,
      status: 'pending'
    });

    return res.status(201).json({
      success: true,
      message: 'Submitted for review. Reward is credited once an admin approves it.',
      submission: submission
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getMySubmissions(req, res) {
  try {
    var ambassador = await Ambassador.findOne({ user: req.user._id });
    if (!ambassador) {
      return res.status(404).json({ success: false, message: 'Ambassador profile not found.' });
    }
    var submissions = await TaskSubmission.find({ ambassador: ambassador._id })
      .populate('task', 'title rewardAmount')
      .sort({ createdAt: -1 });
    return res.json({ success: true, submissions: submissions });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  createTask, updateTask, setTaskStatus, deleteTask, getAllTasksAdmin,
  getAllSubmissionsAdmin, reviewSubmission,
  getActiveTasks, submitTask, getMySubmissions
};