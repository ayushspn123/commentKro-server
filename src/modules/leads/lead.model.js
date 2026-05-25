const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipientId: { type: String, required: true },
    platform: { type: String, enum: ['instagram', 'facebook'], required: true },
    automationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Automation', default: null },
    automationName: { type: String, default: '' },
    status: {
      type: String,
      enum: ['new', 'contacted', 'converted', 'lost'],
      default: 'new',
      index: true,
    },
    notes: { type: String, maxlength: 1000, default: '' },
    tags: { type: [String], default: [] },
    lastContactedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Compound unique: one lead per recipient per user
leadSchema.index({ userId: 1, recipientId: 1 }, { unique: true });
leadSchema.index({ userId: 1, createdAt: -1 });
leadSchema.index({ userId: 1, tags: 1 });

module.exports = mongoose.model('Lead', leadSchema);
