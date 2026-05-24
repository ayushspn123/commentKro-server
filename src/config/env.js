const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.string().default('5000'),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),

  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z.string().optional(), // Set to 'true' for Upstash / any TLS Redis

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),

  // Meta fields — optional in development (needed only for Instagram/FB features)
  META_APP_ID: z.string().optional().default(''),
  META_APP_SECRET: z.string().optional().default(''),
  META_GRAPH_API_VERSION: z.string().default('v18.0'),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional().default('dev_verify_token'),

  // Must be exactly 32 characters for AES-256-GCM
  ENCRYPTION_KEY: z.string().length(32, 'ENCRYPTION_KEY must be exactly 32 characters'),

  META_OAUTH_REDIRECT_URI: z.string().default('http://localhost:5000/api/auth/meta/callback'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional().default(''),
  CONTACT_EMAIL: z.string().email().optional().default('admin@commentkro.com'),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('debug'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  parsed.error.errors.forEach((err) => {
    console.error(`  ${err.path.join('.')}: ${err.message}`);
  });
  process.exit(1);
}

module.exports = parsed.data;
