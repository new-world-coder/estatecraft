import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getPrisma, createCommunicationStore, createQualificationStore } from '../services/prisma-store';
import { QualificationEngine } from '@estatecraft/svc-qualifier';
import { triggerVoiceForLead } from '@estatecraft/svc-engagement';

const router = Router();

router.post('/:id/qualify', async (req: AuthRequest, res) => {
  try {
    const db = getPrisma();
    const lead = await db.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) {
      return res.status(404).json({ error: 'Not Found', message: 'Lead not found' });
    }

    const qualStore = createQualificationStore(db);
    const commStore = createCommunicationStore(db);

    const engine = new QualificationEngine(
      qualStore,
      async (event) => logger.debug('Qualification event', { type: (event as { type: string }).type }),
      async (qualifiableLead, rule) => {
        await triggerVoiceForLead(commStore, {
          id: qualifiableLead.id,
          phone: qualifiableLead.phone,
          firstName: qualifiableLead.firstName,
          lastName: qualifiableLead.lastName,
        }, rule);
      }
    );

    const result = await engine.qualifyLead({
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      phone: lead.phone,
      email: lead.email,
      source: lead.source,
      priority: lead.priority,
      priceMax: lead.priceMax,
      qualificationScore: lead.qualificationScore,
      status: lead.status,
    });

    const updated = await db.lead.findUnique({ where: { id: lead.id } });

    res.json({ success: true, data: { scoring: result, lead: updated } });
  } catch (error) {
    logger.error('Error qualifying lead:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to qualify lead',
    });
  }
});

router.post('/qualify-batch', async (req: AuthRequest, res) => {
  try {
    const db = getPrisma();
    const leads = await db.lead.findMany({ where: { status: 'NEW' }, take: 50 });
    const qualStore = createQualificationStore(db);
    const commStore = createCommunicationStore(db);

    const engine = new QualificationEngine(
      qualStore,
      undefined,
      async (qualifiableLead, rule) => {
        await triggerVoiceForLead(commStore, {
          id: qualifiableLead.id,
          phone: qualifiableLead.phone,
          firstName: qualifiableLead.firstName,
          lastName: qualifiableLead.lastName,
        }, rule);
      }
    );

    const results = await engine.qualifyBatch(
      leads.map((l) => ({
        id: l.id,
        firstName: l.firstName,
        lastName: l.lastName,
        phone: l.phone,
        email: l.email,
        source: l.source,
        priority: l.priority,
        priceMax: l.priceMax,
        qualificationScore: l.qualificationScore,
        status: l.status,
      }))
    );

    res.json({ success: true, data: { qualified: results.length, results } });
  } catch (error) {
    logger.error('Error batch qualifying leads:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to batch qualify leads' });
  }
});

export { router as qualificationRoutes };
