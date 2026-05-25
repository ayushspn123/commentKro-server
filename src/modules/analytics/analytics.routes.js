const express = require('express');
const router = express.Router();
const controller = require('./analytics.controller');
const { authenticate } = require('../../middleware/auth.middleware');

router.use(authenticate);

router.get('/stats', controller.getStats);
router.get('/volume', controller.getDailyVolume);
router.get('/top-automations', controller.getTopAutomations);
router.get('/usage', controller.getUsage);
router.get('/automations/:id', controller.getAutomationStats);

module.exports = router;
