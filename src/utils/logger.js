const winston = require('winston');
const env = require('../config/env');

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { service: 'comment-please-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

logger.add(
  new winston.transports.Console({
    format: env.NODE_ENV === 'production'
      ? combine(timestamp(), json())
      : combine(colorize(), simple()),
  })
);

module.exports = logger;
