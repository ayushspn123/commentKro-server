const crypto = require('crypto');
const env = require('../../config/env');
const PreRegister = require('./preRegister.model');
const logger = require('../../utils/logger');

const FIXED_AMOUNT_PAISE = 900; // strictly ₹9.00 INR

// Create Razorpay order for ₹9 Pre-Registration Pass
const createOrder = async (req, res, next) => {
  try {
    const { whatsapp } = req.body;
    if (!whatsapp || whatsapp.replace(/\D/g, '').length < 10) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit WhatsApp number is required' });
    }

    // Dev mode fallback if keys are missing
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      const devOrderId = 'order_dev_' + Date.now();
      return res.json({
        success: true,
        devMode: true,
        data: {
          orderId: devOrderId,
          amount: FIXED_AMOUNT_PAISE,
          currency: 'INR',
          keyId: env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
          user: {
            name: req.user.name || '',
            email: req.user.email,
          },
        },
      });
    }

    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: FIXED_AMOUNT_PAISE,
      currency: 'INR',
      receipt: 'vip_' + Date.now().toString().slice(-8),
      notes: {
        userId: req.user.id,
        email: req.user.email,
        plan: 'VIP_PRE_REGISTRATION_NOV_2026',
      },
    });

    logger.info(`Pre-registration Razorpay order created: ${order.id} for user ${req.user.id}`);

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: FIXED_AMOUNT_PAISE,
        currency: 'INR',
        keyId: env.RAZORPAY_KEY_ID,
        user: {
          name: req.user.name || '',
          email: req.user.email,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// Verify payment signature and record VIP registration
const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, whatsapp } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment credentials missing' });
    }

    // 1. Anti-Replay Defense: Check if paymentId already used
    const existing = await PreRegister.findOne({ paymentId: razorpay_payment_id });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Payment transaction already claimed.' });
    }

    // 2. HMAC-SHA256 Cryptographic Signature Verification
    if (env.RAZORPAY_KEY_SECRET) {
      const body = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expected = crypto
        .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');

      if (expected !== razorpay_signature) {
        logger.warn(`Pre-registration payment signature mismatch for user ${req.user.id}`);
        return res.status(400).json({ success: false, message: 'Payment verification failed: Signature mismatch.' });
      }
    }

    // 3. Generate Official VIP Registration Number
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const registrationNumber = `CK-VIP-${new Date().getFullYear()}-${randomDigits}`;

    const record = await PreRegister.create({
      registrationNumber,
      user: req.user.id,
      email: req.user.email,
      name: req.user.name || 'VIP Member',
      whatsapp: whatsapp || '',
      amount: 9,
      currency: 'INR',
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      status: 'CONFIRMED',
    });

    logger.info(`VIP Pre-Registration confirmed: ${registrationNumber} for user ${req.user.id}`);

    res.json({
      success: true,
      data: {
        registrationNumber: record.registrationNumber,
        status: record.status,
        registeredAt: record.registeredAt,
        offerDetails: '3 Months at ₹29/month starting November 2026',
        email: record.email,
        whatsapp: record.whatsapp,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Check VIP status
const getStatus = async (req, res, next) => {
  try {
    const record = await PreRegister.findOne({ user: req.user.id });
    if (!record) {
      return res.json({ success: true, registered: false });
    }
    res.json({
      success: true,
      registered: true,
      data: {
        registrationNumber: record.registrationNumber,
        status: record.status,
        registeredAt: record.registeredAt,
        whatsapp: record.whatsapp,
        email: record.email,
        name: record.name,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getStatus,
};
