const express = require('express');
const router = express.Router();
const { z } = require('zod');
const controller = require('./auth.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');

// ── Validation schemas ────────────────────────────────────────────────
const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(1).max(100).optional(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

const forgotSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

const resetSchema = z.object({
  body: z.object({
    token: z.string().min(1),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
});

// ── Public routes ─────────────────────────────────────────────────────
router.post('/register', validate(registerSchema), controller.register);
router.post('/login', validate(loginSchema), controller.login);
router.post('/refresh', controller.refreshToken);
router.post('/logout', controller.logout);
router.post('/forgot-password', validate(forgotSchema), controller.forgotPassword);
router.post('/reset-password', validate(resetSchema), controller.resetPassword);

// ── Protected routes ──────────────────────────────────────────────────
// Session check — used by frontend on every page load
router.get('/me', authenticate, controller.me);

// Profile update
router.patch('/profile', authenticate, controller.updateProfile);

// Plan selection (after signup)
router.post('/select-plan', authenticate, controller.selectPlan);

// Meta OAuth
// /meta        — requires login (user must be logged in to start OAuth)
// /meta/callback — NO authenticate middleware; user ID comes from the 'state' param
router.get('/meta', authenticate, controller.metaOAuthRedirect);
router.get('/meta/callback', controller.metaOAuthCallback);

module.exports = router;
