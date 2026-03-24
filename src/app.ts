import express from 'express';
import cors from 'cors';
import { webhookRouter } from './webhook/handler';
import { paymentRouter } from './payment/payment.router';
import { adminRouter } from './admin/admin.router';

export const app = express();

app.use(cors({ origin: process.env.ADMIN_PANEL_URL ?? 'http://localhost:5173' }));
app.use('/payment/stripe-webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use('/webhook', webhookRouter);
app.use('/payment', paymentRouter);
app.use('/admin', adminRouter);
