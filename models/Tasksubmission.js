// ================================================
//   TASK SUBMISSION MODEL — models/TaskSubmission.js
//   One row per ambassador attempt at a task. Reward is only
//   credited to the ambassador's earnings when an admin sets
//   status to 'approved' — never on submission.
// ================================================

const mongoose = require('mongoose');

const TaskSubmissionSchema = new mongoose.Schema({
  task:       { type: mongoose.Schema.Types.ObjectId, ref: 'AmbassadorTask', required: true },
  ambassador: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambassador',     required: true },
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User',          required: true },

  proof:      { type: String, default: '' }, // link or free-text evidence

  rewardAmount: { type: Number, required: true }, // snapshot of task.rewardAmount at submit time

  status: {
    type:    String,
    enum:    ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: { type: String, default: '' },
  reviewedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt:       { type: Date }
}, { timestamps: true });

// one ambassador can only have one active (pending/approved) submission per task
TaskSubmissionSchema.index({ task: 1, ambassador: 1 });

module.exports = mongoose.model('TaskSubmission', TaskSubmissionSchema);