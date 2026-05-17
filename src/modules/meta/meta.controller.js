const axios = require('axios');
const Token = require('../token/token.model');
const { decrypt } = require('../../utils/crypto');
const logger = require('../../utils/logger');

const env = require('../../config/env');
const META_GRAPH = `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}`;

/**
 * GET /api/meta/posts?pageId=&platform=
 * Fetches the user's recent Instagram/Facebook posts/reels for the PostPicker.
 */
const getPosts = async (req, res, next) => {
  try {
    const { pageId, platform = 'instagram' } = req.query;
    if (!pageId) return res.status(400).json({ success: false, message: 'pageId is required' });

    const tokenDoc = await Token.findOne({ userId: req.user.id, pageId, platform });
    if (!tokenDoc) return res.status(404).json({ success: false, message: 'No token found. Reconnect your account.' });

    const accessToken = decrypt(tokenDoc.accessToken);

    let posts = [];

    if (platform === 'instagram') {
      // For IG: first get the IG Business Account ID from the page
      const igRes = await axios.get(`${META_GRAPH}/${pageId}`, {
        params: {
          fields: 'instagram_business_account',
          access_token: accessToken,
        },
      });
      const igAccountId = igRes.data?.instagram_business_account?.id;
      if (!igAccountId) {
        return res.json({ success: true, data: [] }); // No IG account linked
      }

      // Fetch recent media (posts + reels)
      const mediaRes = await axios.get(`${META_GRAPH}/${igAccountId}/media`, {
        params: {
          fields: 'id,caption,media_type,media_url,thumbnail_url,timestamp,permalink,like_count,comments_count',
          limit: 24,
          access_token: accessToken,
        },
      });
      posts = (mediaRes.data.data || []).map(p => ({
        id: p.id,
        caption: p.caption?.slice(0, 100) || '',
        mediaType: p.media_type, // IMAGE | VIDEO | CAROUSEL_ALBUM
        thumbnail: p.thumbnail_url || p.media_url || null,
        timestamp: p.timestamp,
        permalink: p.permalink,
        likeCount: p.like_count || 0,
        commentsCount: p.comments_count || 0,
      }));

    } else {
      // Facebook Page posts
      const fbRes = await axios.get(`${META_GRAPH}/${pageId}/posts`, {
        params: {
          fields: 'id,message,full_picture,created_time,permalink_url,reactions.summary(true),comments.summary(true)',
          limit: 24,
          access_token: accessToken,
        },
      });
      posts = (fbRes.data.data || []).map(p => ({
        id: p.id,
        caption: p.message?.slice(0, 100) || '',
        mediaType: 'IMAGE',
        thumbnail: p.full_picture || null,
        timestamp: p.created_time,
        permalink: p.permalink_url,
        likeCount: p.reactions?.summary?.total_count || 0,
        commentsCount: p.comments?.summary?.total_count || 0,
      }));
    }

    res.json({ success: true, data: posts });
  } catch (err) {
    logger.error('getPosts error:', err.response?.data || err.message);
    next(err);
  }
};

module.exports = { getPosts };
