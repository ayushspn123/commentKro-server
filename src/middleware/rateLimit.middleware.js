const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Creates a rate limiter.
 * In production, use Redis store (rate-limit-redis).
 * In development without Redis, falls back to in-memory store automatically.
 */
const createLimiter = (options) => {
  const limiterOptions = {
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: 'Too many requests — please try again later.',
        retryAfter: Math.ceil(options.windowMs / 1000),
      });
    },
    skip: () => {
      // In dev, skip rate limiting entirely if Redis isn't available
      // (express-rate-limit's default in-memory store is fine for dev)
      return false;
    },
    ...options,
  };

  // Try to use Redis store in production
  if (process.env.NODE_ENV === 'production') {
    try {
      const { RedisStore } = require('rate-limit-redis');
      const { redisClient } = require('../config/redis');
      limiterOptions.store = new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
      });
      logger.debug('Rate limiter using Redis store');
    } catch {
      logger.warn('Redis store unavailable — using in-memory rate limiting');
    }
  }
  // In dev: no store set = express-rate-limit uses built-in MemoryStore (no Redis needed)

  return rateLimit(limiterOptions);
};

// ── Limiters ──────────────────────────────────────────────────────────

// General API rate limiter — 100 req / 15 min
const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.user?.id || req.ip,
});

// Strict limiter for auth routes — 20 req / 15 min
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.ip,
});

// Webhook limiter (permissive — Meta sends bursts)
const webhookLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 500,
  keyGenerator: (req) => req.ip,
});

module.exports = { apiLimiter, authLimiter, webhookLimiter };
