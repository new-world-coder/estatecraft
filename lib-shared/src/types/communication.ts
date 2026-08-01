import { z } from 'zod';

export enum CommunicationChannel {
  VOICE = 'voice',
  SMS = 'sms',
  EMAIL = 'email',
  WHATSAPP = 'whatsapp',
}

export enum CommunicationDirection {
  OUTBOUND = 'outbound',
  INBOUND = 'inbound',
}

export enum CommunicationStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  INITIATED = 'initiated',
  RINGING = 'ringing',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  NO_ANSWER = 'no_answer',
  BUSY = 'busy',
  CANCELLED = 'cancelled',
}

export enum CallOutcome {
  CONNECTED = 'connected',
  NO_ANSWER = 'no_answer',
  BUSY = 'busy',
  FAILED = 'failed',
  VOICEMAIL = 'voicemail',
}

export interface InitiateCallParams {
  to: string;
  fromNumberId?: string;
  outboundInstruction: string;
  leadId: string;
  metadata?: Record<string, unknown>;
}

export interface CallResult {
  callId: string;
  externalId?: string;
  status: CommunicationStatus;
  provider: string;
}

export interface CallStatusResult {
  callId: string;
  externalId?: string;
  status: CommunicationStatus;
  outcome?: CallOutcome;
  duration?: number;
  transcript?: string;
}

export interface SendSmsParams {
  to: string;
  fromNumberId?: string;
  body: string;
  leadId: string;
  metadata?: Record<string, unknown>;
}

export interface SmsResult {
  messageId: string;
  externalId?: string;
  status: CommunicationStatus;
  provider: string;
}

export interface VoiceProviderConfig {
  apiKey: string;
  baseUrl?: string;
  fromNumberId?: string;
}

/** Provider contract — implementations must not leak vendor specifics beyond provider name */
export interface IVoiceProvider {
  readonly name: string;
  initiateCall(params: InitiateCallParams): Promise<CallResult>;
  getCallStatus(callId: string): Promise<CallStatusResult>;
  sendSms(params: SendSmsParams): Promise<SmsResult>;
  listNumbers(): Promise<Array<{ id: string; number: string }>>;
}

export interface VoiceRuleConfig {
  id: string;
  name: string;
  enabled: boolean;
  minQualificationScore: number;
  maxRetries: number;
  retryDelayMinutes: number;
  smsFallbackEnabled: boolean;
  smsFallbackTemplate?: string;
  outboundInstruction: string;
  priority: number;
}

export interface CommunicationTimelineEntry {
  id: string;
  leadId: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  status: CommunicationStatus;
  content?: string;
  provider: string;
  retryCount: number;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export const InitiateCallParamsSchema = z.object({
  to: z.string().min(10),
  fromNumberId: z.string().optional(),
  outboundInstruction: z.string().min(1),
  leadId: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export const VoiceRuleConfigSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  enabled: z.boolean(),
  minQualificationScore: z.number().min(0).max(100),
  maxRetries: z.number().min(0).max(10),
  retryDelayMinutes: z.number().min(1).max(1440),
  smsFallbackEnabled: z.boolean(),
  smsFallbackTemplate: z.string().optional(),
  outboundInstruction: z.string().min(1),
  priority: z.number().min(0),
});
