const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema(
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
    // Stored AES-256-GCM encrypted
    accessToken: { type: String, required: true, select: false },
    tokenType: {
      type: String,
      enum: ['page', 'user', 'system_user'],
      default: 'page',
    },
    expiresAt: { type: Date, required: true },
    scopes: [{ type: String }],
    refreshedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// TTL index — MongoDB auto-deletes expired tokens after 7-day buffer
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

// Compound index for efficient token lookup
tokenSchema.index({ userId: 1, pageId: 1, platform: 1 }, { unique: true });

module.exports = mongoose.model('Token', tokenSchema);
