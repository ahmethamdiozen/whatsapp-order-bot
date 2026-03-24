import express from 'express';
import { webhookRouter } from './webhook/handler';
import { paymentRouter } from './payment/payment.router';
import { adminRouter } from './admin/admin.router';

export const app = express();

app.use('/payment/stripe-webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use('/webhook', webhookRouter);
app.use('/payment', paymentRouter);
app.use('/admin', adminRouter);
