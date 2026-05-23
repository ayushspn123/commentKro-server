require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');

const env = require('./config/env');
const logger = require('./utils/logger');
const errorMiddleware = require('./middleware/error.middleware');
const { apiLimiter } = require('./middleware/rateLimit.middleware');

// Route modules
const authRoutes = require('./modules/auth/auth.routes');
const webhookRoutes = require('./modules/webhook/webhook.routes');
const automationRoutes = require('./modules/automation/automation.routes');
const analyticsRoutes = require('./modules/analytics/analytics.routes');
const tokenRoutes = require('./modules/token/token.routes');
const metaRoutes = require('./modules/meta/meta.routes');

const app = express();

// ── Security headers ─────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = [
        env.FRONTEND_URL || 'http://localhost:3000',
        'http://localhost:3000',
        'http://localhost:3001',
        'https://comment-kro-client-vcjf.vercel.app',
      ].map(u => u.replace(/\/$/, '')); // strip trailing slashes
      const originClean = (origin || '').replace(/\/$/, '');
      if (!origin || allowed.includes(originClean)) return callback(null, true);
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Set-Cookie'],
  })
);

// ── Request tracing ───────────────────────────────────────────────────
app.use((req, res, next) => {
  req.traceId = uuidv4();
  res.setHeader('X-Trace-Id', req.traceId);
  next();
});

// ── Logging ───────────────────────────────────────────────────────────
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip: (req) => req.path === '/api/health',
  })
);

// ── Body parsing ──────────────────────────────────────────────────────
// NOTE: Webhook routes register their own raw body capture middleware.
// JSON parser should NOT be applied globally before webhook routes.
app.use('/api/auth', express.json({ limit: '1mb' }));
app.use('/api/automations', express.json({ limit: '1mb' }));
app.use('/api/analytics', express.json({ limit: '1mb' }));
app.use('/api/tokens', express.json({ limit: '1mb' }));
app.use('/api/meta', express.json({ limit: '1mb' }));
app.use(compression());
app.use(cookieParser());

// ── Rate limiting ─────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ── Routes ────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/meta', metaRoutes);

// ── Health check ──────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  let redisStatus = 'disconnected';
  try {
    const { redisClient } = require('./config/redis');
    await redisClient.ping();
    redisStatus = 'connected';
  } catch {}

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
    redis: redisStatus,
    workers: redisStatus === 'connected' ? 'running' : 'stopped',
  });
});

// ── Privacy & Terms (required for Meta app publishing) ───────────────
app.get('/privacy', (_req, res) => {
  res.send(`<html><body><h1>Privacy Policy</h1><p>commentPlease does not sell or share your data. Instagram tokens are encrypted and stored securely. You can disconnect your account at any time.</p></body></html>`);
});

app.get('/terms', (_req, res) => {
  res.send(`<html><body><h1>Terms of Service</h1><p>By using commentPlease, you agree to use the service in accordance with Instagram's terms of service.</p></body></html>`);
});

// ── 404 handler ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────
app.use(errorMiddleware);

module.exports = app;
