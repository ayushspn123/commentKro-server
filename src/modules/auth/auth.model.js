const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectedPageSchema = new mongoose.Schema(
  {
    pageId:   { type: String, required: true },
    pageName: { type: String, required: true },
    platform: { type: String, enum: ['instagram', 'facebook'], required: true },
    username: { type: String },          // IG @handle or FB page username
    picture:  { type: String },          // profile picture URL from Meta API
    tokenRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Token' },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      select: false, // Never return in queries
    },
    name: { type: String, trim: true },
    metaUserId: { type: String, index: true, sparse: true },
    plan: {
      type: String,
      enum: ['free', 'monthly', 'annual', 'pro', 'enterprise'],
      default: 'free',
      index: true,
    },
    planLimits: {
      dailyDMs: { type: Number, default: 100 },
      automations: { type: Number, default: 3 },
    },
    connectedPages: [connectedPageSchema],
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    refreshToken: { type: String, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.refreshToken;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
