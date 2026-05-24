const express = require('express');
const router = express.Router();
const controller = require('./payment.controller');
const { authenticate } = require('../../middleware/auth.middleware');

router.use(authenticate);

// Create a Razorpay order (or direct upgrade in dev mode)
router.post('/create-order', controller.createOrder);

// Verify payment after Razorpay checkout
router.post('/verify', controller.verifyPayment);

// Direct plan selection (free plan or dev downgrade)
router.post('/select', controller.selectPlanDirect);

module.exports = router;
