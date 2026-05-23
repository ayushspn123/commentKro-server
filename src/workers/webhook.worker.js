/**
 * ─────────────────────────────────────────────────────────────────────
 * Comment Please — Webhook Worker
 * Run: node src/workers/webhook.worker.js
 *
 * Flow:
 *  webhook-events queue → parse Meta payload → run keyword matching
 *  → enqueue DM jobs on outbound-messages queue → Meta Graph API → DM sent
 * ─────────────────────────────────────────────────────────────────────
 */
const { Worker } = require('bullmq');
const { redisConfig } = require('../config/redis');
const { safeAdd } = require('../config/queues');
const { processCommentEvent, processMessageEvent } = require('../modules/automation/automation.service');
const logger = require('../utils/logger');

const webhookWorker = new Worker(
  'webhook-events',
  async (job) => {
    const { platform, entry, traceId } = job.data;
    logger.info(`[WebhookWorker] Job ${job.id} — platform: ${platform}`, { traceId });

    if (platform === 'instagram') {
      await processInstagramEntry(entry, traceId);
    } else if (platform === 'facebook') {
      await processFacebookEntry(entry, traceId);
    } else {
      logger.warn(`[WebhookWorker] Unknown platform: ${platform}`);
    }
  },
  { connection: redisConfig, concurrency: 20 }
);

// ── Instagram comment parser ────────────────────────────────────────
const processInstagramEntry = async (entry, traceId) => {
  const pageId = entry.id;

  // Instagram Business Login format: entry.field + entry.value (no changes array)
  if (entry.field === 'comments' && entry.value) {
    const { id: commentId, text: commentText, from, media } = entry.value;
    if (from?.id && commentText) {
      await processCommentEvent({
        pageId,
        commenterId: from.id,
        commentText,
        commentId,
        mediaId: media?.id,
        platform: 'instagram',
        traceId,
      });
    }
    return;
  }

  // Facebook Login format: entry.changes array (fallback)
  for (const change of entry.changes || []) {
    if (change.field !== 'comments') continue;

    const { id: commentId, text: commentText, from, media } = change.value || {};
    if (!from?.id || !commentText) continue;

    await processCommentEvent({
      pageId,
      commenterId: from.id,
      commentText,
      commentId,
      mediaId: media?.id,
      platform: 'instagram',
      traceId,
    });
  }
};

// ── Facebook Messenger parser ───────────────────────────────────────
const processFacebookEntry = async (entry, traceId) => {
  const pageId = entry.id;

  for (const event of entry.messaging || []) {
    const senderId = event.sender?.id;
    const messageText = event.message?.text;
    if (!senderId || !messageText) continue;

    await processMessageEvent({
      pageId,
      senderId,
      messageText,
      platform: 'facebook',
      traceId,
    });
  }
};

// ── Worker events ──────────────────────────────────────────────────
webhookWorker.on('completed', (job) => {
  logger.info(`[WebhookWorker] Job ${job.id} completed`);
});

webhookWorker.on('failed', async (job, err) => {
  logger.error(`[WebhookWorker] Job ${job?.id} failed: ${err.message}`);

  // After max retries — move to dead-letter queue
  if (job && job.attemptsMade >= (job.opts?.attempts ?? 5)) {
    await safeAdd('deadLetter', 'webhook-failed', {
      originalJob: job.name,
      data: job.data,
      error: err.message,
      failedAt: new Date().toISOString(),
    });
    logger.warn(`[WebhookWorker] Job ${job.id} moved to DLQ after ${job.attemptsMade} attempts`);
  }
});

webhookWorker.on('error', (err) => {
  logger.error(`[WebhookWorker] Error: ${err.message}`);
});

logger.info('🔄 Webhook worker started (concurrency: 20) — listening on "webhook-events"');
