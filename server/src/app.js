import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { HttpError, errorHandler } from './lib/http.js';
import { stripe } from './lib/orders.js';
import { loadUser } from './middleware/auth.js';
import accountRoutes from './routes/account.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import cartRoutes from './routes/cart.js';
import catalogRoutes from './routes/catalog.js';
import { ordersRouter, stripeWebhook } from './routes/orders.js';
import reviewRoutes from './routes/reviews.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https://m.media-amazon.com', 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'"],
        formAction: ["'self'", 'https://checkout.stripe.com'],
      },
    },
  }));
  app.use(compression());
  if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));

  app.post('/api/payments/webhook', ...stripeWebhook);

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api', rateLimit({ windowMs: 60_000, limit: config.isTest ? 10_000 : 300, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.use(loadUser);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/config', (_req, res) => res.json({
    cardPayments: Boolean(stripe),
    currency: config.shop.currency,
    freeShippingThresholdCents: config.shop.freeShippingThresholdCents,
    shippingCents: config.shop.shippingCents,
    taxRate: config.shop.taxRate,
  }));
  app.use('/api/auth', authRoutes);
  app.use('/api/catalog', catalogRoutes);
  app.use('/api/catalog/products/:productId/reviews', reviewRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/account', accountRoutes);
  app.use('/api/orders', ordersRouter);
  app.use('/api/admin', adminRoutes);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'API route not found')));

  // In production the built React app is served from the same origin.
  if (fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist, { maxAge: '1y', index: false, immutable: true }));
    app.get('/{*splat}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(config.clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
