const Automation = require('../automation/automation.model');
const { messageQueue, analyticsQueue } = require('../../config/queues');
const { matchesKeywords, interpolateTemplate, generateTraceId } = require('../../utils/helpers');
const logger = require('../../utils/logger');

/**
 * Core dispatcher: given a parsed webhook event,
 * finds all matching automations and enqueues action jobs.
 *
 * Used by both the webhook worker (queue-based) and
 * can be called directly in tests.
 *
 * @param {'instagram'|'facebook'} platform
 * @param {string} pageId
 * @param {object} event  - { senderId, text, commentId?, mediaId? }
 * @param {string} [traceId]
 * @returns {{ triggered: number }}
 */
const dispatchWebhookEvent = async (platform, pageId, event, traceId = generateTraceId()) => {
  const { senderId, text, commentId = null, mediaId = null } = event;

  if (!text || !senderId) {
    logger.warn('Webhook event missing text or senderId — skipping', { traceId });
    return { triggered: 0 };
  }

  const automations = await Automation.find({
    pageId,
    platform,
    isActive: true,
    'trigger.type': commentId ? 'comment' : 'message',
  }).lean();

  let triggered = 0;

  for (const automation of automations) {
    const { keywords, matchType, caseSensitive } = automation.trigger;

    if (!matchesKeywords(text, keywords, matchType, caseSensitive)) continue;

    for (const action of automation.actions) {
      const renderedMessage = interpolateTemplate(action.template, {
        sender_id: senderId,
        comment_text: text,
      });

      await messageQueue.add(
        action.type,
        {
          userId: String(automation.userId),
          pageId,
          platform,
          recipientId: senderId,
          commentId,
          mediaId,
          automationId: String(automation._id),
          message: renderedMessage,
          traceId,
        },
        { delay: action.delay ?? 0 }
      );
    }

    await Automation.findByIdAndUpdate(automation._id, { $inc: { 'stats.triggered': 1 } });

    await analyticsQueue.add('automation-triggered', {
      userId: String(automation.userId),
      automationId: String(automation._id),
      platform,
      traceId,
    });

    triggered++;
  }

  logger.info(`dispatchWebhookEvent: ${triggered} automation(s) triggered`, {
    platform,
    pageId,
    traceId,
  });

  return { triggered };
};

/**
 * Parse raw Instagram webhook entry into a normalised event
 * @param {object} entry - entry from Instagram webhook payload
 * @returns {Array<{pageId, event}>}
 */
const parseInstagramEntry = (entry) => {
  const pageId = entry.id;
  const events = [];

  for (const change of entry.changes || []) {
    if (change.field === 'comments') {
      events.push({
        pageId,
        event: {
          senderId: change.value?.from?.id,
          text: change.value?.text,
          commentId: change.value?.id,
          mediaId: change.value?.media?.id,
        },
      });
    } else if (change.field === 'messages') {
      const messaging = change.value?.messages?.[0];
      if (messaging) {
        events.push({
          pageId,
          event: {
            senderId: messaging.from,
            text: messaging.message,
            commentId: null,
            mediaId: null,
          },
        });
      }
    }
  }

  return events;
};

/**
 * Parse raw Facebook webhook entry into normalised events
 * @param {object} entry
 */
const parseFacebookEntry = (entry) => {
  const pageId = entry.id;
  const events = [];

  for (const msg of entry.messaging || []) {
    if (msg.message?.text) {
      events.push({
        pageId,
        event: {
          senderId: msg.sender?.id,
          text: msg.message.text,
          commentId: null,
          mediaId: null,
        },
      });
    }
  }

  return events;
};

module.exports = { dispatchWebhookEvent, parseInstagramEntry, parseFacebookEntry };
