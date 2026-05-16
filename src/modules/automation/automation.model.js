const mongoose = require('mongoose');

const triggerSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['comment', 'message', 'story_mention'],
      required: true,
    },
    keywords: [{ type: String, trim: true }],
    matchType: {
      type: String,
      enum: ['any', 'all', 'exact'],
      default: 'any',
    },
    caseSensitive: { type: Boolean, default: false },
  },
  { _id: false }
);

const actionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['send_dm', 'reply_comment', 'add_label'],
      required: true,
    },
    template: { type: String, required: true, maxlength: 2000 },
    delay: { type: Number, default: 0, min: 0 }, // ms
    variables: { type: Map, of: String },
  },
  { _id: false }
);

const rateLimitSchema = new mongoose.Schema(
  {
    maxPerHour: { type: Number, default: 100 },
    currentHourCount: { type: Number, default: 0 },
    resetAt: { type: Date, default: () => new Date(Date.now() + 3600000) },
  },
  { _id: false }
);

const automationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    pageId: { type: String, required: true, index: true },
    platform: {
      type: String,
      enum: ['instagram', 'facebook'],
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    trigger: { type: triggerSchema, required: true },
    actions: {
      type: [actionSchema],
      validate: [(v) => v.length > 0, 'At least one action is required'],
    },
    isActive: { type: Boolean, default: true, index: true },

    // ── Post-Level Targeting ──────────────────────────────────────────
    // 'all'      = triggers on every post/reel on the page
    // 'specific' = only triggers on postIds listed below
    mediaFilter: {
      type: String,
      enum: ['all', 'specific'],
      default: 'all',
    },
    postIds: [{ type: String }], // Instagram/FB media IDs

    stats: {
      triggered: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    rateLimit: { type: rateLimitSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// Compound indexes for fast lookup
automationSchema.index({ pageId: 1, isActive: 1 });
automationSchema.index({ userId: 1, createdAt: -1 });
automationSchema.index({ name: 'text', 'trigger.keywords': 'text' });

module.exports = mongoose.model('Automation', automationSchema);
