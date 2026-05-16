/**
 * SEED SCRIPT — Adds demo data for demo@test.com
 *
 * Run:   node src/scripts/seed.js
 * Undo:  node src/scripts/unseed.js
 *
 * Login: demo@test.com / Demo@1234
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const env      = require('../config/env');
const { encrypt } = require('../utils/crypto');

const User       = require('../modules/auth/auth.model');
const Token      = require('../modules/token/token.model');
const Automation = require('../modules/automation/automation.model');
const Message    = require('../modules/messaging/message.model');

const DEMO_EMAIL    = 'demo@test.com';
const DEMO_PASSWORD = 'Demo@1234';

// ── Fake page IDs (simulates a connected IG + FB page) ─────────────────
const IG_PAGE_ID = 'demo_ig_page_001';
const FB_PAGE_ID = 'demo_fb_page_001';

// ── Helper: random date in last N days ────────────────────────────────
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);
const randBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function seed() {
  console.log('🌱 Connecting to MongoDB…');
  await mongoose.connect(env.MONGO_URI);
  console.log('✅ Connected.\n');

  // ── 1. User ───────────────────────────────────────────────────────
  let user = await User.findOne({ email: DEMO_EMAIL });

  const fakeEncToken = encrypt('demo_fake_access_token_not_real');

  if (user) {
    console.log(`ℹ️  User ${DEMO_EMAIL} already exists — updating…`);
  } else {
    user = new User({ email: DEMO_EMAIL });
  }

  user.name         = 'Demo User';
  user.passwordHash = DEMO_PASSWORD;
  user.isVerified   = true;
  user.plan         = 'annual';
  user.planLimits   = { dmsPerMonth: 50000, contacts: 50000, automations: 999 };
  user.connectedPages = [];

  await user.save();
  const userId = user._id;
  console.log(`✅ User: ${DEMO_EMAIL} | password: ${DEMO_PASSWORD}`);

  // ── 2. Tokens (fake, encrypted) ───────────────────────────────────
  await Token.findOneAndUpdate(
    { userId, pageId: IG_PAGE_ID, platform: 'instagram' },
    {
      userId, pageId: IG_PAGE_ID, platform: 'instagram',
      accessToken: fakeEncToken,
      expiresAt:   new Date(Date.now() + 60 * 86_400_000), // 60 days
      scopes: ['instagram_basic', 'instagram_manage_messages'],
    },
    { upsert: true }
  );
  await Token.findOneAndUpdate(
    { userId, pageId: FB_PAGE_ID, platform: 'facebook' },
    {
      userId, pageId: FB_PAGE_ID, platform: 'facebook',
      accessToken: fakeEncToken,
      expiresAt:   new Date(Date.now() + 60 * 86_400_000),
      scopes: ['pages_messaging', 'pages_read_engagement'],
    },
    { upsert: true }
  );
  console.log(`✅ Tokens: IG + FB fake tokens stored`);

  // ── 3. Automations ────────────────────────────────────────────────
  const automationDefs = [
    {
      name: '🔗 Link in Bio → DM',
      platform: 'instagram', pageId: IG_PAGE_ID,
      trigger: { type: 'comment', keywords: ['link', 'bio', 'where'], matchType: 'any' },
      actions: [{ type: 'send_dm', template: "Hey {{sender_name}}! 👋 Here's the link you asked for: https://mystore.com/link 🛍️\n\nLet me know if you have any questions!", delay: 0 }],
      mediaFilter: 'all', postIds: [],
      isActive: true,
      stats: { triggered: 142, sent: 138, delivered: 131, failed: 4 },
    },
    {
      name: '🎁 Freebie Request → DM',
      platform: 'instagram', pageId: IG_PAGE_ID,
      trigger: { type: 'comment', keywords: ['freebie', 'free', 'gimme', 'want'], matchType: 'any' },
      actions: [{ type: 'send_dm', template: "Hi {{sender_name}}! 🎁 Your free guide is ready:\nhttps://mystore.com/freeguide\n\nEnjoying it? Tag me in your story!", delay: 5000 }],
      mediaFilter: 'all', postIds: [],
      isActive: true,
      stats: { triggered: 89, sent: 87, delivered: 82, failed: 2 },
    },
    {
      name: '💰 Price Enquiry → DM',
      platform: 'instagram', pageId: IG_PAGE_ID,
      trigger: { type: 'comment', keywords: ['price', 'cost', 'how much', 'rate'], matchType: 'any' },
      actions: [{ type: 'send_dm', template: "Hey {{sender_name}}! 💰 Our pricing starts at ₹999. DM me 'BUY' to get started, or check out: https://mystore.com/pricing", delay: 0 }],
      mediaFilter: 'specific', postIds: ['demo_post_001', 'demo_post_002'],
      isActive: true,
      stats: { triggered: 54, sent: 54, delivered: 50, failed: 0 },
    },
    {
      name: '📦 Course Info → DM',
      platform: 'facebook', pageId: FB_PAGE_ID,
      trigger: { type: 'comment', keywords: ['course', 'enroll', 'join', 'details'], matchType: 'any' },
      actions: [{ type: 'send_dm', template: "Hi {{sender_name}}! 📚 Thanks for your interest!\n\nOur next batch starts June 1st.\nSeats left: 12\n\nEnroll here: https://mystore.com/course", delay: 0 }],
      mediaFilter: 'all', postIds: [],
      isActive: false, // paused for demo variety
      stats: { triggered: 21, sent: 20, delivered: 18, failed: 1 },
    },
  ];

  // Wipe old demo automations for this user then re-seed
  await Automation.deleteMany({ userId, name: { $in: automationDefs.map(a => a.name) } });

  const savedAutomations = [];
  for (const def of automationDefs) {
    const a = await Automation.create({ userId, ...def });
    savedAutomations.push(a);
    console.log(`  ✅ Automation: "${a.name}" (${a.isActive ? '🟢 active' : '⚪ paused'})`);
  }
  console.log(`✅ ${savedAutomations.length} automations created`);

  // ── 4. Message logs (30 days of activity) ─────────────────────────
  // Remove old demo messages
  await Message.deleteMany({ userId });

  const messageRows = [];
  const statuses = ['sent', 'delivered', 'delivered', 'delivered', 'read', 'failed'];

  for (let day = 0; day < 30; day++) {
    // More messages on recent days, fewer on older days
    const count = day < 7 ? randBetween(8, 20) : day < 14 ? randBetween(3, 10) : randBetween(0, 5);
    const auto  = savedAutomations[day % savedAutomations.length];
    const ts    = daysAgo(day);

    for (let i = 0; i < count; i++) {
      const status = statuses[randBetween(0, statuses.length - 1)];
      messageRows.push({
        userId,
        automationId: auto._id,
        pageId:       auto.pageId,
        platform:     auto.platform,
        direction:    'outbound',
        type:         'dm',
        recipientId:  `demo_recipient_${day}_${i}`,
        content:      auto.actions[0].template,
        status,
        sentAt:       status !== 'failed' ? ts : undefined,
        deliveredAt:  status === 'delivered' || status === 'read' ? ts : undefined,
        createdAt:    ts,
        updatedAt:    ts,
      });
    }
  }

  if (messageRows.length > 0) {
    await Message.insertMany(messageRows, { timestamps: false });
  }
  console.log(`✅ ${messageRows.length} message logs created (30-day history)`);

  // ── Summary ───────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 SEED COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log(`  Plan:     Annual Pro`);
  console.log(`  IG Page:  My Demo Store 🛍️ (connected)`);
  console.log(`  FB Page:  My Demo Store — Facebook (connected)`);
  console.log(`  Automations: ${savedAutomations.length}`);
  console.log(`  Messages: ${messageRows.length} (30-day history)`);
  console.log('\n  ➜ To remove: node src/scripts/unseed.js');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
