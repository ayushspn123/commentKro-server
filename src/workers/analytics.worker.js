/**
 * Analytics Handler (in-process, Redis-free).
 *
 * The former Redis daily-counter has been dropped — real stats are served
 * from MongoDB via analytics.service. This now just records the event in logs.
 */
const { registerHandler } = require('../config/queues');
const logger = require('../utils/logger');

registerHandler('analytics', async (jobName, data) => {
  if (jobName === 'automation-triggered') {
    const { userId, automationId, platform, traceId } = data;
    logger.info('Analytics event: automation triggered', { userId, automationId, platform, traceId });
  }
});

logger.info('🔧 Analytics handler registered (in-process) — handles "analytics" jobs');
