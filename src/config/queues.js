const logger = require('../utils/logger');

/**
 * In-process job dispatcher (Redis-free).
 *
 * Replaces the former BullMQ/Redis queues. Workers register a handler per
 * logical queue via registerHandler(); safeAdd() invokes that handler
 * directly in-process. `opts.delay` is honoured with setTimeout.
 *
 * Trade-offs vs Redis/BullMQ: no cross-process distribution, no retries,
 * and in-flight jobs are lost on restart. Fine for a single-instance
 * deployment; revisit if you scale horizontally.
 */

const handlers = new Map(); // queueName -> async (jobName, data) => {}

const registerHandler = (queueName, handler) => {
  handlers.set(queueName, handler);
  logger.info(`📦 In-process handler registered: '${queueName}'`);
};

/**
 * Run a job inline through its registered handler. Errors are caught and
 * logged so a failed job never crashes the request that scheduled it.
 */
const safeAdd = async (queueName, jobName, data, opts = {}) => {
  const handler = handlers.get(queueName);
  if (!handler) {
    logger.debug(`No handler for queue '${queueName}' — skipping job '${jobName}'`);
    return null;
  }

  const run = async () => {
    try {
      await handler(jobName, data);
    } catch (err) {
      logger.error(`[inline:${queueName}] job '${jobName}' failed: ${err.message}`);
    }
  };

  if (opts.delay && opts.delay > 0) {
    setTimeout(run, opts.delay);
    return null;
  }

  return run();
};

// Back-compat no-op for callers that still import getQueues()
const getQueues = () => ({});

module.exports = { safeAdd, registerHandler, getQueues };
