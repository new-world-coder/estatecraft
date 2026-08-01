export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  version: '1.0.0',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:3001',
  ],
  
  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://sales_ai_user:sales_ai_password@localhost:5432/sales_ai_platform',
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  
  // Password hashing
  bcryptRounds: 12
};
