/**
 * UNSEED SCRIPT — Removes ALL demo data for demo@test.com
 *
 * Run:  node src/scripts/unseed.js
 *
 * This deletes:
 *   - The demo user account
 *   - Their tokens
 *   - Their automations
 *   - Their message logs
 */

require('dotenv').config();
const mongoose = require('mongoose');
const env      = require('../config/env');

const User       = require('../modules/auth/auth.model');
const Token      = require('../modules/token/token.model');
const Automation = require('../modules/automation/automation.model');
const Message    = require('../modules/messaging/message.model');

const DEMO_EMAIL = 'demo@test.com';

async function unseed() {
  console.log('🧹 Connecting to MongoDB…');
  await mongoose.connect(env.MONGO_URI);
  console.log('✅ Connected.\n');

  const user = await User.findOne({ email: DEMO_EMAIL });

  if (!user) {
    console.log(`ℹ️  No user found for ${DEMO_EMAIL}. Nothing to remove.`);
    await mongoose.disconnect();
    return;
  }

  const userId = user._id;

  const [tokens, automations, messages] = await Promise.all([
    Token.deleteMany({ userId }),
    Automation.deleteMany({ userId }),
    Message.deleteMany({ userId }),
  ]);

  await User.deleteOne({ _id: userId });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🗑️  UNSEED COMPLETE — All demo data removed');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  User:         ${DEMO_EMAIL} ✅ deleted`);
  console.log(`  Tokens:       ${tokens.deletedCount} deleted`);
  console.log(`  Automations:  ${automations.deletedCount} deleted`);
  console.log(`  Messages:     ${messages.deletedCount} deleted`);
  console.log('\n  ➜ To re-add: node src/scripts/seed.js');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await mongoose.disconnect();
}

unseed().catch(err => {
  console.error('❌ Unseed failed:', err.message);
  process.exit(1);
});
