const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');

// Admin security guard middleware
const verifyAdminKey = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'] || req.query.adminKey;
  const expectedKey = process.env.ADMIN_SECRET_KEY || 'ck_master_admin_key_2026';

  if (!adminKey || adminKey !== expectedKey) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Invalid or missing administrator authorization credentials.'
    });
  }

  next();
};

router.use(verifyAdminKey);

router.get('/overview', adminController.getOverview);
router.get('/vip-users', adminController.getVipUsers);
router.get('/all-users', adminController.getAllUsers);
router.get('/tickets', adminController.getSupportTickets);
router.patch('/tickets/:id', adminController.updateTicketStatus);
router.get('/automations', adminController.getAutomations);

module.exports = router;
