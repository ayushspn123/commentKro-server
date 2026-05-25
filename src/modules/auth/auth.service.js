const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('./auth.model');
const { encrypt } = require('../../utils/crypto');
const Token = require('../token/token.model');
const logger = require('../../utils/logger');
const env = require('../../config/env');
const { verificationTemplate, welcomeTemplate, passwordResetTemplate } = require('../../utils/emailTemplates');

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

// ── Email verification helpers ────────────────────────────────────────
const createVerificationToken = async (user) => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.emailVerificationToken = tokenHash;
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  await user.save({ validateBeforeSave: false });
  return rawToken;
};

// ── Register ──────────────────────────────────────────────────────────
const register = async ({ email, password, name }) => {
  const existing = await User.findOne({ email });
  if (existing) throw Object.assign(new Error('Email already in use'), { statusCode: 409 });

  const user = await User.create({ email, name, passwordHash: password, isEmailVerified: false });
  const tokens = signTokens(user._id.toString());
  user.refreshToken = tokens.refreshToken;

  const rawToken = await createVerificationToken(user);
  const verifyLink = `${env.FRONTEND_URL}/verify-email?token=${rawToken}`;

  const { sendEmail } = require('../../utils/email');

  // Send verification email (non-blocking)
  sendEmail({
    to: email,
    subject: 'Verify your Comment Kro email address',
    html: verificationTemplate(email, verifyLink),
  }).catch(err => logger.warn(`Verification email failed: ${err.message}`));

  // Send welcome email (non-blocking)
  sendEmail({
    to: email,
    subject: `Welcome to Comment Kro, ${name || 'there'}! 🎉`,
    html: welcomeTemplate(name || 'there', `${env.FRONTEND_URL}/dashboard`),
  }).catch(err => logger.warn(`Welcome email failed: ${err.message}`));

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

  logger.info(`Password reset token generated for ${email}`);

  const resetLink = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;
  const { sendEmail } = require('../../utils/email');
  await sendEmail({
    to: email,
    subject: 'Reset your Comment Kro password',
    html: passwordResetTemplate(resetLink),
  }).catch(err => logger.warn(`Reset email failed: ${err.message}`));

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

  logger.info('Token exchange successful');
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

  // ── Step 3: Get Instagram user profile + page_id ─────────────────
  const profileRes = await axios.get(`https://graph.instagram.com/v21.0/me`, {
    params: {
      fields:       'id,name,username,profile_picture_url',
      access_token: longLivedToken,
    },
  });

  const profile = profileRes.data;

  // ── Step 4: Discover the webhook page ID ─────────────────────────
  // Meta webhooks send entry.id which may differ from the IG User ID.
  // Strategy: try multiple API calls to find the correct ID.
  let webhookPageId = igUserId; // default fallback

  // Try 1: Facebook Graph /me/accounts — works when IG is linked to a FB Page
  try {
    const pagesRes = await axios.get(`https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/me/accounts`, {
      params: { fields: 'id,name,instagram_business_account', access_token: longLivedToken },
      timeout: 5000,
    });
    const pages = pagesRes.data?.data || [];
    // Find a page whose instagram_business_account.id matches our igUserId
    const matched = pages.find(p => p.instagram_business_account?.id === igUserId);
    if (matched) {
      webhookPageId = matched.id;
      logger.info(`Webhook pageId resolved via FB pages: ${webhookPageId}`);
    } else if (pages.length > 0) {
      webhookPageId = pages[0].id;
      logger.info(`Webhook pageId set to first FB page: ${webhookPageId}`);
    }
  } catch {
    // Try 2: Instagram API — get linked pages directly
    try {
      const igPagesRes = await axios.get(`https://graph.instagram.com/${env.META_GRAPH_API_VERSION}/${igUserId}`, {
        params: { fields: 'id,username,page', access_token: longLivedToken },
        timeout: 5000,
      });
      if (igPagesRes.data?.page?.id) {
        webhookPageId = igPagesRes.data.page.id;
        logger.info(`Webhook pageId resolved via IG page field: ${webhookPageId}`);
      }
    } catch {
      logger.warn(`Could not resolve webhook pageId — defaulting to igUserId ${igUserId}`);
    }
  }

  logger.info(`Instagram profile: @${profile.username} (igUserId:${igUserId}, webhookPageId:${webhookPageId})`);

  // ── Step 5: Save encrypted token ──────────────────────────────────
  const encryptedToken = encrypt(longLivedToken);

  await Token.findOneAndUpdate(
    { userId, pageId: igUserId, platform: 'instagram' },
    {
      userId,
      pageId:        igUserId,
      webhookPageId: webhookPageId,  // correctly resolved at OAuth time
      platform:      'instagram',
      accessToken:   encryptedToken,
      expiresAt,
      refreshedAt:   new Date(),
      scopes: [
        'instagram_business_basic',
        'instagram_business_manage_messages',
        'instagram_business_manage_comments',
      ],
    },
    { upsert: true, new: true }
  );

  // ── Step 6: Subscribe to webhooks ─────────────────────────────────
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

  // ── Step 7: Save to user's connectedPages (no duplicates) ─────────
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

  logger.info(`Instagram Business Login done for user ${userId} — @${profile.username} connected (igUserId:${igUserId}, webhookPageId:${webhookPageId})`);
  return { connectedPages: [{ pageId: igUserId, pageName: profile.username, platform: 'instagram' }] };
};

// ── Send / Resend Verification Email ─────────────────────────────────
const sendVerification = async (email) => {
  const user = await User.findOne({ email });
  if (!user) return; // silent — prevent enumeration

  if (user.isEmailVerified) return; // already verified, nothing to do

  const rawToken = await createVerificationToken(user);
  const verifyLink = `${env.FRONTEND_URL}/verify-email?token=${rawToken}`;
  const { sendEmail } = require('../../utils/email');

  await sendEmail({
    to: email,
    subject: 'Verify your Comment Kro email address',
    html: verificationTemplate(email, verifyLink),
  });
};

// ── Verify Email ──────────────────────────────────────────────────────
const verifyEmail = async (rawToken) => {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const user = await User.findOne({
    emailVerificationToken: tokenHash,
    emailVerificationExpires: { $gt: Date.now() },
  });

  if (!user) throw Object.assign(new Error('Verification link is invalid or has expired.'), { statusCode: 400 });

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  logger.info(`Email verified for user ${user._id}`);
  return { message: 'Email verified successfully.' };
};

module.exports = { register, login, refreshAccessToken, forgotPassword, resetPassword, handleMetaCallback, sendVerification, verifyEmail };
