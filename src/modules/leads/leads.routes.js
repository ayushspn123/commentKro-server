const express = require('express');
const router = express.Router();
const controller = require('./leads.controller');
const { authenticate } = require('../../middleware/auth.middleware');

router.use(authenticate);

router.get('/', controller.getLeads);
router.get('/export', controller.exportLeads);
router.patch('/:id', controller.updateLead);

module.exports = router;
