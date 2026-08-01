import { Router } from 'express';
import { logger } from '../utils/logger';
import { getPrisma } from '../services/prisma-store';

const router = Router();

router.post('/', async (req, res) => {
  logger.info('Webhook received', { body: req.body, headers: req.headers });
  res.json({ success: true, message: 'Webhook received' });
});

router.post('/dial', async (req, res) => {
  try {
    const event = req.body;
    logger.info('Dial webhook received', { type: event.type || event.event, id: event.id });

    const db = getPrisma();
    const externalId = event.call_id || event.id || event.data?.id;

    if (externalId) {
      const callRecord = await db.callRecord.findFirst({
        where: { externalCallId: externalId },
        include: { communication: true },
      });

      if (callRecord) {
        const statusMap: Record<string, string> = {
          completed: 'COMPLETED',
          failed: 'FAILED',
          no_answer: 'NO_ANSWER',
          busy: 'BUSY',
          in_progress: 'IN_PROGRESS',
        };
        const dialStatus = (event.status || event.data?.status || '').toLowerCase();
        const mappedStatus = statusMap[dialStatus];

        if (mappedStatus) {
          await db.communication.update({
            where: { id: callRecord.communicationId },
            data: { status: mappedStatus as any },
          });
        }

        await db.callRecord.update({
          where: { id: callRecord.id },
          data: {
            duration: event.duration || event.data?.duration,
            transcript: event.transcript || event.data?.transcript,
            outcome: dialStatus === 'completed' ? 'CONNECTED' : undefined,
            endedAt: new Date(),
          },
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Dial webhook error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export { router as webhookRoutes };
