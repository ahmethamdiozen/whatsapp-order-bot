import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { webhookRouter } from './webhook/handler';
import { paymentRouter } from './payment/payment.router';
import { adminRouter } from './admin/admin.router';
import { logger } from './lib/logger';
import { captureException } from './lib/sentry';

export const app = express();

// Rate limiter: max 30 messages per phone number per minute
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => {
    const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    return message?.from ?? 'unknown';
  },
  handler: (_req, res) => {
    res.sendStatus(429);
  },
  skip: (req) => req.method === 'GET' || process.env.NODE_ENV === 'test',
  validate: { xForwardedForHeader: false },
});

app.use(cors({ origin: process.env.ADMIN_PANEL_URL ?? 'http://localhost:5173' }));
app.use('/payment/stripe-webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use('/webhook', webhookLimiter, webhookRouter);
app.use('/payment', paymentRouter);
app.use('/admin', adminRouter);

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error(err.message, { stack: err.stack, path: req.path, method: req.method });
  captureException(err, { path: req.path, method: req.method });
  res.status(500).json({ error: 'Internal server error' });
});
