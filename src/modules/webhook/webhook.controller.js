const { validateMetaSignature } = require('../../utils/metaSignature');
const { safeAdd } = require('../../config/queues');
const { generateTraceId } = require('../../utils/helpers');
const logger = require('../../utils/logger');
const env = require('../../config/env');

/**
 * GET /api/webhooks/instagram — Meta webhook verification challenge
 */
const verifyInstagramWebhook = (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;

  if (mode === 'subscribe' && token === env.META_WEBHOOK_VERIFY_TOKEN) {
    logger.info('Instagram webhook verified ✅');
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ message: 'Verification failed' });
};

/**
 * POST /api/webhooks/instagram — Receive Instagram webhook events
 * NOTE: app.js must use express.raw({ type: 'application/json' }) before this route
 * so that rawBody is available for signature validation.
 */
const handleInstagramWebhook = async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const rawBody = req.rawBody;

  // Validate Meta signature
  if (!validateMetaSignature(rawBody, signature)) {
    logger.warn('Instagram webhook: invalid signature');
    return res.status(401).json({ message: 'Invalid signature' });
  }

  res.status(200).json({ status: 'received' }); // Acknowledge immediately

  const traceId = generateTraceId();
  const payload = JSON.parse(rawBody.toString());
  logger.info(`Raw Instagram webhook payload: ${JSON.stringify(payload)}`, { traceId });

  // Fan out entries to the webhook queue
  const entries = payload.entry || [];
  for (const entry of entries) {
    await safeAdd(
      'webhook',
      'instagram-comment',
      { platform: 'instagram', entry, traceId },
      { jobId: `ig-${entry.id}-${Date.now()}` }
    );
  }

  logger.info(`Queued ${entries.length} Instagram webhook entries`, { traceId });
};

/**
 * GET /api/webhooks/facebook — Meta webhook verification
 */
const verifyFacebookWebhook = (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;

  if (mode === 'subscribe' && token === env.META_WEBHOOK_VERIFY_TOKEN) {
    logger.info('Facebook webhook verified ✅');
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ message: 'Verification failed' });
};

/**
 * POST /api/webhooks/facebook — Receive Facebook Messenger events
 */
const handleFacebookWebhook = async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const rawBody = req.rawBody;

  if (!validateMetaSignature(rawBody, signature)) {
    logger.warn('Facebook webhook: invalid signature');
    return res.status(401).json({ message: 'Invalid signature' });
  }

  res.status(200).json({ status: 'received' });

  const traceId = generateTraceId();
  const payload = JSON.parse(rawBody.toString());
  const entries = payload.entry || [];

  for (const entry of entries) {
    await safeAdd(
      'webhook',
      'facebook-message',
      { platform: 'facebook', entry, traceId },
      { jobId: `fb-${entry.id}-${Date.now()}` }
    );
  }

  logger.info(`Queued ${entries.length} Facebook webhook entries`, { traceId });
};

module.exports = {
  verifyInstagramWebhook,
  handleInstagramWebhook,
  verifyFacebookWebhook,
  handleFacebookWebhook,
};
