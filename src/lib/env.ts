const REQUIRED_ENV = [
  'WHATSAPP_TOKEN',
  'PHONE_NUMBER_ID',
  'VERIFY_TOKEN',
  'ANTHROPIC_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'ADMIN_TOKEN',
  'DATABASE_URL',
  'REDIS_HOST',
  'REDIS_PORT',
];

export function validateEnv(): void {
  const missing = REQUIRED_ENV.filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
