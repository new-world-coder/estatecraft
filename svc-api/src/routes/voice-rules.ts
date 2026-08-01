import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getPrisma } from '../services/prisma-store';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const db = getPrisma();
    const rules = await db.voiceRule.findMany({ orderBy: { priority: 'desc' } });
    res.json({ success: true, data: rules });
  } catch (error) {
    logger.error('Error fetching voice rules:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch voice rules' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const db = getPrisma();
    const {
      name,
      enabled = true,
      minQualificationScore = 70,
      maxRetries = 3,
      retryDelayMinutes = 30,
      smsFallbackEnabled = true,
      smsFallbackTemplate,
      outboundInstruction,
      priority = 0,
    } = req.body;

    if (!name || !outboundInstruction) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'name and outboundInstruction are required',
      });
    }

    const rule = await db.voiceRule.create({
      data: {
        name,
        enabled,
        minQualificationScore,
        maxRetries,
        retryDelayMinutes,
        smsFallbackEnabled,
        smsFallbackTemplate,
        outboundInstruction,
        priority,
      },
    });

    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    logger.error('Error creating voice rule:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create voice rule' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const db = getPrisma();
    const rule = await db.voiceRule.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: rule });
  } catch (error) {
    logger.error('Error updating voice rule:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update voice rule' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const db = getPrisma();
    await db.voiceRule.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Voice rule deleted' });
  } catch (error) {
    logger.error('Error deleting voice rule:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete voice rule' });
  }
});

export { router as voiceRuleRoutes };
