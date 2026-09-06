const express = require('express');
const router = express.Router();
const controller = require('./preRegister.controller');
const { authenticate } = require('../../middleware/auth.middleware');

router.use(authenticate);

router.post('/order', controller.createOrder);
router.post('/verify', controller.verifyPayment);
router.get('/status', controller.getStatus);

module.exports = router;
