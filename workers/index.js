require('dotenv').config({ path: '../.env' });
const connectDB = require('../src/config/db');
const logger = require('../src/utils/logger');

// Import workers
const webhookWorker = require('../src/workers/webhook.worker');
const messageWorker = require('../src/workers/message.worker');
const analyticsWorker = require('../src/workers/analytics.worker');

const startWorkers = async () => {
  logger.info('Starting worker process...');

  await connectDB();

  logger.info('✅ All workers running');
  logger.info('  → webhook-events worker (concurrency: 20)');
  logger.info('  → outbound-messages worker (concurrency: 50)');
  logger.info('  → analytics-events worker (concurrency: 5)');

  const shutdown = async (signal) => {
    logger.info(`${signal} received. Closing workers...`);
    await webhookWorker.close();
    await messageWorker.close();
    await analyticsWorker.close();
    logger.info('All workers gracefully stopped');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startWorkers();
