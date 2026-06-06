/**
 * ─────────────────────────────────────────────────────────────────────
 * Comment Please — Message Handler (in-process, Redis-free)
 *
 * Handles 'message' jobs:
 *   - send_dm       → calls Meta Graph API to send a DM
 *   - reply_comment → calls Meta Graph API to reply to a comment
 * ─────────────────────────────────────────────────────────────────────
 */
const { registerHandler, safeAdd } = require('../config/queues');
const messagingService = require('../modules/messaging/messaging.service');
const Automation = require('../modules/automation/automation.model');
const logger = require('../utils/logger');

registerHandler('message', async (jobName, data) => {
  const {
    userId, pageId, platform, recipientId, commentId, automationId,
    message, traceId, replyOnDmSent, replyOnDmSentMessage,
  } = data;

  logger.info(`[MessageHandler] ${jobName} → recipient: ${recipientId}`, { traceId });

  try {
    if (jobName === 'send_dm') {
      await messagingService.sendDM({ userId, pageId, platform, recipientId, message, automationId, traceId });

      // After DM sent → reply to original comment notifying user
      if (replyOnDmSent && commentId && replyOnDmSentMessage) {
        await safeAdd('message', 'reply_comment', {
          userId, pageId, platform, recipientId, commentId, automationId,
          message: replyOnDmSentMessage,
          traceId,
        }, { delay: 2000 }); // small delay so DM arrives first
        logger.info(`[MessageHandler] Scheduled comment reply after DM sent`, { traceId });
      }

    } else if (jobName === 'reply_comment' && commentId) {
      await messagingService.replyToComment({ userId, pageId, commentId, message, traceId });
    }

    // Increment sent counter
    if (automationId) {
      await Automation.findByIdAndUpdate(automationId, { $inc: { 'stats.sent': 1 } }).catch(() => {});
    }
  } catch (err) {
    logger.error(`[MessageHandler] ${jobName} failed: ${err.message}`, { traceId });
    if (automationId) {
      await Automation.findByIdAndUpdate(automationId, { $inc: { 'stats.failed': 1 } }).catch(() => {});
    }
    throw err; // let the dispatcher log it as a failed job
  }
});

logger.info('📤 Message handler registered (in-process) — handles "message" jobs');
