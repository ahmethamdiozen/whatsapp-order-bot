import dotenv from 'dotenv';
dotenv.config();

import { app } from './app';
import { initSentry } from './lib/sentry';
import { logger } from './lib/logger';

initSentry();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
