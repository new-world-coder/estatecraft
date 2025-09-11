import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
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
import { messageQueueService } from './services/message-queue';
import { redisService } from './services/redis';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.corsOrigins,
    methods: ['GET', 'POST']
  }
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigins,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Logging and compression
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'estatecraft-api',
    version: config.version
  });
});

// API routes
app.use('/api/leads', authMiddleware, leadRoutes);
app.use('/api/webhooks', webhookRoutes);

// WebSocket connection handling
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

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Initialize services
async function initializeServices() {
  try {
    await messageQueueService.connect();
    await redisService.connect();
    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  await initializeServices();
  
  server.listen(config.port, () => {
    logger.info(`EstateCraft API Gateway running on port ${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`CORS origins: ${config.corsOrigins.join(', ')}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await messageQueueService.disconnect();
  await redisService.disconnect();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await messageQueueService.disconnect();
  await redisService.disconnect();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
