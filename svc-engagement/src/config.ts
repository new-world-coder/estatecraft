const env = (name: string, fallback = ''): string => (process.env[name] || fallback).trim();

export const config = {
  port: parseInt(env('PORT', '3004'), 10),
  nodeEnv: env('NODE_ENV', 'development'),
  version: '1.0.0',

  voiceProvider: env('VOICE_PROVIDER', 'mock') as 'dial' | 'twilio' | 'mock',

  dialApiKey: env('DIAL_API_KEY'),
  dialBaseUrl: env('DIAL_BASE_URL') || 'https://api.getdial.ai',
  dialFromNumberId: env('DIAL_FROM_NUMBER_ID'),

  twilioAccountSid: env('TWILIO_ACCOUNT_SID'),
  twilioAuthToken: env('TWILIO_AUTH_TOKEN'),
  twilioPhoneNumber: env('TWILIO_PHONE_NUMBER'),

  databaseUrl: env('DATABASE_URL'),
};
