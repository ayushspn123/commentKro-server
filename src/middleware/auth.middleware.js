const jwt = require('jsonwebtoken');
const User = require('../modules/auth/auth.model');
const env = require('../config/env');

/**
 * Verifies JWT from httpOnly cookie (accessToken).
 * Falls back to Authorization: Bearer header for API clients / Postman.
 */
const authenticate = async (req, res, next) => {
  try {
    // 1. Try cookie first (browser requests)
    let token = req.cookies?.accessToken;

    // 2. Fall back to Authorization header (Postman / mobile)
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);

    const user = await User.findById(payload.sub).select('-passwordHash -refreshToken');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Access token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

/**
 * Authorization guard — checks user plan.
 * Usage: requirePlan('pro', 'enterprise')
 */
const requirePlan = (...plans) =>
  (req, res, next) => {
    if (!plans.includes(req.user?.plan)) {
      return res.status(403).json({
        success: false,
        message: `This feature requires: ${plans.join(' or ')} plan`,
      });
    }
    next();
  };

module.exports = { authenticate, requirePlan };
