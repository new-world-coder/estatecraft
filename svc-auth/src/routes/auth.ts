import { Router, type IRouter } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { logger } from '../utils/logger';

const router: IRouter = Router();
const prisma = new PrismaClient();

/**
 * @deprecated Prefer auth via svc-api (`POST /api/auth/login`).
 * This service is retained for local `npm run dev:auth` compatibility
 * and now uses the same Prisma User table as svc-api.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required',
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase() },
    });

    if (!user || !user.password) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
    );

    logger.info(`User logged in successfully: ${email}`);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Login failed',
    });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role = 'AGENT' } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email, password, firstName, and lastName are required',
      });
    }

    const normalizedEmail = String(email).toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'User already exists',
      });
    }

    const hashedPassword = await bcrypt.hash(password, config.bcryptRounds);
    const allowedRoles = new Set(['ADMIN', 'MANAGER', 'AGENT']);
    const userRole = allowedRoles.has(String(role).toUpperCase())
      ? (String(role).toUpperCase() as 'ADMIN' | 'MANAGER' | 'AGENT')
      : 'AGENT';

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        firstName,
        lastName,
        role: userRole,
      },
    });

    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
      },
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Registration failed',
    });
  }
});

router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided',
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as { id: string };
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });

      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid token',
        });
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      });
    } catch {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token',
      });
    }
  } catch (error) {
    logger.error('Get user profile error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user profile',
    });
  }
});

export { router as authRoutes };
