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

// ── Instagram Business Login OAuth ───────────────────────────────────
const handleMetaCallback = async (userId, code) => {
  // ── Step 1: Exchange code for short-lived Instagram User token ─────
  const tokenRes = await axios.post(
    'https://api.instagram.com/oauth/access_token',
    new URLSearchParams({
      client_id:     env.META_APP_ID,
      client_secret: env.META_APP_SECRET,
      grant_type:    'authorization_code',
      redirect_uri:  env.META_OAUTH_REDIRECT_URI,
      code,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const shortLivedToken = tokenRes.data.access_token;
  // user_id from token exchange is app-scoped — fetch real IG Business Account ID from /me
  const meIdRes  = await axios.get('https://graph.instagram.com/v21.0/me', {
    params: { fields: 'id,username', access_token: shortLivedToken },
  });
  const igUserId = meIdRes.data.id?.toString();

  // ── Step 2: Exchange for long-lived token (60 days) ───────────────
  const longRes = await axios.get('https://graph.instagram.com/access_token', {
    params: {
      grant_type:         'ig_exchange_token',
      client_secret:      env.META_APP_SECRET,
      access_token:       shortLivedToken,
    },
  });

  const longLivedToken = longRes.data.access_token;
  const expiresIn      = longRes.data.expires_in || 5_183_944; // ~60 days
  const expiresAt      = new Date(Date.now() + expiresIn * 1000);

  // ── Step 3: Get Instagram user profile ────────────────────────────
  const profileRes = await axios.get(`https://graph.instagram.com/v21.0/me`, {
    params: {
      fields:       'id,name,username,profile_picture_url',
      access_token: longLivedToken,
    },
  });

  const profile = profileRes.data;
  logger.info(`Instagram profile: @${profile.username} (${profile.id})`);

  // ── Step 4: Save encrypted token ──────────────────────────────────
  const encryptedToken = encrypt(longLivedToken);

  await Token.findOneAndUpdate(
    { userId, pageId: igUserId, platform: 'instagram' },
    {
      userId,
      pageId:      igUserId,
      platform:    'instagram',
      accessToken: encryptedToken,
      expiresAt,
      refreshedAt: new Date(),
      scopes: [
        'instagram_business_basic',
        'instagram_business_manage_messages',
        'instagram_business_manage_comments',
      ],
    },
    { upsert: true, new: true }
  );

  // ── Step 5: Subscribe to webhooks ─────────────────────────────────
  try {
    await axios.post(
      `https://graph.instagram.com/v21.0/${igUserId}/subscribed_apps`,
      null,
      {
        params: {
          subscribed_fields: 'messages,comments',
          access_token:      longLivedToken,
        },
      }
    );
    logger.info(`Webhook subscription set for IG user ${igUserId}`);
  } catch (subErr) {
    logger.warn(`Webhook subscription failed: ${subErr.response?.data?.error?.message || subErr.message}`);
  }

  // ── Step 6: Save to user's connectedPages (no duplicates) ─────────
  await User.findByIdAndUpdate(userId, {
    $pull: { connectedPages: { pageId: igUserId } },
  });
  await User.findByIdAndUpdate(userId, {
    metaUserId: igUserId,
    $push: {
      connectedPages: {
        pageId:   igUserId,
        pageName: profile.username || profile.name,
        platform: 'instagram',
        username: profile.username   || null,
        picture:  profile.profile_picture_url || null,
      },
    },
  });

  logger.info(`Instagram Business Login done for user ${userId} — @${profile.username} connected`);
  return { connectedPages: [{ pageId: igUserId, pageName: profile.username, platform: 'instagram' }] };
};

module.exports = { register, login, refreshAccessToken, forgotPassword, resetPassword, handleMetaCallback };
