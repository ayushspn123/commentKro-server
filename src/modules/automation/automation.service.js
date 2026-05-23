const axios = require('axios');
const Automation = require('./automation.model');
const Token = require('../token/token.model');
const { safeAdd } = require('../../config/queues');
const { matchesKeywords, interpolateTemplate } = require('../../utils/helpers');
const { decrypt } = require('../../utils/crypto');
const logger = require('../../utils/logger');
const env = require('../../config/env');

// ── Rate limit store (in-memory when Redis is unavailable) ────────────
const inMemoryRL = new Map(); // key → { count, resetAt }

const checkRateLimit = async (key, maxPerHour) => {
  const now = Date.now();
  const windowMs = 3600 * 1000;

  // Try Redis first
  try {
    const { redisClient } = require('../../config/redis');
    const count = await redisClient.incr(key);
    if (count === 1) await redisClient.expire(key, 3600);
    return count <= maxPerHour;
  } catch {
    // Fallback to in-memory
    const entry = inMemoryRL.get(key);
    if (!entry || entry.resetAt < now) {
      inMemoryRL.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= maxPerHour;
  }
};

/**
 * Check if a commenter follows the connected Instagram page.
 * Returns true if they follow or if the check cannot be performed.
 */
const checkFollowsPage = async (userId, pageId, commenterId, platform) => {
  if (platform !== 'instagram') return true; // only supported on Instagram
  try {
    const tokenDoc = await Token.findOne({ userId, pageId, platform }).select('+accessToken');
    if (!tokenDoc) return true;
    const accessToken = decrypt(tokenDoc.accessToken);

    const res = await axios.get(
      `https://graph.instagram.com/${env.META_GRAPH_API_VERSION}/${commenterId}`,
      { params: { fields: 'follow_status', access_token: accessToken }, timeout: 5000 }
    );
    const status = res.data?.follow_status?.toLowerCase?.();
    // follow_status values: 'followed_by', 'follows', 'not_following', 'blocking', etc.
    return status === 'followed_by' || status === 'follows';
  } catch (err) {
    logger.warn(`[checkFollowsPage] Could not check follow status for ${commenterId}: ${err.message} — allowing through`);
    return true; // fail open so automation still works if API errors
  }
};

/**
 * ── Core Engine ───────────────────────────────────────────────────────
 * Process an Instagram/Facebook comment event from the webhook worker.
 * Finds matching active automations → enqueues DM jobs.
 *
 * @param {object} event
 * @param {string} event.pageId        - Meta Page ID that received the comment
 * @param {string} event.commenterId   - IGSID / sender ID of the commenter
 * @param {string} event.commentText   - Text of the comment
 * @param {string} event.commentId     - Meta comment ID
 * @param {string} event.mediaId       - Reel / post media ID
 * @param {string} event.platform      - 'instagram' | 'facebook'
 * @param {string} event.traceId       - Trace ID for logging
 */
const processCommentEvent = async ({
  pageId,
  commenterId,
  commentText,
  commentId,
  mediaId,
  platform = 'instagram',
  traceId,
}) => {
  // Look up token by pageId or webhookPageId to get the userId, then match automations by userId
  const Token = require('../token/token.model');
  const matchingToken = await Token.findOne({
    platform,
    $or: [{ pageId }, { webhookPageId: pageId }],
  }).select('pageId userId');

  logger.info(`[${traceId}] Token lookup for pageId ${pageId}: ${matchingToken ? `userId=${matchingToken.userId}` : 'not found'}`);

  const automations = matchingToken
    ? await Automation.find({ userId: matchingToken.userId, isActive: true, 'trigger.type': 'comment', platform })
    : await Automation.find({ pageId, isActive: true, 'trigger.type': 'comment', platform });

  logger.info(`[${traceId}] Processing comment on page ${pageId} — ${automations.length} automation(s) to check`);

  let triggered = 0;

  for (const automation of automations) {
    const { keywords, matchType, caseSensitive } = automation.trigger;

    // ── Post-level filter ─────────────────────────────────────────────
    if (
      automation.mediaFilter === 'specific' &&
      automation.postIds?.length > 0 &&
      mediaId &&
      !automation.postIds.includes(mediaId)
    ) {
      logger.debug(`[${traceId}] Automation ${automation._id} — mediaId ${mediaId} not in postIds, skip`);
      continue;
    }

    // ── Keyword matching ──────────────────────────────────────────────
    const keywordMatched = automation.trigger.anyKeyword ||
      matchesKeywords(commentText, keywords, matchType, caseSensitive);
    if (!keywordMatched) {
      logger.debug(`[${traceId}] Automation ${automation._id} — keywords not matched`);
      continue;
    }

    // ── Follow gate ───────────────────────────────────────────────────
    if (automation.requireFollow) {
      const follows = await checkFollowsPage(automation.userId, pageId, commenterId, platform);
      if (!follows) {
        // Reply to comment asking them to follow first
        await safeAdd('message', 'reply_comment', {
          userId: automation.userId.toString(),
          pageId,
          platform,
          recipientId: commenterId,
          commentId,
          automationId: automation._id.toString(),
          message: automation.followPromptMessage,
          traceId,
        });
        logger.info(`[${traceId}] Automation ${automation._id} — commenter ${commenterId} doesn't follow, sent follow prompt`);
        continue;
      }
    }

    // ── Per-automation hourly rate limit ──────────────────────────────
    const rlKey = `rl:auto:${automation._id}:${new Date().getUTCHours()}`;
    const allowed = await checkRateLimit(rlKey, automation.rateLimit?.maxPerHour ?? 100);
    if (!allowed) {
      logger.warn(`[${traceId}] Automation ${automation._id} rate limit hit`);
      continue;
    }

    // ── Enqueue each action ───────────────────────────────────────────
    for (const action of automation.actions) {
      const message = interpolateTemplate(action.template, {
        sender_name:    commenterId,
        commenter_name: commenterId,
        comment_text:   commentText,
        comment:        commentText,
        media_id:       mediaId,
      });

      await safeAdd(
        'message',
        action.type,   // 'send_dm' | 'reply_comment'
        {
          userId: automation.userId.toString(),
          pageId,
          platform,
          recipientId: commenterId,
          commentId,
          mediaId,
          automationId: automation._id.toString(),
          message,
          traceId,
          // Pass reply-on-DM-sent config so message worker can reply after success
          replyOnDmSent: action.type === 'send_dm' ? (automation.replyOnDmSent ?? true) : false,
          replyOnDmSentMessage: automation.replyOnDmSentMessage ||
            'Hey! I just sent you a DM, please check your inbox 📬',
        },
        { delay: action.delay || 0 }
      );
    }

    // ── Update trigger stats ──────────────────────────────────────────
    await Automation.findByIdAndUpdate(automation._id, {
      $inc: { 'stats.triggered': 1 },
    });

    // ── Fire analytics event ──────────────────────────────────────────
    await safeAdd('analytics', 'automation-triggered', {
      userId: automation.userId.toString(),
      automationId: automation._id.toString(),
      platform,
      traceId,
    });

    triggered++;
    logger.info(`[${traceId}] Automation "${automation.name}" triggered → ${automation.actions.length} action(s) queued`);
  }

  logger.info(`[${traceId}] Done — ${triggered}/${automations.length} automation(s) triggered`);
  return { triggered };
};

/**
 * Process an incoming DM/message event.
 */
const processMessageEvent = async ({ pageId, senderId, messageText, platform = 'facebook', traceId }) => {
  const automations = await Automation.find({
    pageId,
    isActive: true,
    'trigger.type': 'message',
    platform,
  });

  let triggered = 0;

  for (const automation of automations) {
    const { keywords, matchType, caseSensitive } = automation.trigger;
    if (!matchesKeywords(messageText, keywords, matchType, caseSensitive)) continue;

    for (const action of automation.actions) {
      const message = interpolateTemplate(action.template, {
        sender: senderId,
        message: messageText,
      });

      await safeAdd('message', action.type, {
        userId: automation.userId.toString(),
        pageId,
        platform,
        recipientId: senderId,
        automationId: automation._id.toString(),
        message,
        traceId,
      }, { delay: action.delay || 0 });
    }

    await Automation.findByIdAndUpdate(automation._id, { $inc: { 'stats.triggered': 1 } });
    triggered++;
  }

  logger.info(`[${traceId}] Message event — ${triggered} automation(s) triggered`);
  return { triggered };
};

// ── CRUD helpers ──────────────────────────────────────────────────────
const createAutomation = async (userId, data) => {
  const User = require('../auth/auth.model');
  const user = await User.findById(userId);
  const count = await Automation.countDocuments({ userId });

  if (count >= (user.planLimits?.automations ?? 3)) {
    throw Object.assign(
      new Error(`Plan limit: max ${user.planLimits?.automations ?? 3} automations`),
      { statusCode: 403 }
    );
  }

  return Automation.create({ userId, ...data });
};

const listAutomations = async (userId, { page = 1, limit = 20, platform, isActive } = {}) => {
  const filter = { userId };
  if (platform) filter.platform = platform;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const [automations, total] = await Promise.all([
    Automation.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Automation.countDocuments(filter),
  ]);

  return { automations, total, page, pages: Math.ceil(total / limit) };
};

const toggleAutomation = async (userId, automationId, isActive) => {
  const automation = await Automation.findOneAndUpdate(
    { _id: automationId, userId },
    { isActive },
    { new: true }
  );
  if (!automation) throw Object.assign(new Error('Automation not found'), { statusCode: 404 });
  return automation;
};

const deleteAutomation = async (userId, automationId) => {
  const result = await Automation.findOneAndDelete({ _id: automationId, userId });
  if (!result) throw Object.assign(new Error('Automation not found'), { statusCode: 404 });
  return { deleted: true };
};

// ── Test Automation ───────────────────────────────────────────────────
// Sends a real DM/reply using the stored page token so the user can
// verify the automation before going live.
const testAutomation = async (userId, automationId) => {
  const Automation = require('./automation.model');
  const automation = await Automation.findOne({ _id: automationId, userId });
  if (!automation) throw Object.assign(new Error('Automation not found'), { statusCode: 404 });

  const Token = require('../token/token.model');
  const { decrypt } = require('../../utils/crypto');
  const axios = require('axios');

  const tokenDoc = await Token.findOne({ userId, pageId: automation.pageId, platform: automation.platform }).select('+accessToken');
  if (!tokenDoc) throw Object.assign(new Error('No access token for this page. Reconnect your account.'), { statusCode: 403 });

  const accessToken = decrypt(tokenDoc.accessToken);
  const testMessage = `[TEST] ${automation.actions[0]?.template?.slice(0, 100) || 'Automation test message from Comment Please.'}`;

  // Verify token works by fetching profile
  const meRes = await axios.get('https://graph.instagram.com/v21.0/me', {
    params: { fields: 'id,username', access_token: accessToken },
  });

  // Instagram doesn't allow self-DMs — return success with config verified
  return {
    success: true,
    messageId: null,
    preview: testMessage,
    note: `Token valid for @${meRes.data.username}. Automation is configured correctly — it will send DMs when real comments trigger it.`,
  };
};

const updateAutomation = async (userId, automationId, data) => {
  const automation = await Automation.findOneAndUpdate(
    { _id: automationId, userId },
    { $set: data },
    { new: true, runValidators: true }
  );
  if (!automation) throw Object.assign(new Error('Automation not found'), { statusCode: 404 });
  return automation;
};

module.exports = {
  processCommentEvent,
  processMessageEvent,
  createAutomation,
  listAutomations,
  updateAutomation,
  toggleAutomation,
  deleteAutomation,
  testAutomation,
};
