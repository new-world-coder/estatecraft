import { PrismaClient } from '@prisma/client';
import type { CommunicationStore, CommunicationRecord } from '@estatecraft/svc-engagement';
import type { QualificationStore } from '@estatecraft/svc-qualifier';
import { getTenantContext } from '../tenant/context';

const TENANT_SCOPED_MODELS = new Set([
  'User',
  'Property',
  'Lead',
  'Communication',
  'CallRecord',
  'VoiceRule',
  'LeadScoreHistory',
  'ScheduledFollowUp',
  'TenantMembership',
]);

let prisma: PrismaClient | null = null;

function applyTenantScope() {
  if (!prisma) return;

  prisma.$use(async (params, next) => {
    const ctx = getTenantContext();
    if (!ctx || !params.model || !TENANT_SCOPED_MODELS.has(params.model)) {
      return next(params);
    }

    const tenantId = ctx.tenantId;

    if (params.action === 'create') {
      params.args = params.args || {};
      params.args.data = { ...params.args.data, tenantId: params.args.data?.tenantId ?? tenantId };
    }

    if (params.action === 'createMany' && Array.isArray(params.args?.data)) {
      params.args.data = params.args.data.map((row: Record<string, unknown>) => ({
        ...row,
        tenantId: row.tenantId ?? tenantId,
      }));
    }

    if (
      ['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy'].includes(params.action)
    ) {
      params.args = params.args || {};
      if (params.action === 'findUnique') {
        const result = await next(params);
        if (result && typeof result === 'object' && 'tenantId' in result && (result as { tenantId: string }).tenantId !== tenantId) {
          return null;
        }
        return result;
      }
      params.args.where = { ...params.args.where, tenantId };
    }

    if (['update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)) {
      params.args = params.args || {};
      if (params.action === 'update' || params.action === 'delete') {
        const result = await next(params);
        // Best-effort: prefer where with tenant when possible
        return result;
      }
      params.args.where = { ...params.args.where, tenantId };
    }

    if (params.action === 'upsert') {
      params.args = params.args || {};
      params.args.where = { ...params.args.where };
      params.args.create = { ...params.args.create, tenantId: params.args.create?.tenantId ?? tenantId };
      params.args.update = { ...params.args.update };
    }

    return next(params);
  });
}

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
    applyTenantScope();
  }
  return prisma;
}

/** Unscoped client for auth, provisioning, and cross-tenant admin (no ALS injection). */
export function getPrismaAdmin(): PrismaClient {
  return getPrisma();
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
      const tenantId = getTenantContext()?.tenantId;
      const record = await db.communication.create({
        data: {
          ...(tenantId ? { tenantId } : {}),
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
        } as any,
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
      const tenantId = getTenantContext()?.tenantId;
      await db.callRecord.create({
        data: {
          ...(tenantId ? { tenantId } : {}),
          communicationId: data.communicationId,
          externalCallId: data.externalCallId,
          duration: data.duration,
          outcome: data.outcome as any,
          transcript: data.transcript,
          startedAt: data.startedAt,
          endedAt: data.endedAt,
        } as any,
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
      const tenantId = getTenantContext()?.tenantId;
      await db.scheduledFollowUp.create({
        data: {
          ...(tenantId ? { tenantId } : {}),
          leadId: data.leadId,
          scheduledAt: data.scheduledAt,
          type: data.type,
          status: 'PENDING',
          notes: data.notes,
        } as any,
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
      const tenantId = getTenantContext()?.tenantId;
      await db.leadScoreHistory.create({
        data: {
          ...(tenantId ? { tenantId } : {}),
          leadId,
          score,
          factors: factors as any,
          trigger,
        } as any,
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
