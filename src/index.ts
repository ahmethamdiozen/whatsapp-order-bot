import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { webhookRouter } from './webhook/handler';
import { paymentRouter } from './payment/payment.router';
import { adminRouter } from './admin/admin.router';

const app = express();

// Raw body for Stripe webhook signature verification
app.use('/payment/stripe-webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

app.use('/webhook', webhookRouter);
app.use('/payment', paymentRouter);
app.use('/admin', adminRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
})