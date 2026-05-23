const { Worker } = require('bullmq');
const { redisConfig } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Analytics Worker — handles async stats aggregation.
 */
const analyticsWorker = new Worker(
  'analytics-events',
  async (job) => {
    const { userId, automationId, platform, traceId } = job.data;

    if (job.name === 'automation-triggered') {
      // Could push to a time-series DB or increment Redis HLL counters
      logger.info('Analytics event: automation triggered', { userId, automationId, platform, traceId });
      // Placeholder: increment daily counter in Redis
      const { redisClient } = require('../config/redis');
      const key = `analytics:${userId}:${new Date().toISOString().slice(0, 10)}`;
      await redisClient.incr(key);
      await redisClient.expire(key, 90 * 24 * 60 * 60); // 90-day TTL
    }
  },
  {
    connection: redisConfig,
    concurrency: 5,
  }
);

analyticsWorker.on('failed', (job, err) => {
  logger.error(`Analytics job failed: ${job?.id}`, { error: err.message });
});

logger.info('🔧 Analytics worker started (concurrency: 5)');

module.exports = analyticsWorker;
