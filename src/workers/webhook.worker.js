/**
 * ─────────────────────────────────────────────────────────────────────
 * Comment Please — Webhook Handler (in-process, Redis-free)
 *
 * Flow:
 *  webhook controller → safeAdd('webhook') → this handler → keyword
 *  matching → safeAdd('message') → Meta Graph API → DM sent
 * ─────────────────────────────────────────────────────────────────────
 */
const { registerHandler } = require('../config/queues');
const { processCommentEvent, processMessageEvent, processStoryMentionEvent } = require('../modules/automation/automation.service');
const logger = require('../utils/logger');

registerHandler('webhook', async (jobName, data) => {
  const { platform, entry, traceId } = data;
  logger.info(`[WebhookHandler] ${jobName} — platform: ${platform}`, { traceId });

  if (platform === 'instagram') {
    await processInstagramEntry(entry, traceId);
  } else if (platform === 'facebook') {
    await processFacebookEntry(entry, traceId);
  } else {
    logger.warn(`[WebhookHandler] Unknown platform: ${platform}`);
  }
});

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

  if (entry.field === 'mentions' && entry.value) {
    const { media_id: mediaId, comment_id: mentionId } = entry.value;
    if (mediaId || mentionId) {
      await processStoryMentionEvent({ pageId, mediaId, mentionId, traceId });
    }
    return;
  }

  // Facebook Login format: entry.changes array (fallback)
  for (const change of entry.changes || []) {
    if (change.field === 'mentions') {
      const { media_id: mediaId, comment_id: mentionId } = change.value || {};
      if (mediaId || mentionId) {
        await processStoryMentionEvent({ pageId, mediaId, mentionId, traceId });
      }
      continue;
    }
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

logger.info('🔄 Webhook handler registered (in-process) — handles "webhook" jobs');
