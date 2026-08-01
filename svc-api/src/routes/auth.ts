import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

const demoUsers = [
  {
    id: 'admin-1',
    email: 'admin@summitridge.demo',
    password: '$2a$12$AAc/yZz9X4TQ/9TBgYXnEOdz6H4UnInDFMP5n5BRqfl9b5QnquuHO',
    firstName: 'Rachel',
    lastName: 'Summit',
    role: 'ADMIN',
  },
  {
    id: 'manager-1',
    email: 'manager@summitridge.demo',
    password: '$2a$12$AAc/yZz9X4TQ/9TBgYXnEOdz6H4UnInDFMP5n5BRqfl9b5QnquuHO',
    firstName: 'Marcus',
    lastName: 'Ridge',
    role: 'MANAGER',
  },
  {
    id: 'agent-1',
    email: 'agent1@summitridge.demo',
    password: '$2a$12$AAc/yZz9X4TQ/9TBgYXnEOdz6H4UnInDFMP5n5BRqfl9b5QnquuHO',
    firstName: 'Agent',
    lastName: 'One',
    role: 'AGENT',
  },
];

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required',
      });
    }

    const user = demoUsers.find((u) => u.email === email);
    if (!user) {
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
      { id: user.id, email: user.email, role: user.role },
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

router.get('/me', (req, res) => {
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
      const decoded = jwt.verify(token, config.jwtSecret) as {
        id: string;
        email: string;
        role: string;
      };
      const user = demoUsers.find((u) => u.id === decoded.id);

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
