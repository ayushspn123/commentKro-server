const rateLimit = require('express-rate-limit');

/**
 * Creates a rate limiter using express-rate-limit's built-in in-memory store
 * (Redis-free). State is per-instance — fine for a single-instance deployment.
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
    skip: (req) => req.method === 'OPTIONS',
    ...options,
  };

  return rateLimit(limiterOptions);
};

// ── Limiters ──────────────────────────────────────────────────────────

// Dashboard read limiter — GET requests for stats/usage/me/automations
// Higher limit because the dashboard fires several reads on every page load
const dashboardReadLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => req.method !== 'GET',
});

// General API limiter — all other authenticated routes (writes, etc.)
const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  keyGenerator: (req) => req.user?.id || req.ip,
});

// Strict limiter for auth routes — 20 req / 15 min per IP
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

module.exports = { apiLimiter, authLimiter, webhookLimiter, dashboardReadLimiter };
