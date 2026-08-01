import { PrismaClient } from '@prisma/client';
import type { CommunicationStore, CommunicationRecord } from '@estatecraft/svc-engagement';
import type { QualificationStore } from '@estatecraft/svc-qualifier';

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

export function createCommunicationStore(db: PrismaClient): CommunicationStore {
  return {
    async createCommunication(data) {
      const record = await db.communication.create({
        data: {
          leadId: data.leadId,
          channel: data.channel as any,
          direction: data.direction as any,
          status: data.status as any,
          provider: data.provider,
          providerRef: data.providerRef,
          content: data.content,
          retryCount: data.retryCount ?? 0,
          parentId: data.parentId,
          metadata: data.metadata as any,
        },
      });
      return mapCommunication(record);
    },

    async updateCommunication(id, data) {
      const record = await db.communication.update({
        where: { id },
        data: {
          status: data.status as any,
          providerRef: data.providerRef,
          content: data.content,
          retryCount: data.retryCount,
        },
      });
      return mapCommunication(record);
    },

    async createCallRecord(data) {
      await db.callRecord.create({
        data: {
          communicationId: data.communicationId,
          externalCallId: data.externalCallId,
          duration: data.duration,
          outcome: data.outcome as any,
          transcript: data.transcript,
          startedAt: data.startedAt,
          endedAt: data.endedAt,
        },
      });
    },

    async updateCallRecord(communicationId, data) {
      await db.callRecord.update({
        where: { communicationId },
        data: {
          duration: data.duration,
          outcome: data.outcome as any,
          transcript: data.transcript,
          endedAt: data.endedAt,
        },
      });
    },

    async getCommunication(id) {
      const record = await db.communication.findUnique({ where: { id } });
      return record ? mapCommunication(record) : null;
    },

    async getLeadCommunications(leadId) {
      const records = await db.communication.findMany({
        where: { leadId },
        orderBy: { createdAt: 'desc' },
      });
      return records.map(mapCommunication);
    },

    async scheduleFollowUp(data) {
      await db.scheduledFollowUp.create({
        data: {
          leadId: data.leadId,
          scheduledAt: data.scheduledAt,
          type: data.type,
          status: 'PENDING',
          notes: data.notes,
        },
      });
    },
  };
}

export function createQualificationStore(db: PrismaClient): QualificationStore {
  return {
    async updateLeadScore(leadId, score, aiConfidence, factors, status) {
      await db.lead.update({
        where: { id: leadId },
        data: {
          qualificationScore: score,
          aiConfidence,
          ...(status ? { status: status as any } : {}),
          metadata: { lastFactors: factors },
        },
      });
    },

    async recordScoreHistory(leadId, score, factors, trigger) {
      await db.leadScoreHistory.create({
        data: {
          leadId,
          score,
          factors: factors as any,
          trigger,
        },
      });
    },

    async getActiveVoiceRules() {
      const rules = await db.voiceRule.findMany({
        where: { enabled: true },
        orderBy: { priority: 'desc' },
      });
      return rules.map((r) => ({
        id: r.id,
        name: r.name,
        enabled: r.enabled,
        minQualificationScore: r.minQualificationScore,
        maxRetries: r.maxRetries,
        retryDelayMinutes: r.retryDelayMinutes,
        smsFallbackEnabled: r.smsFallbackEnabled,
        smsFallbackTemplate: r.smsFallbackTemplate,
        outboundInstruction: r.outboundInstruction,
        priority: r.priority,
      }));
    },
  };
}

function mapCommunication(record: {
  id: string;
  leadId: string;
  channel: string;
  status: string;
  provider: string;
  providerRef: string | null;
  retryCount: number;
  parentId: string | null;
  content: string | null;
}): CommunicationRecord {
  return {
    id: record.id,
    leadId: record.leadId,
    channel: record.channel,
    status: record.status,
    provider: record.provider,
    providerRef: record.providerRef,
    retryCount: record.retryCount,
    parentId: record.parentId,
    content: record.content,
  };
}
