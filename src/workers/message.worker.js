/**
 * ─────────────────────────────────────────────────────────────────────
 * Comment Please — Message Worker
 * Run: node src/workers/message.worker.js
 *
 * Processes jobs from the 'outbound-messages' queue:
 *   - send_dm      → calls Meta Graph API to send a DM
 *   - reply_comment → calls Meta Graph API to reply to a comment
 * ─────────────────────────────────────────────────────────────────────
 */
require('dotenv').config();
const { Worker } = require('bullmq');
const { redisConfig } = require('../config/redis');
const { safeAdd } = require('../config/queues');
const messagingService = require('../modules/messaging/messaging.service');
const Automation = require('../modules/automation/automation.model');
const logger = require('../utils/logger');

const messageWorker = new Worker(
  'outbound-messages',
  async (job) => {
    const { userId, pageId, platform, recipientId, commentId, automationId, message, traceId } = job.data;

    logger.info(`[MessageWorker] Job ${job.id} (${job.name}) → recipient: ${recipientId}`, { traceId });

    if (job.name === 'send_dm') {
      await messagingService.sendDM({ userId, pageId, platform, recipientId, message, automationId, traceId });
    } else if (job.name === 'reply_comment' && commentId) {
      await messagingService.replyToComment({ userId, pageId, commentId, message, traceId });
    }

    // Increment sent counter
    if (automationId) {
      await Automation.findByIdAndUpdate(automationId, { $inc: { 'stats.sent': 1 } }).catch(() => {});
    }
  },
  {
    connection: redisConfig,
    concurrency: 50,
    limiter: { max: 200, duration: 3_600_000 }, // 200 msgs/hr per queue
  }
);

messageWorker.on('completed', (job) => {
  logger.info(`[MessageWorker] Job ${job.id} completed`);
});

messageWorker.on('failed', async (job, err) => {
  logger.error(`[MessageWorker] Job ${job?.id} failed: ${err.message}`);

  if (job?.data?.automationId) {
    await Automation.findByIdAndUpdate(job.data.automationId, { $inc: { 'stats.failed': 1 } }).catch(() => {});
  }

  if (job && job.attemptsMade >= (job.opts?.attempts ?? 3)) {
    await safeAdd('deadLetter', 'message-failed', {
      originalJob: job.name,
      data: job.data,
      error: err.message,
      failedAt: new Date().toISOString(),
    });
  }
});

messageWorker.on('error', (err) => {
  logger.error(`[MessageWorker] Error: ${err.message}`);
});

logger.info('📤 Message worker started (concurrency: 50) — listening on "outbound-messages"');
