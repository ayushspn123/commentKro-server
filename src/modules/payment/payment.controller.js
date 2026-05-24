const crypto = require('crypto');
const env = require('../../config/env');
const User = require('../auth/auth.model');
const logger = require('../../utils/logger');

const PLAN_CONFIG = {
  monthly: { amount: 19900, currency: 'INR' },   // ₹199/mo
  annual:  { amount: 178800, currency: 'INR' },  // ₹1,788/year (₹149/mo)
};

const PLAN_LIMITS = {
  monthly: { dailyDMs: -1,   automations: -1 },  // -1 = unlimited
  annual:  { dailyDMs: -1,   automations: -1 },  // -1 = unlimited
  free:    { dailyDMs: 1000, automations: -1 },  // unlimited automations, 1k DMs
};

// Create Razorpay order (or upgrade directly in dev mode when no keys set)
const createOrder = async (req, res, next) => {
  try {
    const { plan } = req.body;
    if (!PLAN_CONFIG[plan]) {
      return res.status(400).json({ success: false, message: 'Invalid plan. Choose monthly or annual.' });
    }

    // Dev mode — no Razorpay keys configured, upgrade directly without payment
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      if (env.NODE_ENV === 'production') {
        logger.error('CRITICAL: Razorpay keys missing in production — refusing free plan upgrade');
        return res.status(503).json({ success: false, message: 'Payment service is not configured. Please contact support.' });
      }
      await User.findByIdAndUpdate(req.user.id, {
        plan,
        planLimits: PLAN_LIMITS[plan],
      });
      logger.info(`[DEV] Plan upgraded to ${plan} for user ${req.user.id} (no payment)`);
      return res.json({
        success: true,
        devMode: true,
        plan,
        message: `Plan upgraded to ${plan} (dev mode — no payment required)`,
      });
    }

    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });

    const config = PLAN_CONFIG[plan];
    const order = await razorpay.orders.create({
      amount: config.amount,
      currency: config.currency,
      notes: { userId: req.user.id, plan },
    });

    logger.info(`Razorpay order created: ${order.id} for user ${req.user.id} plan=${plan}`);

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: config.amount,
        currency: config.currency,
        plan,
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

// Verify Razorpay payment signature and upgrade plan
const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;

    if (!env.RAZORPAY_KEY_SECRET) {
      return res.status(400).json({ success: false, message: 'Razorpay not configured' });
    }

    if (!PLAN_CONFIG[plan]) {
      return res.status(400).json({ success: false, message: 'Invalid plan' });
    }

    // HMAC-SHA256 signature verification
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expected !== razorpay_signature) {
      logger.warn(`Payment signature mismatch for user ${req.user.id}`);
      return res.status(400).json({ success: false, message: 'Payment verification failed. Signature mismatch.' });
    }

    await User.findByIdAndUpdate(req.user.id, {
      plan,
      planLimits: PLAN_LIMITS[plan],
    });

    logger.info(`Plan upgraded: userId=${req.user.id} plan=${plan} payment=${razorpay_payment_id}`);
    res.json({ success: true, plan, message: `Plan upgraded to ${plan} successfully!` });
  } catch (err) {
    next(err);
  }
};

// Downgrade to free only — paid upgrades must go through createOrder + verifyPayment
const selectPlanDirect = async (req, res, next) => {
  try {
    const { plan } = req.body;
    if (plan !== 'free') {
      return res.status(403).json({ success: false, message: 'Paid plan upgrades require payment. Use /api/payment/create-order.' });
    }

    await User.findByIdAndUpdate(req.user.id, {
      plan: 'free',
      planLimits: PLAN_LIMITS.free,
    });

    res.json({ success: true, plan: 'free', message: 'Plan set to free' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createOrder, verifyPayment, selectPlanDirect };
