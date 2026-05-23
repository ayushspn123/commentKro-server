require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const env = require('./config/env');

const PORT = env.PORT || 5000;

const startServer = async () => {
  // ── MongoDB (required) ─────────────────────────────────────────────
  await connectDB();

  // ── Workers (BullMQ manages its own Redis connection) ─────────────
  logger.info('Starting workers...');
  require('./workers/webhook.worker');
  require('./workers/message.worker');
  require('./workers/analytics.worker');
  logger.info('✅ All workers started in-process');

  // ── HTTP Server ────────────────────────────────────────────────────
  const server = app.listen(PORT, () => {
    logger.info(`🚀 API Server running on port ${PORT} [${env.NODE_ENV}]`);
  });

  // ── Graceful shutdown ──────────────────────────────────────────────
  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully…`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    // Suppress known ioredis noise when Redis is not available in dev
    if (msg.includes('Connection is closed') || msg.includes('ECONNREFUSED')) return;
    logger.error('Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('💥 UNCAUGHT EXCEPTION:', err.message);
    console.error(err.stack);
    logger.error('Uncaught Exception:', { message: err.message, stack: err.stack });
    process.exit(1);
  });
};

startServer();
