import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';

for (const key of ['JWT_SECRET', 'ADMIN_PASSWORD']) {
  if (isProd && !process.env[key]) throw new Error(`${key} must be set in production`);
}

export const config = {
  env,
  isProd,
  isTest: env === 'test',
  port: Number(process.env.PORT) || 4000,
  dbPath: process.env.DB_PATH || path.join(here, '..', 'data', 'shopverse.db'),
  dataDir: path.join(here, '..', 'data'),
  clientDist: path.join(here, '..', '..', 'client', 'dist'),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: '7d',
  // Where Stripe sends shoppers back to; Render provides RENDER_EXTERNAL_URL automatically.
  publicUrl: process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@shopverse.dev',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin@12345',
  // Unpaid card orders release their reserved stock after this long.
  pendingOrderTtlMinutes: 60,
  // The dataset is priced in US dollars; prices are converted to rupees once, when the catalogue is seeded.
  usdToInr: Number(process.env.USD_TO_INR) || 85,
  // All amounts are stored in paise (1/100 rupee). Indian prices are GST-inclusive, so no tax is added on top.
  shop: {
    currency: 'inr',
    freeShippingThresholdCents: 49900,
    shippingCents: 4000,
    taxRate: 0,
  },
};
