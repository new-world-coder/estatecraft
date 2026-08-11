const env = (name: string, fallback = ''): string => (process.env[name] || fallback).trim();

export const config = {
  port: parseInt(env('PORT', '3000'), 10),
  nodeEnv: env('NODE_ENV', 'development'),
  version: env('APP_VERSION', '1.0.0'),
  corsOrigins: env('CORS_ORIGINS')
    ? env('CORS_ORIGINS').split(',').map((origin) => origin.trim()).filter(Boolean)
    : [
    'http://localhost:3002',
    'http://localhost:5173',
    'http://localhost:3000',
  ],

  databaseUrl:
    env('DATABASE_URL') ||
    'postgresql://estatecraft_user:estatecraft_password@localhost:5432/estatecraft',

  rabbitmqUrl:
    env('RABBITMQ_URL') ||
    'amqp://estatecraft_user:estatecraft_password@localhost:5672/estatecraft_vhost',

  redisUrl: env('REDIS_URL') || 'redis://localhost:6379',

  jwtSecret: env('JWT_SECRET') || 'dev-jwt-secret-change-in-production',
  jwtExpiresIn: env('JWT_EXPIRES_IN', '24h'),

  voiceProvider: env('VOICE_PROVIDER', 'mock') as 'dial' | 'twilio' | 'mock',
  dialApiKey: env('DIAL_API_KEY'),
  dialBaseUrl: env('DIAL_BASE_URL') || 'https://api.getdial.ai',
  dialFromNumberId: env('DIAL_FROM_NUMBER_ID'),

  skipInfra: env('SKIP_INFRA') === 'true' || env('VERCEL') === '1',
  autoSeed: env('AUTO_SEED') === 'true' || env('NODE_ENV', 'development') === 'development',

  /** Public API URL for OIDC redirect_uri */
  publicApiUrl: env('PUBLIC_API_URL', 'http://localhost:3000'),
  /** SaaS apex domain for tenant hostnames */
  saasBaseDomain: env('SAAS_BASE_DOMAIN', 'estatecraft.io'),
  /**
   * Local/dev only: allow password login on SSO-required (Pro/Enterprise) tenants.
   * Never enable in production.
   */
  tenantSsoPasswordBypass: env('TENANT_SSO_PASSWORD_BYPASS') === 'true',
  /** Ops key for POST /api/tenants provisioning */
  platformAdminKey: env('PLATFORM_ADMIN_KEY'),

  rateLimitWindowMs: 15 * 60 * 1000,
  rateLimitMax: 100,
};
