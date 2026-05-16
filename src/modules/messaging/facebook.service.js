const axios = require('axios');
const { getPageAccessToken } = require('./messaging.service');
const logger = require('../../utils/logger');
const env = require('../../config/env');

const META_GRAPH_BASE = `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}`;

/**
 * Send a Facebook Messenger message to a PSID (Page-Scoped User ID)
 *
 * @param {object} options
 * @param {string} options.userId    - Our platform user ID
 * @param {string} options.pageId   - Facebook Page ID
 * @param {string} options.psid     - Recipient Page-Scoped ID
 * @param {string} options.message  - Text message
 * @param {string} options.traceId
 */
const sendFacebookMessage = async ({ userId, pageId, psid, message, traceId }) => {
  const accessToken = await getPageAccessToken(userId, pageId, 'facebook');

  logger.info('Sending Facebook Messenger message', { psid, traceId });

  const response = await axios.post(
    `${META_GRAPH_BASE}/me/messages`,
    {
      recipient: { id: psid },
      message: { text: message },
      messaging_type: 'RESPONSE',
    },
    {
      params: { access_token: accessToken },
      timeout: 10000,
    }
  );

  logger.info('Facebook message sent', { messageId: response.data.message_id, traceId });
  return response.data;
};

/**
 * Send a Facebook Messenger message with quick replies
 */
const sendFacebookMessageWithQuickReplies = async ({
  userId,
  pageId,
  psid,
  message,
  quickReplies,
  traceId,
}) => {
  const accessToken = await getPageAccessToken(userId, pageId, 'facebook');

  const response = await axios.post(
    `${META_GRAPH_BASE}/me/messages`,
    {
      recipient: { id: psid },
      message: {
        text: message,
        quick_replies: quickReplies.map((qr) => ({
          content_type: 'text',
          title: qr.title,
          payload: qr.payload,
        })),
      },
      messaging_type: 'RESPONSE',
    },
    {
      params: { access_token: accessToken },
      timeout: 10000,
    }
  );

  logger.info('Facebook message with quick replies sent', { traceId });
  return response.data;
};

/**
 * Get Messenger user profile (name, locale, timezone)
 * @param {string} psid - Page-Scoped User ID
 * @param {string} accessToken - Plaintext page access token
 */
const getMessengerUserProfile = async (psid, accessToken) => {
  try {
    const res = await axios.get(`${META_GRAPH_BASE}/${psid}`, {
      params: {
        fields: 'first_name,last_name,profile_pic,locale,timezone,gender',
        access_token: accessToken,
      },
    });
    return res.data;
  } catch {
    return { id: psid };
  }
};

/**
 * Get Facebook Page details
 * @param {string} pageId
 * @param {string} accessToken
 */
const getPageDetails = async (pageId, accessToken) => {
  const res = await axios.get(`${META_GRAPH_BASE}/${pageId}`, {
    params: {
      fields: 'id,name,category,fan_count,picture',
      access_token: accessToken,
    },
  });
  return res.data;
};

module.exports = {
  sendFacebookMessage,
  sendFacebookMessageWithQuickReplies,
  getMessengerUserProfile,
  getPageDetails,
};
