import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getPrisma, createCommunicationStore } from '../services/prisma-store';
import { getOrchestrator } from '@estatecraft/svc-engagement';
import { canAccessLead, leadAccessWhere } from '../utils/access';

const router = Router();

router.get('/timeline/:leadId', async (req: AuthRequest, res) => {
  try {
    const db = getPrisma();
    const lead = await db.lead.findUnique({ where: { id: req.params.leadId } });
    if (!lead) {
      return res.status(404).json({ error: 'Not Found', message: 'Lead not found' });
    }
    if (!canAccessLead(req, lead)) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this lead' });
    }

    const communications = await db.communication.findMany({
      where: { leadId: req.params.leadId },
      include: { callRecord: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: communications });
  } catch (error) {
    logger.error('Error fetching communication timeline:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch timeline' });
  }
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const db = getPrisma();
    const { leadId, channel, status, limit = '50' } = req.query;
    const scope = leadAccessWhere(req);

    const communications = await db.communication.findMany({
      where: {
        ...(Object.keys(scope).length ? { lead: scope } : {}),
        ...(leadId ? { leadId: String(leadId) } : {}),
        ...(channel ? { channel: String(channel).toUpperCase() as any } : {}),
        ...(status ? { status: String(status).toUpperCase() as any } : {}),
      },
      include: { callRecord: true, lead: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: parseInt(String(limit), 10),
    });

    res.json({ success: true, data: communications, count: communications.length });
  } catch (error) {
    logger.error('Error fetching communications:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch communications' });
  }
});

router.post('/call', async (req: AuthRequest, res) => {
  try {
    const { leadId } = req.body;
    if (!leadId) {
      return res.status(400).json({ error: 'Bad Request', message: 'leadId is required' });
    }

    const db = getPrisma();
    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead || !lead.phone) {
      return res.status(400).json({ error: 'Bad Request', message: 'Lead not found or missing phone' });
    }

    if (!canAccessLead(req, lead)) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this lead' });
    }

    const rules = await db.voiceRule.findMany({ where: { enabled: true }, orderBy: { priority: 'desc' } });
    const rule = rules[0];
    if (!rule) {
      return res.status(400).json({ error: 'Bad Request', message: 'No active voice rules configured' });
    }

    const store = createCommunicationStore(db);
    const orchestrator = getOrchestrator(store);
    logger.info('Initiating outbound call', {
      leadId: lead.id,
      phone: lead.phone,
      ruleId: rule.id,
    });

    const communication = await orchestrator.triggerOutboundCall(
      {
        id: lead.id,
        phone: lead.phone,
        firstName: lead.firstName,
        lastName: lead.lastName,
      },
      {
        id: rule.id,
        name: rule.name,
        enabled: rule.enabled,
        minQualificationScore: rule.minQualificationScore,
        maxRetries: rule.maxRetries,
        retryDelayMinutes: rule.retryDelayMinutes,
        smsFallbackEnabled: rule.smsFallbackEnabled,
        smsFallbackTemplate: rule.smsFallbackTemplate ?? undefined,
        outboundInstruction: rule.outboundInstruction,
        priority: rule.priority,
      }
    );

    if (communication.status === 'FAILED') {
      return res.status(502).json({
        error: 'Call Failed',
        message: 'Voice provider failed to place the call. Check Dial credentials and phone format.',
        data: communication,
      });
    }

    res.status(201).json({ success: true, data: communication });
  } catch (error) {
    logger.error('Error initiating call:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to initiate call',
    });
  }
});

router.get('/call/:communicationId/status', async (req: AuthRequest, res) => {
  try {
    const db = getPrisma();
    const existing = await db.communication.findUnique({
      where: { id: req.params.communicationId },
      include: { lead: { select: { assignedTo: true } } },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'Communication not found' });
    }
    if (!canAccessLead(req, existing.lead)) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this communication' });
    }

    const store = createCommunicationStore(db);
    const orchestrator = getOrchestrator(store);
    const communication = await orchestrator.pollCallStatus(req.params.communicationId);
    res.json({ success: true, data: communication });
  } catch (error) {
    logger.error('Error polling call status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to poll call status',
    });
  }
});

export { router as communicationRoutes };
