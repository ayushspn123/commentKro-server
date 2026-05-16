const axios = require('axios');
const Token = require('./token.model');
const { encrypt, decrypt } = require('../../utils/crypto');
const { redisClient } = require('../../config/redis');
const logger = require('../../utils/logger');
const env = require('../../config/env');

const META_GRAPH_BASE = `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}`;
const TOKEN_CACHE_TTL = 1800; // 30 min

/**
 * Store or update a page access token (encrypted) in DB + Redis cache
 */
const upsertToken = async ({ userId, pageId, platform, rawToken, expiresIn, scopes = [] }) => {
  const encryptedToken = encrypt(rawToken);
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  const token = await Token.findOneAndUpdate(
    { userId, pageId, platform },
    {
      userId,
      pageId,
      platform,
      accessToken: encryptedToken,
      expiresAt,
      scopes,
      refreshedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  // Warm the cache
  const cacheKey = `token:${userId}:${pageId}:${platform}`;
  await redisClient.set(cacheKey, rawToken, 'EX', TOKEN_CACHE_TTL);

  logger.info(`Token stored for page ${pageId} [${platform}]`);
  return token;
};

/**
 * Get decrypted access token — checks Redis cache first, then DB
 */
const getDecryptedToken = async (userId, pageId, platform) => {
  const cacheKey = `token:${userId}:${pageId}:${platform}`;

  // Cache hit
  const cached = await redisClient.get(cacheKey);
  if (cached) return cached;

  // DB lookup
  const token = await Token.findOne({ userId, pageId, platform }).select('+accessToken');
  if (!token) throw Object.assign(new Error(`No token for page ${pageId}`), { statusCode: 404 });
  if (token.expiresAt < new Date()) throw Object.assign(new Error('Token expired'), { statusCode: 401 });

  const decrypted = decrypt(token.accessToken);

  // Re-warm cache
  await redisClient.set(cacheKey, decrypted, 'EX', TOKEN_CACHE_TTL);

  return decrypted;
};

/**
 * Exchange a short-lived token for a long-lived one (60 days)
 */
const exchangeForLongLived = async (shortToken) => {
  const res = await axios.get(`${META_GRAPH_BASE}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: env.META_APP_ID,
      client_secret: env.META_APP_SECRET,
      fb_exchange_token: shortToken,
    },
  });
  return { token: res.data.access_token, expiresIn: res.data.expires_in || 5183944 };
};

/**
 * Refresh tokens that expire within the next 7 days.
 * Run as a daily cron job.
 */
const refreshExpiringTokens = async () => {
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const expiringTokens = await Token.find({
    expiresAt: { $lte: sevenDaysFromNow },
  }).select('+accessToken');

  logger.info(`Found ${expiringTokens.length} token(s) expiring soon`);

  const results = { refreshed: 0, failed: 0 };

  for (const token of expiringTokens) {
    try {
      const raw = decrypt(token.accessToken);
      const { token: newToken, expiresIn } = await exchangeForLongLived(raw);

      await upsertToken({
        userId: token.userId,
        pageId: token.pageId,
        platform: token.platform,
        rawToken: newToken,
        expiresIn,
        scopes: token.scopes,
      });

      results.refreshed++;
    } catch (err) {
      logger.error(`Failed to refresh token for page ${token.pageId}:`, err.message);
      results.failed++;
    }
  }

  logger.info('Token refresh cycle complete', results);
  return results;
};

/**
 * Revoke a token and remove from DB + cache
 */
const revokeToken = async (userId, pageId, platform) => {
  await Token.findOneAndDelete({ userId, pageId, platform });

  const cacheKey = `token:${userId}:${pageId}:${platform}`;
  await redisClient.del(cacheKey);

  logger.info(`Token revoked for page ${pageId} [${platform}]`);
};

/**
 * List all connected pages for a user
 */
const listUserTokens = async (userId) => {
  return Token.find({ userId }).select('-accessToken').lean();
};

module.exports = {
  upsertToken,
  getDecryptedToken,
  exchangeForLongLived,
  refreshExpiringTokens,
  revokeToken,
  listUserTokens,
};
