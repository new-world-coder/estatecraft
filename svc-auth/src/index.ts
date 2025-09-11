import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { logger } from './utils/logger';
import { authRoutes } from './routes/auth';
import { errorHandler } from './middleware/error-handler';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigins,
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'estatecraft-auth',
    version: config.version
  });
});

// API routes
app.use('/api/auth', authRoutes);

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

// Start server
app.listen(config.port, () => {
  logger.info(`EstateCraft Auth Service running on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`CORS origins: ${config.corsOrigins.join(', ')}`);
});
