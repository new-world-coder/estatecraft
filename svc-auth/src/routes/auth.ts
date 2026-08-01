import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

  // Mock user database (in production, this would be a real database)
  const mockUsers = [
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

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required'
      });
    }
    
    // Find user
    const user = mockUsers.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
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
          role: user.role
        }
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Login failed'
    });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role = 'AGENT' } = req.body;
    
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email, password, firstName, and lastName are required'
      });
    }
    
    // Check if user already exists
    const existingUser = mockUsers.find(u => u.email === email);
    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'User already exists'
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, config.bcryptRounds);
    
    // Create new user (in production, this would be saved to database)
    const newUser = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role
    };
    
    logger.info(`New user registered: ${email}`);
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Registration failed'
    });
  }
});

// GET /api/auth/me (protected route)
router.get('/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      const user = mockUsers.find(u => u.id === decoded.id);
      
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid token'
        });
      }
      
      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      });
    } catch (jwtError) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token'
      });
    }
  } catch (error) {
    logger.error('Get user profile error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user profile'
    });
  }
});

export { router as authRoutes };
