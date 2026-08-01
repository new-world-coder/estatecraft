import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config';
import { logger } from './utils/logger';
import { createApp } from './app';
import { messageQueueService } from './services/message-queue';
import { redisService } from './services/redis';
import { getPrisma } from './services/prisma-store';

const app = createApp();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.corsOrigins,
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('join-lead-room', (leadId: string) => {
    socket.join(`lead-${leadId}`);
    logger.info(`Client ${socket.id} joined lead room: ${leadId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

async function initializeServices(): Promise<void> {
  if (config.skipInfra) {
    logger.info('Skipping RabbitMQ/Redis (serverless or SKIP_INFRA mode)');
    return;
  }

  try {
    await messageQueueService.connect();
  } catch (error) {
    logger.warn('RabbitMQ unavailable — continuing without message queue', { error });
  }

  try {
    await redisService.connect();
  } catch (error) {
    logger.warn('Redis unavailable — continuing without cache', { error });
  }
}

async function maybeAutoSeed(): Promise<void> {
  if (!config.autoSeed) return;

  try {
    const db = getPrisma();
    const leadCount = await db.lead.count();
    if (leadCount === 0) {
      logger.info('No leads found — run npm run db:seed to load Summit Ridge Realty sample data');
    }
  } catch (error) {
    logger.warn('Auto-seed check skipped — database not available', { error });
  }
}

async function startServer(): Promise<void> {
  await initializeServices();
  await maybeAutoSeed();

  if (process.env.VERCEL !== '1') {
    server.listen(config.port, () => {
      logger.info(`EstateCraft API Gateway running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Voice provider: ${config.voiceProvider}`);
    });
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await messageQueueService.disconnect();
  await redisService.disconnect();
  server.close(() => process.exit(0));
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await messageQueueService.disconnect();
  await redisService.disconnect();
  server.close(() => process.exit(0));
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

if (process.env.VERCEL !== '1') {
  startServer().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { app, server, io };
