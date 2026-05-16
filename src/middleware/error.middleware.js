const logger = require('../utils/logger');

/**
 * Global error handler — must be registered last in Express app.
 */
const errorMiddleware = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isOperational = !!err.statusCode; // Programmer-set errors are operational

  logger.error({
    message: err.message,
    statusCode,
    stack: isOperational ? undefined : err.stack,
    path: req.path,
    method: req.method,
    traceId: req.traceId,
  });

  res.status(statusCode).json({
    success: false,
    message: isOperational ? err.message : 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && !isOperational && { stack: err.stack }),
  });
};

module.exports = errorMiddleware;
