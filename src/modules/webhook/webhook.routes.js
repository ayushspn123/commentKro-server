const express = require('express');
const router = express.Router();
const controller = require('./webhook.controller');
const { webhookLimiter } = require('../../middleware/rateLimit.middleware');

// Raw body capture middleware (must run BEFORE json parsing on these routes)
const captureRawBody = (req, res, next) => {
  let data = [];
  req.on('data', (chunk) => data.push(chunk));
  req.on('end', () => {
    req.rawBody = Buffer.concat(data);
    next();
  });
};

// Instagram
router.get('/instagram', controller.verifyInstagramWebhook);
router.post('/instagram', webhookLimiter, captureRawBody, controller.handleInstagramWebhook);

// Facebook
router.get('/facebook', controller.verifyFacebookWebhook);
router.post('/facebook', webhookLimiter, captureRawBody, controller.handleFacebookWebhook);

module.exports = router;
