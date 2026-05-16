const logger = require('../utils/logger');

/**
 * BullMQ queues — only initialized when Redis is available.
 * If Redis is unavailable, all add() calls become no-ops so the
 * API server can still handle auth and management routes.
 */

let queues = {};
let redisAvailable = false;

// Lazy-initialise: the webhook controller calls getQueue() at request time,
// so the import itself never crashes the process.
const getQueues = () => {
  if (redisAvailable) return queues;

  try {
    const { Queue } = require('bullmq');
    const { redisConfig } = require('./redis');

    const defaultJobOptions = {
      removeOnComplete: { count: 1000 },
      removeOnFail:     { count: 5000 },
    };

    const webhookQueue = new Queue('webhook-events', {
      connection: redisConfig,
      defaultJobOptions: { ...defaultJobOptions, attempts: 5, backoff: { type: 'exponential', delay: 1000 } },
    });

    const messageQueue = new Queue('outbound-messages', {
      connection: redisConfig,
      defaultJobOptions: { ...defaultJobOptions, attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    });

    const analyticsQueue = new Queue('analytics-events', {
      connection: redisConfig,
      defaultJobOptions: { ...defaultJobOptions, attempts: 2, backoff: { type: 'fixed', delay: 5000 } },
    });

    const deadLetterQueue = new Queue('dead-letter-queue', {
      connection: redisConfig,
      defaultJobOptions: { removeOnComplete: false, removeOnFail: false },
    });

    queues = { webhookQueue, messageQueue, analyticsQueue, deadLetterQueue };
    redisAvailable = true;

    Object.values(queues).forEach((q) => logger.info(`📦 Queue ready: ${q.name}`));
  } catch (err) {
    logger.warn(`⚠️  Queues unavailable (Redis not running): ${err.message}`);
  }

  return queues;
};

/**
 * Safe add — adds a job if Redis is available, silently skips otherwise.
 */
const safeAdd = async (queueName, jobName, data, opts = {}) => {
  const q = getQueues();
  const queue = q[`${queueName}Queue`] || q[queueName];
  if (!queue) {
    logger.debug(`Queue '${queueName}' unavailable — skipping job '${jobName}'`);
    return null;
  }
  return queue.add(jobName, data, opts);
};

module.exports = { getQueues, safeAdd };
