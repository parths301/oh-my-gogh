import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
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
