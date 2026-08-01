import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getPrisma } from '../services/prisma-store';

const router = Router();

router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const db = getPrisma();

    const [totalCalls, completedCalls, failedCalls, smsFallbacks, recentCalls] = await Promise.all([
      db.communication.count({ where: { channel: 'VOICE' } }),
      db.communication.count({ where: { channel: 'VOICE', status: 'COMPLETED' } }),
      db.communication.count({
        where: { channel: 'VOICE', status: { in: ['FAILED', 'NO_ANSWER', 'BUSY'] } },
      }),
      db.communication.count({ where: { channel: 'SMS', parentId: { not: null } } }),
      db.communication.findMany({
        where: { channel: 'VOICE' },
        include: {
          callRecord: true,
          lead: { select: { firstName: true, lastName: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const successRate = totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalCalls,
        completedCalls,
        failedCalls,
        smsFallbacks,
        successRate,
        recentCalls,
      },
    });
  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch dashboard stats' });
  }
});

router.get('/leads-summary', async (req: AuthRequest, res) => {
  try {
    const db = getPrisma();
    const [totalLeads, qualifiedLeads, avgScore, followUps] = await Promise.all([
      db.lead.count(),
      db.lead.count({ where: { status: 'QUALIFIED' } }),
      db.lead.aggregate({ _avg: { qualificationScore: true } }),
      db.scheduledFollowUp.count({ where: { status: 'PENDING' } }),
    ]);

    res.json({
      success: true,
      data: {
        totalLeads,
        qualifiedLeads,
        averageScore: Math.round(avgScore._avg.qualificationScore || 0),
        pendingFollowUps: followUps,
      },
    });
  } catch (error) {
    logger.error('Error fetching leads summary:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch leads summary' });
  }
});

export { router as dashboardRoutes };
