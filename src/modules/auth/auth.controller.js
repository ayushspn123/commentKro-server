const authService = require('./auth.service');
const env = require('../../config/env');

// ─── Register ─────────────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const result = await authService.register({ email, password, name });
    setTokenCookies(res, result.accessToken, result.refreshToken);
    res.status(201).json({ success: true, data: { user: result.user } });
  } catch (err) {
    next(err);
  }
};

// ─── Login ────────────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    setTokenCookies(res, result.accessToken, result.refreshToken);
    res.json({ success: true, data: { user: result.user } });
  } catch (err) {
    next(err);
  }
};

// ─── Me (session check) ───────────────────────────────────────────────
const me = (req, res) => {
  res.json({ success: true, data: req.user });
};

// ─── Refresh ──────────────────────────────────────────────────────────
const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ success: false, message: 'No refresh token' });
    const tokens = await authService.refreshAccessToken(token);
    setTokenCookies(res, tokens.accessToken, tokens.refreshToken);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ─── Logout ───────────────────────────────────────────────────────────
const logout = (req, res) => {
  res.clearCookie('accessToken', cookieOptions());
  res.clearCookie('refreshToken', cookieOptions());
  res.clearCookie('isLoggedIn', cookieOptions());
  res.json({ success: true, message: 'Logged out' });
};

// ─── Forgot Password ──────────────────────────────────────────────────
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

// ─── Reset Password ───────────────────────────────────────────────────
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const result = await authService.resetPassword(token, password);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

// ─── Meta OAuth ───────────────────────────────────────────────────────
const metaOAuthRedirect = (req, res) => {
  // Encode the userId in state so we can retrieve it in the callback
  // (Meta's redirect won't carry the session cookie)
  const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64url');

  const params = new URLSearchParams({
    force_reauth:  'true',
    client_id:     env.META_APP_ID,
    redirect_uri:  env.META_OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: [
      'instagram_business_basic',
      'instagram_business_manage_messages',
      'instagram_business_manage_comments',
      'instagram_business_content_publish',
      'instagram_business_manage_insights',
    ].join(','),
    state,
  });
  res.redirect(`https://www.instagram.com/oauth/authorize?${params}`);
};

const metaOAuthCallback = async (req, res, next) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Handle user denying permission
    if (error) {
      return res.redirect(
        `${env.FRONTEND_URL}/dashboard/settings/connections?error=${encodeURIComponent(error_description || error)}`
      );
    }

    if (!code || !state) {
      return res.status(400).json({ success: false, message: 'Missing code or state' });
    }

    // Decode userId from state
    let userId;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
      userId = decoded.userId;
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid state parameter' });
    }

    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId in state' });

    const result = await authService.handleMetaCallback(userId, code);
    res.redirect(
      `${env.FRONTEND_URL}/dashboard/settings/connections?connected=true&pages=${result.connectedPages.length}`
    );
  } catch (err) {
    next(err);
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────
/**
 * Returns shared cookie options based on environment.
 * Using 'lax' in dev so Meta OAuth redirects work cross-origin.
 */
const cookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
  ...(maxAge && { maxAge }),
});

const setTokenCookies = (res, accessToken, refreshToken) => {
  res.cookie('accessToken', accessToken, cookieOptions(15 * 60 * 1000));
  res.cookie('refreshToken', refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));
  // Non-httpOnly flag cookie so Next.js middleware can detect login state
  res.cookie('isLoggedIn', '1', {
    ...cookieOptions(7 * 24 * 60 * 60 * 1000),
    httpOnly: false,
  });
};

// ─── Select Plan ──────────────────────────────────────────────────────
const selectPlan = async (req, res, next) => {
  try {
    const { plan } = req.body;
    const valid = ['free', 'monthly', 'annual'];
    if (!valid.includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid plan' });
    }
    const User = require('./auth.model');
    await User.findByIdAndUpdate(req.user.id, {
      plan,
      planLimits: plan === 'free'
        ? { dailyDMs: 1000, automations: 3 }
        : plan === 'monthly'
        ? { dailyDMs: 10000, automations: 100 }
        : { dailyDMs: 50000, automations: 9999 },
    });
    res.json({ success: true, plan });
  } catch (err) {
    next(err);
  }
};

// ─── Update Profile ───────────────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const { name } = req.body;
    const User = require('./auth.model');
    const user = await User.findByIdAndUpdate(req.user.id, { name }, { new: true });
    res.json({ success: true, data: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, me, refreshToken, logout, forgotPassword, resetPassword, metaOAuthRedirect, metaOAuthCallback, selectPlan, updateProfile };
