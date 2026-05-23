const axios = require('axios');
const { decrypt } = require('../../utils/crypto');
const Token = require('../token/token.model');
const Message = require('../messaging/message.model');
const logger = require('../../utils/logger');
const env = require('../../config/env');

const META_GRAPH_BASE = `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}`;

/**
 * Fetch a decrypted access token for a page.
 */
const getPageAccessToken = async (userId, pageId, platform) => {
  const token = await Token.findOne({
    userId,
    platform,
    $or: [{ pageId }, { webhookPageId: pageId }],
  }).select('+accessToken');
  if (!token) throw Object.assign(new Error(`No token found for page ${pageId}`), { statusCode: 404 });
  if (token.expiresAt < new Date()) throw Object.assign(new Error('Access token expired'), { statusCode: 401 });
  return decrypt(token.accessToken);
};

/**
 * Send a Direct Message via Instagram or Facebook Messenger.
 * @param {object} options
 * @param {string} options.userId - Our platform user ID
 * @param {string} options.pageId - Meta page ID
 * @param {string} options.platform - 'instagram' | 'facebook'
 * @param {string} options.recipientId - Meta user/IGSID to send to
 * @param {string} options.message - Message text
 * @param {string} options.automationId - Source automation ID
 * @param {string} options.traceId - Trace ID for logging
 */
const sendDM = async ({ userId, pageId, platform, recipientId, message, automationId, traceId }) => {
  const accessToken = await getPageAccessToken(userId, pageId, platform);

  // Log the message as queued
  const msgDoc = await Message.create({
    userId,
    automationId,
    pageId,
    platform,
    direction: 'outbound',
    type: 'dm',
    recipientId,
    content: message,
    status: 'queued',
  });

  try {
    const endpoint = platform === 'instagram'
      ? `https://graph.instagram.com/${env.META_GRAPH_API_VERSION}/me/messages`
      : `${META_GRAPH_BASE}/me/messages`;

    const response = await axios.post(
      endpoint,
      {
        recipient: { id: recipientId },
        message: { text: message },
        messaging_type: 'RESPONSE',
      },
      {
        params: { access_token: accessToken },
        timeout: 10000,
      }
    );

    const metaMessageId = response.data.message_id;
    await Message.findByIdAndUpdate(msgDoc._id, {
      status: 'sent',
      metaMessageId,
      sentAt: new Date(),
    });

    logger.info('DM sent successfully', { traceId, metaMessageId, platform, recipientId });
    return { success: true, metaMessageId };
  } catch (err) {
    const errorCode = err.response?.data?.error?.code;
    const errorMessage = err.response?.data?.error?.message || err.message;

    await Message.findByIdAndUpdate(msgDoc._id, {
      status: 'failed',
      errorCode: String(errorCode),
      errorMessage,
      $inc: { retryCount: 1 },
    });

    logger.error('DM send failed', { traceId, errorCode, errorMessage, recipientId });
    throw Object.assign(new Error(errorMessage), { statusCode: 502, code: errorCode });
  }
};

/**
 * Reply to an Instagram comment publicly.
 */
const replyToComment = async ({ userId, pageId, commentId, message, traceId }) => {
  const accessToken = await getPageAccessToken(userId, pageId, 'instagram');

  try {
    // Instagram comment replies must use graph.instagram.com, not graph.facebook.com
    await axios.post(
      `https://graph.instagram.com/${env.META_GRAPH_API_VERSION}/${commentId}/replies`,
      { message },
      { params: { access_token: accessToken } }
    );
    logger.info('Comment reply sent', { traceId, commentId });
    return { success: true };
  } catch (err) {
    const errorMessage = err.response?.data?.error?.message || err.message;
    logger.error('Comment reply failed', { traceId, commentId, errorMessage });
    throw new Error(errorMessage);
  }
};

module.exports = { sendDM, replyToComment, getPageAccessToken };
