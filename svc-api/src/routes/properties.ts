import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getPrisma } from '../services/prisma-store';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const db = getPrisma();
    const properties = await db.property.findMany({
      include: { listingAgent: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: properties, count: properties.length });
  } catch (error) {
    logger.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch properties' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const db = getPrisma();
    const property = await db.property.findUnique({
      where: { id: req.params.id },
      include: {
        listingAgent: { select: { firstName: true, lastName: true, email: true } },
        leads: { select: { id: true, firstName: true, lastName: true, status: true, qualificationScore: true } },
      },
    });
    if (!property) {
      return res.status(404).json({ error: 'Not Found', message: 'Property not found' });
    }
    res.json({ success: true, data: property });
  } catch (error) {
    logger.error('Error fetching property:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch property' });
  }
});

export { router as propertyRoutes };
