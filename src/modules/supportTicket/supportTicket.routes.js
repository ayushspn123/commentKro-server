const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const supportController = require('./supportTicket.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const User = require('../auth/auth.model');
const env = require('../../config/env');

const optionalAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.accessToken;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
      const user = await User.findById(payload.sub).select('-passwordHash -refreshToken');
      if (user) req.user = user;
    }
  } catch (err) {}
  next();
};

router.post('/tickets', optionalAuth, supportController.createTicket);
router.get('/tickets', authenticate, supportController.getUserTickets);

module.exports = router;
