const axios = require('axios');
const { getPageAccessToken } = require('./messaging.service');
const logger = require('../../utils/logger');
const env = require('../../config/env');

const META_GRAPH_BASE = `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}`;

/**
 * Send a DM via Instagram Messenger API (for Instagram-specific flows)
 * Instagram DMs use the same /me/messages endpoint but with IGSID recipient
 *
 * @param {object} options
 * @param {string} options.userId      - Our platform user ID
 * @param {string} options.pageId      - Instagram-connected page ID
 * @param {string} options.recipientIgsid - Instagram-Scoped User ID
 * @param {string} options.message     - Text to send
 * @param {string} options.traceId
 */
const sendInstagramDM = async ({ userId, pageId, recipientIgsid, message, traceId }) => {
  const accessToken = await getPageAccessToken(userId, pageId, 'instagram');

  logger.info('Sending Instagram DM', { recipientIgsid, traceId });

  const response = await axios.post(
    `${META_GRAPH_BASE}/me/messages`,
    {
      recipient: { id: recipientIgsid },
      message: { text: message },
      messaging_type: 'RESPONSE',
    },
    {
      params: { access_token: accessToken },
      timeout: 10000,
    }
  );

  logger.info('Instagram DM sent', { messageId: response.data.message_id, traceId });
  return response.data;
};

/**
 * Get the Instagram Business Account linked to a Facebook Page
 * @param {string} pageId - Facebook Page ID
 * @param {string} accessToken - Page access token (plaintext)
 */
const getLinkedInstagramAccount = async (pageId, accessToken) => {
  const res = await axios.get(`${META_GRAPH_BASE}/${pageId}`, {
    params: {
      fields: 'instagram_business_account',
      access_token: accessToken,
    },
  });

  return res.data.instagram_business_account?.id || null;
};

/**
 * Get commenter info from Instagram Graph API
 * @param {string} userId - Instagram user ID
 * @param {string} accessToken - Page access token (plaintext)
 */
const getInstagramUserInfo = async (igUserId, accessToken) => {
  try {
    const res = await axios.get(`${META_GRAPH_BASE}/${igUserId}`, {
      params: {
        fields: 'id,name,username',
        access_token: accessToken,
      },
    });
    return res.data;
  } catch {
    return { id: igUserId };
  }
};

/**
 * Get recent comments on a media object
 * @param {string} mediaId
 * @param {string} accessToken
 */
const getMediaComments = async (mediaId, accessToken) => {
  const res = await axios.get(`${META_GRAPH_BASE}/${mediaId}/comments`, {
    params: {
      fields: 'id,text,from,timestamp',
      access_token: accessToken,
    },
  });
  return res.data.data || [];
};

module.exports = {
  sendInstagramDM,
  getLinkedInstagramAccount,
  getInstagramUserInfo,
  getMediaComments,
};
