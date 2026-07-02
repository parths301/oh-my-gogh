import { loadEnv, defineConfig, Modules } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    // Session/cache Redis for multi-instance prod (SESSION_REDIS_URL in
    // compose). Kept separate from REDIS_URL: the session client hangs boot
    // against Redis 8.x (local brew); the BullMQ modules below are fine.
    redisUrl: process.env.SESSION_REDIS_URL,
    workerMode: (process.env.MEDUSA_WORKER_MODE as 'shared' | 'worker' | 'server') || 'shared',
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
  },
  admin: {
    disable: process.env.DISABLE_MEDUSA_ADMIN === 'true',
    backendUrl: process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000',
  },
  modules: [
    // Oh my Gogh custom domains
    { resolve: './src/modules/brand' },
    { resolve: './src/modules/review' },
    { resolve: './src/modules/wishlist' },
    // Redis-backed infrastructure when REDIS_URL is set (always in
    // production — required for the server+worker split); falls back to
    // the in-memory/local providers for a bare-bones local run.
    ...(process.env.REDIS_URL
      ? [
          {
            key: Modules.EVENT_BUS,
            resolve: '@medusajs/event-bus-redis',
            options: { redisUrl: process.env.REDIS_URL },
          },
          {
            key: Modules.WORKFLOW_ENGINE,
            resolve: '@medusajs/workflow-engine-redis',
            options: { redis: { redisUrl: process.env.REDIS_URL } },
          },
          {
            key: Modules.LOCKING,
            resolve: '@medusajs/medusa/locking',
            options: {
              providers: [
                {
                  resolve: '@medusajs/locking-redis',
                  id: 'locking-redis',
                  is_default: true,
                  options: { redisUrl: process.env.REDIS_URL },
                },
              ],
            },
          },
        ]
      : []),
    // Payments: Razorpay (test keys until the user signs off on live keys)
    {
      resolve: '@medusajs/medusa/payment',
      options: {
        providers: [
          {
            resolve: '@sgftech/payment-razorpay',
            id: 'razorpay',
            options: {
              key_id: process.env.RAZORPAY_KEY_ID,
              key_secret: process.env.RAZORPAY_KEY_SECRET,
              razorpay_account: process.env.RAZORPAY_ACCOUNT || '',
              automatic_expiry_period: 30,
              manual_expiry_period: 20,
              refund_speed: 'normal',
              webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
            },
          },
        ],
      },
    },
    // Email notifications via SMTP (falls back to local logging when unset)
    {
      resolve: '@medusajs/medusa/notification',
      options: {
        providers: [
          process.env.SMTP_HOST
            ? {
                resolve: './src/modules/smtp-notification',
                id: 'smtp',
                options: {
                  channels: ['email'],
                  host: process.env.SMTP_HOST,
                  port: Number(process.env.SMTP_PORT || 587),
                  secure: process.env.SMTP_SECURE === 'true',
                  user: process.env.SMTP_USER,
                  password: process.env.SMTP_PASSWORD,
                  from: process.env.SMTP_FROM || 'Oh my Gogh! <hello@ohmygogh.com>',
                },
              }
            : {
                resolve: '@medusajs/medusa/notification-local',
                id: 'local',
                options: { channels: ['email'] },
              },
        ],
      },
    },
  ],
})
