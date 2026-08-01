import {
  CommunicationOrchestrator,
  CommunicationStore,
  LeadContact,
} from './orchestrator/communication-orchestrator';
import { createVoiceProvider } from './providers/provider-factory';
import { logger } from './utils/logger';

let orchestratorInstance: CommunicationOrchestrator | null = null;

export function getOrchestrator(store: CommunicationStore): CommunicationOrchestrator {
  if (!orchestratorInstance) {
    const provider = createVoiceProvider();
    orchestratorInstance = new CommunicationOrchestrator(provider, store, async (event) => {
      logger.debug('Communication event published', { type: (event as { type: string }).type });
    });
    logger.info('Communication orchestrator initialized', { provider: provider.name });
  }
  return orchestratorInstance;
}

export async function triggerVoiceForLead(
  store: CommunicationStore,
  lead: LeadContact,
  rule: {
    outboundInstruction: string;
    maxRetries: number;
    retryDelayMinutes: number;
    smsFallbackEnabled: boolean;
    smsFallbackTemplate?: string | null;
    id: string;
    name: string;
    enabled: boolean;
    minQualificationScore: number;
    priority: number;
  }
): Promise<void> {
  const orchestrator = getOrchestrator(store);
  await orchestrator.triggerOutboundCall(lead, {
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
  });
}
