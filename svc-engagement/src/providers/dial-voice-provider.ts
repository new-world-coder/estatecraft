import {
  IVoiceProvider,
  VoiceProviderConfig,
  InitiateCallParams,
  CallResult,
  CallStatusResult,
  SendSmsParams,
  SmsResult,
  CommunicationStatus,
  CallOutcome,
} from '@estatecraft/shared';
import { logger } from '../utils/logger';

interface DialCall {
  id: string;
  status?: string | { state?: string; label?: string };
  to?: string;
  duration?: number;
  transcript?: string | null;
}

interface DialMessage {
  id: string;
  status?: string | { state?: string; label?: string };
}

interface DialNumber {
  id: string;
  number: string;
}

const DIAL_STATUS_MAP: Record<string, CommunicationStatus> = {
  pending: CommunicationStatus.PENDING,
  queued: CommunicationStatus.QUEUED,
  initiated: CommunicationStatus.INITIATED,
  ringing: CommunicationStatus.RINGING,
  in_progress: CommunicationStatus.IN_PROGRESS,
  'in-progress': CommunicationStatus.IN_PROGRESS,
  completed: CommunicationStatus.COMPLETED,
  delivered: CommunicationStatus.DELIVERED,
  failed: CommunicationStatus.FAILED,
  no_answer: CommunicationStatus.NO_ANSWER,
  'no-answer': CommunicationStatus.NO_ANSWER,
  busy: CommunicationStatus.BUSY,
  cancelled: CommunicationStatus.CANCELLED,
  canceled: CommunicationStatus.CANCELLED,
};

function extractStatus(status: DialCall['status']): string {
  if (!status) return 'pending';
  if (typeof status === 'string') return status;
  return status.state || status.label || 'pending';
}

export class DialVoiceProvider implements IVoiceProvider {
  readonly name = 'dial';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultFromNumberId?: string;

  constructor(config: VoiceProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.getdial.ai';
    this.defaultFromNumberId = config.fromNumberId;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error('Dial API error', { path, status: response.status, body });
      throw new Error(`Dial API error: ${response.status} ${body}`);
    }

    return response.json() as Promise<T>;
  }

  private mapStatus(dialStatus: string): CommunicationStatus {
    return DIAL_STATUS_MAP[dialStatus.toLowerCase()] || CommunicationStatus.PENDING;
  }

  private async resolveFromNumberId(explicit?: string): Promise<string> {
    if (explicit || this.defaultFromNumberId) {
      return explicit || this.defaultFromNumberId!;
    }
    const numbers = await this.listNumbers();
    if (numbers.length === 0) {
      throw new Error('No Dial phone numbers available. Provision a number or set DIAL_FROM_NUMBER_ID.');
    }
    return numbers[0].id;
  }

  async listNumbers(): Promise<Array<{ id: string; number: string }>> {
    const data = await this.request<{ numbers?: DialNumber[] } | DialNumber[]>('/v1/numbers');
    const numbers = Array.isArray(data) ? data : data.numbers || [];
    return numbers.map((n) => ({ id: n.id, number: n.number }));
  }

  async initiateCall(params: InitiateCallParams): Promise<CallResult> {
    const fromNumberId = await this.resolveFromNumberId(params.fromNumberId);

    // Dial REST API expects camelCase field names (no metadata key)
    const payload = {
      to: params.to,
      fromNumberId,
      outboundInstruction: params.outboundInstruction,
    };

    logger.info('Dial initiateCall request', {
      to: params.to,
      fromNumberId,
      leadId: params.leadId,
    });

    const data = await this.request<{ call?: DialCall } | DialCall>('/v1/calls', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const call = 'call' in data && data.call ? data.call : (data as DialCall);
    if (!call?.id) {
      throw new Error(`Dial API returned unexpected call payload: ${JSON.stringify(data)}`);
    }

    const mappedStatus = this.mapStatus(extractStatus(call.status));
    logger.info('Dial call initiated', {
      callId: call.id,
      status: extractStatus(call.status),
      leadId: params.leadId,
    });

    return {
      callId: call.id,
      externalId: call.id,
      status: mappedStatus,
      provider: this.name,
    };
  }

  async getCallStatus(callId: string): Promise<CallStatusResult> {
    const data = await this.request<{ call?: DialCall } | DialCall>(`/v1/calls/${callId}`);
    const call = 'call' in data && data.call ? data.call : (data as DialCall);
    const status = this.mapStatus(extractStatus(call.status));

    let outcome: CallOutcome | undefined;
    if (status === CommunicationStatus.COMPLETED) {
      outcome = CallOutcome.CONNECTED;
    } else if (status === CommunicationStatus.NO_ANSWER) {
      outcome = CallOutcome.NO_ANSWER;
    } else if (status === CommunicationStatus.BUSY) {
      outcome = CallOutcome.BUSY;
    } else if (status === CommunicationStatus.FAILED) {
      outcome = CallOutcome.FAILED;
    }

    return {
      callId,
      externalId: call.id,
      status,
      outcome,
      duration: call.duration,
      transcript: call.transcript || undefined,
    };
  }

  async sendSms(params: SendSmsParams): Promise<SmsResult> {
    const fromNumberId = await this.resolveFromNumberId(params.fromNumberId);

    const payload = {
      to: params.to,
      fromNumberId,
      body: params.body,
    };

    const data = await this.request<{ message?: DialMessage } | DialMessage>('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const message = 'message' in data && data.message ? data.message : (data as DialMessage);
    if (!message?.id) {
      throw new Error(`Dial API returned unexpected message payload: ${JSON.stringify(data)}`);
    }

    logger.info('Dial SMS sent', { messageId: message.id, leadId: params.leadId });

    return {
      messageId: message.id,
      externalId: message.id,
      status: this.mapStatus(extractStatus(message.status)),
      provider: this.name,
    };
  }
}
