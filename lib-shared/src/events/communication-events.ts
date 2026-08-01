import { z } from 'zod';
import { CommunicationChannel, CommunicationStatus } from '../types/communication';

export interface CommunicationEventBase {
  id: string;
  type: string;
  timestamp: Date;
  version: string;
  correlationId?: string;
}

export interface VoiceCallInitiatedEvent extends CommunicationEventBase {
  type: 'VoiceCallInitiated';
  data: {
    leadId: string;
    communicationId: string;
    provider: string;
    externalCallId?: string;
    phone: string;
  };
}

export interface VoiceCallCompletedEvent extends CommunicationEventBase {
  type: 'VoiceCallCompleted';
  data: {
    leadId: string;
    communicationId: string;
    outcome: string;
    duration?: number;
    transcript?: string;
  };
}

export interface VoiceCallFailedEvent extends CommunicationEventBase {
  type: 'VoiceCallFailed';
  data: {
    leadId: string;
    communicationId: string;
    reason: string;
    retryCount: number;
    willRetry: boolean;
  };
}

export interface SmsFallbackTriggeredEvent extends CommunicationEventBase {
  type: 'SmsFallbackTriggered';
  data: {
    leadId: string;
    communicationId: string;
    parentCommunicationId: string;
    reason: string;
    messageBody: string;
  };
}

export interface LeadScoreTriggeredEvent extends CommunicationEventBase {
  type: 'LeadScoreTriggered';
  data: {
    leadId: string;
    score: number;
    previousScore: number;
    triggeredAction: 'voice_call' | 'sms' | 'none';
    ruleId?: string;
  };
}

export type CommunicationEvent =
  | VoiceCallInitiatedEvent
  | VoiceCallCompletedEvent
  | VoiceCallFailedEvent
  | SmsFallbackTriggeredEvent
  | LeadScoreTriggeredEvent;

export const createVoiceCallInitiatedEvent = (
  data: VoiceCallInitiatedEvent['data']
): VoiceCallInitiatedEvent => ({
  id: crypto.randomUUID(),
  type: 'VoiceCallInitiated',
  timestamp: new Date(),
  version: '1.0.0',
  data,
});

export const createVoiceCallCompletedEvent = (
  data: VoiceCallCompletedEvent['data']
): VoiceCallCompletedEvent => ({
  id: crypto.randomUUID(),
  type: 'VoiceCallCompleted',
  timestamp: new Date(),
  version: '1.0.0',
  data,
});

export const createVoiceCallFailedEvent = (
  data: VoiceCallFailedEvent['data']
): VoiceCallFailedEvent => ({
  id: crypto.randomUUID(),
  type: 'VoiceCallFailed',
  timestamp: new Date(),
  version: '1.0.0',
  data,
});

export const createSmsFallbackTriggeredEvent = (
  data: SmsFallbackTriggeredEvent['data']
): SmsFallbackTriggeredEvent => ({
  id: crypto.randomUUID(),
  type: 'SmsFallbackTriggered',
  timestamp: new Date(),
  version: '1.0.0',
  data,
});

export const createLeadScoreTriggeredEvent = (
  data: LeadScoreTriggeredEvent['data']
): LeadScoreTriggeredEvent => ({
  id: crypto.randomUUID(),
  type: 'LeadScoreTriggered',
  timestamp: new Date(),
  version: '1.0.0',
  data,
});
