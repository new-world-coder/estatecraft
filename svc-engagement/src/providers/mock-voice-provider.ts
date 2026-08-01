import {
  IVoiceProvider,
  InitiateCallParams,
  CallResult,
  CallStatusResult,
  SendSmsParams,
  SmsResult,
  CommunicationStatus,
  CallOutcome,
} from '@estatecraft/shared';
import { logger } from '../utils/logger';

/**
 * Development/mock provider — simulates voice and SMS without external API calls.
 * Used when DIAL_API_KEY is not configured.
 */
export class MockVoiceProvider implements IVoiceProvider {
  readonly name = 'mock';
  private calls: Map<string, { status: CommunicationStatus; params: InitiateCallParams; createdAt: Date }> =
    new Map();
  private messages: Map<string, { status: CommunicationStatus; params: SendSmsParams }> = new Map();

  async listNumbers(): Promise<Array<{ id: string; number: string }>> {
    return [{ id: 'mock-number-1', number: '+15550100000' }];
  }

  async initiateCall(params: InitiateCallParams): Promise<CallResult> {
    const callId = `mock-call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.calls.set(callId, {
      status: CommunicationStatus.INITIATED,
      params,
      createdAt: new Date(),
    });

    logger.info('Mock call initiated', { callId, leadId: params.leadId, to: params.to });

    // Simulate async completion
    setTimeout(() => {
      const record = this.calls.get(callId);
      if (record) {
        // ~70% success rate for realistic demo
        const success = Math.random() > 0.3;
        record.status = success ? CommunicationStatus.COMPLETED : CommunicationStatus.NO_ANSWER;
      }
    }, 3000);

    return {
      callId,
      externalId: callId,
      status: CommunicationStatus.INITIATED,
      provider: this.name,
    };
  }

  async getCallStatus(callId: string): Promise<CallStatusResult> {
    const record = this.calls.get(callId);
    if (!record) {
      return {
        callId,
        status: CommunicationStatus.FAILED,
        outcome: CallOutcome.FAILED,
      };
    }

    const age = Date.now() - record.createdAt.getTime();
    if (age < 2000 && record.status === CommunicationStatus.INITIATED) {
      return { callId, externalId: callId, status: CommunicationStatus.RINGING };
    }

    let outcome: CallOutcome | undefined;
    if (record.status === CommunicationStatus.COMPLETED) {
      outcome = CallOutcome.CONNECTED;
    } else if (record.status === CommunicationStatus.NO_ANSWER) {
      outcome = CallOutcome.NO_ANSWER;
    }

    return {
      callId,
      externalId: callId,
      status: record.status,
      outcome,
      duration: record.status === CommunicationStatus.COMPLETED ? Math.floor(Math.random() * 180) + 30 : 0,
      transcript:
        record.status === CommunicationStatus.COMPLETED
          ? 'Hello, this is Summit Ridge Realty calling about your property inquiry. Would you like to schedule a viewing?'
          : undefined,
    };
  }

  async sendSms(params: SendSmsParams): Promise<SmsResult> {
    const messageId = `mock-msg-${Date.now()}`;
    this.messages.set(messageId, { status: CommunicationStatus.DELIVERED, params });
    logger.info('Mock SMS sent', { messageId, leadId: params.leadId, to: params.to });

    return {
      messageId,
      externalId: messageId,
      status: CommunicationStatus.DELIVERED,
      provider: this.name,
    };
  }
}
