const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth.middleware');
const tokenService = require('./token.service');

/**
 * GET /api/tokens — list all connected pages/tokens for the logged-in user
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const tokens = await tokenService.listUserTokens(req.user.id);
    res.json({ success: true, data: tokens });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/tokens/:pageId — disconnect a page (revoke token)
 */
router.delete('/:pageId', authenticate, async (req, res, next) => {
  try {
    const { pageId } = req.params;
    const { platform } = req.query;
    if (!platform) return res.status(400).json({ success: false, message: 'platform query param required' });

    await tokenService.revokeToken(req.user.id, pageId, platform);
    res.json({ success: true, message: 'Page disconnected' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
