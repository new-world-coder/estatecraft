import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getPrisma } from '../services/prisma-store';
import { leadAccessWhere, canAccessLead } from '../utils/access';
import { requireTenantContext } from '../tenant/context';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    logger.info('Fetching leads', { userId: req.user?.id, role: req.user?.role });
    const db = getPrisma();

    const { status, priority, limit = '100', offset = '0' } = req.query;

    const leads = await db.lead.findMany({
      where: {
        ...leadAccessWhere(req),
        ...(status ? { status: String(status).toUpperCase() as any } : {}),
        ...(priority ? { priority: String(priority).toUpperCase() as any } : {}),
      },
      include: {
        assignedUser: { select: { firstName: true, lastName: true, email: true } },
        property: { select: { title: true, city: true, price: true } },
        communications: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          select: { id: true, channel: true, status: true, createdAt: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: parseInt(String(limit), 10),
      skip: parseInt(String(offset), 10),
    });

    res.json({ success: true, data: leads, count: leads.length });
  } catch (error) {
    logger.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch leads' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const db = getPrisma();
    const lead = await db.lead.findUnique({
      where: { id: req.params.id },
      include: {
        assignedUser: true,
        property: true,
        communications: {
          include: { callRecord: true },
          orderBy: { createdAt: 'desc' },
        },
        scoreHistory: { orderBy: { createdAt: 'desc' }, take: 10 },
        scheduledFollowUps: { orderBy: { scheduledAt: 'asc' } },
      },
    });

    if (!lead) {
      return res.status(404).json({ error: 'Not Found', message: 'Lead not found' });
    }

    if (!canAccessLead(req, lead)) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this lead' });
    }

    res.json({ success: true, data: lead });
  } catch (error) {
    logger.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch lead' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    logger.info('Creating new lead', { userId: req.user?.id });
    const db = getPrisma();
    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      jobTitle,
      source = 'WEBSITE',
      priority = 'MEDIUM',
      propertyType,
      priceMin,
      priceMax,
      city,
      state,
      country,
      propertyId,
      assignedTo,
    } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'firstName, lastName, and email are required',
      });
    }

    // Agents can only assign leads to themselves
    const role = req.user?.role?.toUpperCase();
    let assignee = assignedTo as string | undefined;
    if (role === 'AGENT') {
      assignee = req.user!.id;
    }

    const { tenantId } = requireTenantContext();

    const lead = await db.lead.create({
      data: {
        tenantId,
        firstName,
        lastName,
        email,
        phone,
        company,
        jobTitle,
        source: source.toUpperCase() as any,
        priority: priority.toUpperCase() as any,
        propertyType,
        priceMin,
        priceMax,
        city,
        state,
        country,
        propertyId,
        assignedTo: assignee,
        status: 'NEW',
      },
    });

    res.status(201).json({ success: true, data: lead });
  } catch (error) {
    logger.error('Error creating lead:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create lead' });
  }
});

export { router as leadRoutes };
