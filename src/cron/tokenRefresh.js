/**
 * Token refresh cron — runs every day at 2 AM.
 * Finds tokens expiring within 7 days and exchanges them
 * for new long-lived tokens via the Meta Graph API.
 *
 * Run this as a separate lightweight process or via a job scheduler
 * (e.g., node-cron, Railway cron, AWS EventBridge).
 *
 * Usage: node src/cron/tokenRefresh.js
 */
require('dotenv').config();
const connectDB = require('../config/db');
const { refreshExpiringTokens } = require('../modules/token/token.service');
const logger = require('../utils/logger');

const run = async () => {
  logger.info('⏰ Token refresh cron starting...');
  await connectDB();

  try {
    const result = await refreshExpiringTokens();
    logger.info('Token refresh cron finished', result);
    process.exit(0);
  } catch (err) {
    logger.error('Token refresh cron failed', err);
    process.exit(1);
  }
};

run();
