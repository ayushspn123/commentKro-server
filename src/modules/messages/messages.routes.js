const express = require('express');
const router = express.Router();
const controller = require('./messages.controller');
const { authenticate } = require('../../middleware/auth.middleware');

router.use(authenticate);
router.get('/contacts', controller.getContacts);
router.get('/', controller.getMessages);

module.exports = router;
