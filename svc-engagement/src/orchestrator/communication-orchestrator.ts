import {
  IVoiceProvider,
  VoiceRuleConfig,
  CommunicationStatus,
  CallOutcome,
  createVoiceCallInitiatedEvent,
  createVoiceCallCompletedEvent,
  createVoiceCallFailedEvent,
  createSmsFallbackTriggeredEvent,
} from '@estatecraft/shared';
import { logger } from '../utils/logger';

export interface LeadContact {
  id: string;
  phone?: string | null;
  firstName: string;
  lastName: string;
}

export interface CommunicationRecord {
  id: string;
  leadId: string;
  channel: string;
  status: string;
  provider: string;
  providerRef?: string | null;
  retryCount: number;
  parentId?: string | null;
  content?: string | null;
}

export interface CommunicationStore {
  createCommunication(data: {
    leadId: string;
    channel: string;
    direction: string;
    status: string;
    provider: string;
    providerRef?: string;
    content?: string;
    retryCount?: number;
    parentId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<CommunicationRecord>;

  updateCommunication(
    id: string,
    data: Partial<{
      status: string;
      providerRef: string;
      content: string;
      retryCount: number;
    }>
  ): Promise<CommunicationRecord>;

  createCallRecord(data: {
    communicationId: string;
    externalCallId?: string;
    duration?: number;
    outcome?: string;
    transcript?: string;
    startedAt?: Date;
    endedAt?: Date;
  }): Promise<void>;

  updateCallRecord(
    communicationId: string,
    data: Partial<{
      duration: number;
      outcome: string;
      transcript: string;
      endedAt: Date;
    }>
  ): Promise<void>;

  getCommunication(id: string): Promise<CommunicationRecord | null>;
  getLeadCommunications(leadId: string): Promise<CommunicationRecord[]>;
  scheduleFollowUp(data: {
    leadId: string;
    scheduledAt: Date;
    type: string;
    notes?: string;
  }): Promise<void>;
}

export type EventPublisher = (event: unknown) => void | Promise<void>;

export class CommunicationOrchestrator {
  constructor(
    private readonly provider: IVoiceProvider,
    private readonly store: CommunicationStore,
    private readonly eventPublisher?: EventPublisher
  ) {}

  async triggerOutboundCall(
    lead: LeadContact,
    rule: VoiceRuleConfig,
    retryCount = 0,
    parentCommunicationId?: string
  ): Promise<CommunicationRecord> {
    if (!lead.phone) {
      throw new Error(`Lead ${lead.id} has no phone number for voice outreach`);
    }

    const instruction = rule.outboundInstruction.replace(
      '{{leadName}}',
      `${lead.firstName} ${lead.lastName}`
    );

    const communication = await this.store.createCommunication({
      leadId: lead.id,
      channel: 'VOICE',
      direction: 'OUTBOUND',
      status: 'PENDING',
      provider: this.provider.name,
      retryCount,
      parentId: parentCommunicationId,
      content: instruction,
    });

    try {
      const result = await this.provider.initiateCall({
        to: lead.phone,
        outboundInstruction: instruction,
        leadId: lead.id,
      });

      const updated = await this.store.updateCommunication(communication.id, {
        status: result.status.toUpperCase().replace(/-/g, '_'),
        providerRef: result.externalId || result.callId,
      });

      await this.store.createCallRecord({
        communicationId: communication.id,
        externalCallId: result.externalId || result.callId,
        startedAt: new Date(),
      });

      const event = createVoiceCallInitiatedEvent({
        leadId: lead.id,
        communicationId: communication.id,
        provider: this.provider.name,
        externalCallId: result.externalId,
        phone: lead.phone,
      });
      await this.eventPublisher?.(event);

      logger.info('Outbound call triggered', {
        leadId: lead.id,
        communicationId: communication.id,
        provider: this.provider.name,
      });

      return updated;
    } catch (error) {
      await this.store.updateCommunication(communication.id, {
        status: 'FAILED',
      });

      const reason = error instanceof Error ? error.message : 'Unknown error';
      const failEvent = createVoiceCallFailedEvent({
        leadId: lead.id,
        communicationId: communication.id,
        reason,
        retryCount,
        willRetry: retryCount < rule.maxRetries,
      });
      await this.eventPublisher?.(failEvent);

      if (retryCount < rule.maxRetries) {
        await this.scheduleRetry(lead, rule, retryCount + 1, communication.id);
      } else if (rule.smsFallbackEnabled) {
        await this.triggerSmsFallback(lead, rule, communication.id);
      }

      // Surface provider failure to API/UI instead of returning a silent FAILED record
      throw new Error(`Outbound call failed: ${reason}`);
    }
  }

  async pollCallStatus(communicationId: string): Promise<CommunicationRecord> {
    const communication = await this.store.getCommunication(communicationId);
    if (!communication || !communication.providerRef) {
      throw new Error(`Communication ${communicationId} not found or has no provider reference`);
    }

    const status = await this.provider.getCallStatus(communication.providerRef);

    const statusStr = status.status.toUpperCase().replace(/-/g, '_');
    const updated = await this.store.updateCommunication(communicationId, { status: statusStr });

    if (status.outcome || status.duration || status.transcript) {
      await this.store.updateCallRecord(communicationId, {
        duration: status.duration,
        outcome: status.outcome?.toUpperCase(),
        transcript: status.transcript,
        endedAt: new Date(),
      });
    }

    const terminalStatuses = ['COMPLETED', 'FAILED', 'NO_ANSWER', 'BUSY', 'CANCELLED'];
    if (terminalStatuses.includes(statusStr)) {
      if (statusStr === 'COMPLETED') {
        await this.eventPublisher?.(
          createVoiceCallCompletedEvent({
            leadId: communication.leadId,
            communicationId,
            outcome: status.outcome || CallOutcome.CONNECTED,
            duration: status.duration,
            transcript: status.transcript,
          })
        );
      } else if (['NO_ANSWER', 'BUSY', 'FAILED'].includes(statusStr)) {
        const rule = await this.getDefaultRule();
        const failEvent = createVoiceCallFailedEvent({
          leadId: communication.leadId,
          communicationId,
          reason: statusStr,
          retryCount: communication.retryCount,
          willRetry: communication.retryCount < rule.maxRetries,
        });
        await this.eventPublisher?.(failEvent);

        if (communication.retryCount < rule.maxRetries) {
          const lead = { id: communication.leadId, phone: '', firstName: '', lastName: '' };
          await this.scheduleRetry(lead, rule, communication.retryCount + 1, communicationId);
        } else if (rule.smsFallbackEnabled) {
          await this.triggerSmsFallbackFromCommunication(communication, rule);
        }
      }
    }

    return updated;
  }

  private async triggerSmsFallback(
    lead: LeadContact,
    rule: VoiceRuleConfig,
    parentCommunicationId: string
  ): Promise<CommunicationRecord | null> {
    if (!lead.phone) return null;

    const template =
      rule.smsFallbackTemplate ||
      'Hi {{leadName}}, we tried reaching you about your property inquiry at Summit Ridge Realty. Reply or call us back to schedule a viewing!';

    const body = template.replace('{{leadName}}', lead.firstName);

    return this.sendSmsFallback(lead, body, parentCommunicationId);
  }

  private async triggerSmsFallbackFromCommunication(
    communication: CommunicationRecord,
    rule: VoiceRuleConfig
  ): Promise<void> {
    const template =
      rule.smsFallbackTemplate ||
      'Hi there, we tried reaching you about your property inquiry at Summit Ridge Realty. Reply or call us back!';
    await this.sendSmsFallback(
      { id: communication.leadId, phone: '', firstName: 'there', lastName: '' },
      template,
      communication.id
    );
  }

  private async sendSmsFallback(
    lead: LeadContact,
    body: string,
    parentCommunicationId: string
  ): Promise<CommunicationRecord> {
    const communication = await this.store.createCommunication({
      leadId: lead.id,
      channel: 'SMS',
      direction: 'OUTBOUND',
      status: 'PENDING',
      provider: this.provider.name,
      parentId: parentCommunicationId,
      content: body,
    });

    try {
      if (!lead.phone) {
        throw new Error('No phone for SMS fallback');
      }

      const result = await this.provider.sendSms({
        to: lead.phone,
        body,
        leadId: lead.id,
      });

      const updated = await this.store.updateCommunication(communication.id, {
        status: result.status.toUpperCase().replace(/-/g, '_'),
        providerRef: result.externalId || result.messageId,
      });

      await this.eventPublisher?.(
        createSmsFallbackTriggeredEvent({
          leadId: lead.id,
          communicationId: communication.id,
          parentCommunicationId,
          reason: 'voice_call_failed',
          messageBody: body,
        })
      );

      logger.info('SMS fallback sent', { leadId: lead.id, communicationId: communication.id });
      return updated;
    } catch (error) {
      logger.error('SMS fallback failed', { leadId: lead.id, error });
      return await this.store.updateCommunication(communication.id, { status: 'FAILED' });
    }
  }

  private async scheduleRetry(
    lead: LeadContact,
    rule: VoiceRuleConfig,
    retryCount: number,
    parentCommunicationId: string
  ): Promise<void> {
    const scheduledAt = new Date(Date.now() + rule.retryDelayMinutes * 60 * 1000);
    await this.store.scheduleFollowUp({
      leadId: lead.id,
      scheduledAt,
      type: 'voice_retry',
      notes: `Retry #${retryCount} for call ${parentCommunicationId}`,
    });
    logger.info('Voice retry scheduled', { leadId: lead.id, retryCount, scheduledAt });
  }

  private async getDefaultRule(): Promise<VoiceRuleConfig> {
    return {
      id: 'default',
      name: 'Default',
      enabled: true,
      minQualificationScore: 70,
      maxRetries: 3,
      retryDelayMinutes: 30,
      smsFallbackEnabled: true,
      outboundInstruction: 'You are a friendly real estate assistant.',
      priority: 0,
    };
  }
}
