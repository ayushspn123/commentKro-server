const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    automationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Automation',
      index: true,
    },
    pageId: { type: String, required: true },
    platform: { type: String, enum: ['instagram', 'facebook'], required: true },
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    type: {
      type: String,
      enum: ['dm', 'comment_reply', 'auto_reply'],
      required: true,
    },
    recipientId: { type: String, required: true },
    senderId: { type: String },
    content: { type: String, required: true, maxlength: 2000 },
    metaMessageId: { type: String, sparse: true },
    status: {
      type: String,
      enum: ['queued', 'sent', 'delivered', 'read', 'failed'],
      default: 'queued',
      index: true,
    },
    errorCode: { type: String },
    errorMessage: { type: String },
    retryCount: { type: Number, default: 0 },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
  },
  { timestamps: true }
);

// Compound index for user message history pagination
messageSchema.index({ userId: 1, createdAt: -1 });
// Unique sparse index for Meta message IDs
messageSchema.index({ metaMessageId: 1 }, { unique: true, sparse: true });
// TTL: auto-delete messages older than 90 days
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Message', messageSchema);
