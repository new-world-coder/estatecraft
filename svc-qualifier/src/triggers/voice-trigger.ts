import { LeadScorer, ScoringResult } from '../scoring/lead-scorer';
import { createLeadScoreTriggeredEvent, createLeadQualifiedEvent } from '@estatecraft/shared';
import { logger } from '../utils/logger';

export interface QualifiableLead {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email: string;
  source: string;
  priority: string;
  priceMax?: number | null;
  qualificationScore: number;
  status: string;
}

export interface VoiceRuleMatch {
  id: string;
  name: string;
  enabled: boolean;
  minQualificationScore: number;
  maxRetries: number;
  retryDelayMinutes: number;
  smsFallbackEnabled: boolean;
  smsFallbackTemplate?: string | null;
  outboundInstruction: string;
  priority: number;
}

export interface QualificationStore {
  updateLeadScore(
    leadId: string,
    score: number,
    aiConfidence: number,
    factors: ScoringResult['factors'],
    status?: string
  ): Promise<void>;
  recordScoreHistory(
    leadId: string,
    score: number,
    factors: ScoringResult['factors'],
    trigger?: string
  ): Promise<void>;
  getActiveVoiceRules(): Promise<VoiceRuleMatch[]>;
}

export type QualificationEventPublisher = (event: unknown) => void | Promise<void>;
export type VoiceTriggerHandler = (
  lead: QualifiableLead,
  rule: VoiceRuleMatch
) => Promise<void>;

export class QualificationEngine {
  private readonly scorer: LeadScorer;

  constructor(
    private readonly store: QualificationStore,
    private readonly eventPublisher?: QualificationEventPublisher,
    private readonly voiceTrigger?: VoiceTriggerHandler,
    voiceThreshold = 70
  ) {
    this.scorer = new LeadScorer(voiceThreshold);
  }

  async qualifyLead(lead: QualifiableLead): Promise<ScoringResult> {
    const result = this.scorer.score({
      priceMax: lead.priceMax,
      source: lead.source,
      hasPhone: !!lead.phone,
      priority: lead.priority,
    });

    const previousScore = lead.qualificationScore;
    const newStatus =
      result.score >= 70 ? 'QUALIFIED' : lead.status === 'NEW' ? 'NEW' : lead.status;

    await this.store.updateLeadScore(
      lead.id,
      result.score,
      result.aiConfidence,
      result.factors,
      newStatus
    );
    await this.store.recordScoreHistory(lead.id, result.score, result.factors, 'qualification_run');

    const qualifiedEvent = createLeadQualifiedEvent({
      leadId: lead.id,
      qualificationScore: result.score,
      aiConfidence: result.aiConfidence,
      factors: result.factors,
      nextStage: newStatus.toLowerCase() as any,
    });
    await this.eventPublisher?.(qualifiedEvent);

    const rules = await this.store.getActiveVoiceRules();
    const matchingRule = rules
      .filter((r) => r.enabled && result.score >= r.minQualificationScore)
      .sort((a, b) => b.priority - a.priority)[0];

    const triggeredAction = matchingRule && lead.phone ? 'voice_call' : 'none';

    await this.eventPublisher?.(
      createLeadScoreTriggeredEvent({
        leadId: lead.id,
        score: result.score,
        previousScore,
        triggeredAction,
        ruleId: matchingRule?.id,
      })
    );

    if (matchingRule && lead.phone && this.voiceTrigger) {
      logger.info('Voice trigger activated', {
        leadId: lead.id,
        score: result.score,
        ruleId: matchingRule.id,
      });
      await this.voiceTrigger(lead, matchingRule);
    }

    return result;
  }

  async qualifyBatch(leads: QualifiableLead[]): Promise<ScoringResult[]> {
    const results: ScoringResult[] = [];
    for (const lead of leads) {
      results.push(await this.qualifyLead(lead));
    }
    return results;
  }
}
