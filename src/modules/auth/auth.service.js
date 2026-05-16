const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('./auth.model');
const { encrypt } = require('../../utils/crypto');
const Token = require('../token/token.model');
const logger = require('../../utils/logger');
const env = require('../../config/env');

const META_GRAPH_BASE = `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}`;

// ── JWT helpers ───────────────────────────────────────────────────────
const signTokens = (userId) => {
  const accessToken = jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES,
  });
  const refreshToken = jwt.sign({ sub: userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES,
  });
  return { accessToken, refreshToken };
};

// ── Register ──────────────────────────────────────────────────────────
const register = async ({ email, password, name }) => {
  const existing = await User.findOne({ email });
  if (existing) throw Object.assign(new Error('Email already in use'), { statusCode: 409 });

  const user = await User.create({ email, name, passwordHash: password });
  const tokens = signTokens(user._id.toString());

  user.refreshToken = tokens.refreshToken;
  await user.save();

  return { user: user.toSafeObject(), ...tokens };
};

// ── Login ─────────────────────────────────────────────────────────────
const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+passwordHash +refreshToken');
  if (!user) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });

  const isValid = await user.comparePassword(password);
  if (!isValid) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });

  const tokens = signTokens(user._id.toString());
  user.refreshToken = tokens.refreshToken;
  user.lastLoginAt = new Date();
  await user.save();

  return { user: user.toSafeObject(), ...tokens };
};

// ── Refresh ───────────────────────────────────────────────────────────
const refreshAccessToken = async (token) => {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
  } catch {
    throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });
  }

  const user = await User.findById(payload.sub).select('+refreshToken');
  if (!user || user.refreshToken !== token) {
    throw Object.assign(new Error('Token reuse detected'), { statusCode: 401 });
  }

  const tokens = signTokens(user._id.toString());
  user.refreshToken = tokens.refreshToken;
  await user.save();

  return tokens;
};

// ── Forgot Password ───────────────────────────────────────────────────
/**
 * Generates a secure reset token and stores its hash in the user record.
 * In production, send this via email (Resend, Nodemailer, etc.).
 * For now, returns the token in the response for testing.
 */
const forgotPassword = async (email) => {
  const user = await User.findOne({ email });

  // Always return success (prevents user enumeration)
  if (!user) return { message: 'If this email exists, a reset link has been sent.' };

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  user.passwordResetToken = tokenHash;
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save({ validateBeforeSave: false });

  // TODO: send email with link → `${env.FRONTEND_URL}/reset-password?token=${rawToken}`
  logger.info(`Password reset token generated for ${email}`);

  // Dev: return token directly so you can test without email setup
  const devToken = env.NODE_ENV !== 'production' ? rawToken : undefined;
  return { message: 'If this email exists, a reset link has been sent.', devToken };
};

// ── Reset Password ────────────────────────────────────────────────────
const resetPassword = async (rawToken, newPassword) => {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const user = await User.findOne({
    passwordResetToken: tokenHash,
    passwordResetExpires: { $gt: Date.now() },
  }).select('+passwordHash');

  if (!user) throw Object.assign(new Error('Reset token is invalid or expired'), { statusCode: 400 });

  user.passwordHash = newPassword; // pre-save hook hashes it
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshToken = undefined; // invalidate all sessions
  await user.save();

  logger.info(`Password reset completed for user ${user._id}`);
  return { message: 'Password updated successfully. Please log in again.' };
};

// ── Meta OAuth ────────────────────────────────────────────────────────
const handleMetaCallback = async (userId, code) => {
  // ── Step 1: Exchange code for short-lived token ────────────────────
  const tokenRes = await axios.get(`${META_GRAPH_BASE}/oauth/access_token`, {
    params: {
      client_id:     env.META_APP_ID,
      client_secret: env.META_APP_SECRET,
      redirect_uri:  env.META_OAUTH_REDIRECT_URI,
      code,
    },
  });
  const shortLivedToken = tokenRes.data.access_token;

  // ── Step 2: Exchange for 60-day long-lived user token ─────────────
  const longRes = await axios.get(`${META_GRAPH_BASE}/oauth/access_token`, {
    params: {
      grant_type:       'fb_exchange_token',
      client_id:        env.META_APP_ID,
      client_secret:    env.META_APP_SECRET,
      fb_exchange_token: shortLivedToken,
    },
  });
  const userLongToken = longRes.data.access_token;
  const expiresIn    = longRes.data.expires_in || 5_183_944; // ~60 days default

  // ── Step 3: Get Meta user info ─────────────────────────────────────
  const meRes = await axios.get(`${META_GRAPH_BASE}/me`, {
    params: { access_token: userLongToken, fields: 'id,name' },
  });

  // ── Step 4: Get all Facebook Pages the user manages ───────────────
  const pagesRes = await axios.get(`${META_GRAPH_BASE}/me/accounts`, {
    params: { access_token: userLongToken },
  });

  const pages = pagesRes.data.data || [];
  const connectedPages = [];

  for (const page of pages) {
    const encryptedPageToken = encrypt(page.access_token);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Save Facebook Page token
    await Token.findOneAndUpdate(
      { userId, pageId: page.id, platform: 'facebook' },
      {
        userId, pageId: page.id, platform: 'facebook',
        accessToken: encryptedPageToken, expiresAt,
        refreshedAt: new Date(),
        scopes: ['pages_messaging', 'pages_read_engagement'],
      },
      { upsert: true, new: true }
    );

    connectedPages.push({ pageId: page.id, pageName: page.name, platform: 'facebook' });
  }

  await User.findByIdAndUpdate(userId, {
    metaUserId: meRes.data.id,
    $push: { connectedPages: { $each: connectedPages } },
  });

  logger.info(`Meta OAuth completed for user ${userId}, ${pages.length} page(s) connected`);
  return { connectedPages };
};

module.exports = { register, login, refreshAccessToken, forgotPassword, resetPassword, handleMetaCallback };
