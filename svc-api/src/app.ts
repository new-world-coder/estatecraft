import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error-handler';
import { authMiddleware } from './middleware/auth';
import { leadRoutes } from './routes/leads';
import { webhookRoutes } from './routes/webhooks';
import { communicationRoutes } from './routes/communications';
import { voiceRuleRoutes } from './routes/voice-rules';
import { dashboardRoutes } from './routes/dashboard';
import { qualificationRoutes } from './routes/qualification';
import { propertyRoutes } from './routes/properties';
import { authRoutes } from './routes/auth';
import { getPrisma } from './services/prisma-store';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    })
  );

  const limiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    message: 'Too many requests from this IP, please try again later.',
  });
  app.use('/api/', limiter);

  app.use(
    morgan('combined', {
      stream: { write: (message: string) => logger.info(message.trim()) },
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/health', async (_req, res) => {
    const checks: Record<string, boolean | string> = {
      api: true,
      timestamp: new Date().toISOString(),
      service: 'estatecraft-api',
      version: config.version,
      environment: config.nodeEnv,
      voiceProvider: config.voiceProvider,
    };

    try {
      const db = getPrisma();
      await db.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }

    const healthy = checks.database === true;
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'degraded',
      checks,
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/leads', authMiddleware, leadRoutes);
  app.use('/api/leads', authMiddleware, qualificationRoutes);
  app.use('/api/communications', authMiddleware, communicationRoutes);
  app.use('/api/voice-rules', authMiddleware, voiceRuleRoutes);
  app.use('/api/dashboard', authMiddleware, dashboardRoutes);
  app.use('/api/properties', authMiddleware, propertyRoutes);
  app.use('/api/webhooks', webhookRoutes);

  app.use(errorHandler);

  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.originalUrl} not found`,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
