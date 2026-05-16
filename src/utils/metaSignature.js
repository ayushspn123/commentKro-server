const crypto = require('crypto');
const env = require('../config/env');

/**
 * Validates Meta webhook signature using HMAC-SHA256.
 * Meta sends X-Hub-Signature-256: sha256=<hash>
 * @param {Buffer} rawBody - Raw request body buffer
 * @param {string} signature - Value of X-Hub-Signature-256 header
 * @returns {boolean}
 */
const validateMetaSignature = (rawBody, signature) => {
  if (!signature || !rawBody) return false;

  const expectedHash = crypto
    .createHmac('sha256', env.META_APP_SECRET)
    .update(rawBody)
    .digest('hex');

  const expected = Buffer.from(`sha256=${expectedHash}`, 'utf8');
  const received = Buffer.from(signature, 'utf8');

  if (expected.length !== received.length) return false;

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(expected, received);
};

module.exports = { validateMetaSignature };
