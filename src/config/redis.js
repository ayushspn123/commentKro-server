const { Redis } = require('ioredis');
const logger = require('../utils/logger');
const env = require('./env');

const redisConfig = {
  host: env.REDIS_HOST,
  port: parseInt(env.REDIS_PORT, 10),
  password: env.REDIS_PASSWORD || undefined,
  // Enable TLS for Upstash or any cloud Redis that requires SSL
  ...(env.REDIS_TLS === 'true' && { tls: {} }),
  maxRetriesPerRequest: null,    // Required for BullMQ
  enableReadyCheck: false,
  // In dev, stop retrying after 3 attempts instead of retrying forever
  retryStrategy: (times) => {
    if (env.NODE_ENV !== 'production' && times > 3) {
      logger.warn('Redis unavailable after 3 attempts — queue features disabled');
      return null; // stop retrying
    }
    const delay = Math.min(times * 200, 2000);
    logger.warn(`Redis retry attempt #${times}, next in ${delay}ms`);
    return delay;
  },
};

const createRedisClient = (name = 'default') => {
  const client = new Redis({ ...redisConfig, lazyConnect: true });

  client.on('connect', () => logger.info(`✅ Redis [${name}] connected`));
  client.on('error', (err) => logger.debug(`Redis [${name}]: ${err.message}`));
  client.on('close', () => logger.debug(`Redis [${name}] closed`));

  return client;
};

// Shared clients — lazily connected
const redisClient = createRedisClient('main');
const redisSubscriber = createRedisClient('subscriber');

module.exports = { redisClient, redisSubscriber, createRedisClient, redisConfig };
