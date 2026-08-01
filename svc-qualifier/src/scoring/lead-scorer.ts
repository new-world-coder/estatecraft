import { LeadQualification } from '@estatecraft/shared';

export interface LeadScoringInput {
  budget?: number;
  priceMax?: number | null;
  timeline?: number;
  motivation?: number;
  authority?: number;
  need?: number;
  source?: string;
  hasPhone?: boolean;
  priority?: string;
}

export interface ScoringResult {
  score: number;
  factors: LeadQualification['factors'];
  aiConfidence: number;
  shouldTriggerVoice: boolean;
}

const SOURCE_BONUS: Record<string, number> = {
  REFERRAL: 2,
  WEBSITE: 1,
  PARTNER: 1,
  TRADE_SHOW: 1,
  SOCIAL_MEDIA: 0,
  EMAIL_CAMPAIGN: 0,
  COLD_CALL: -1,
  OTHER: 0,
};

export class LeadScorer {
  constructor(private readonly voiceThreshold = 70) {}

  score(input: LeadScoringInput): ScoringResult {
    const budget = this.scoreBudget(input.budget, input.priceMax);
    const timeline = input.timeline ?? this.estimateTimeline(input);
    const motivation = input.motivation ?? 6;
    const authority = input.authority ?? 5;
    const need = input.need ?? 6;

    const sourceBonus = SOURCE_BONUS[input.source || 'OTHER'] ?? 0;
    const phoneBonus = input.hasPhone ? 1 : 0;
    const priorityBonus =
      input.priority === 'URGENT' ? 2 : input.priority === 'HIGH' ? 1 : 0;

    const rawFactors = {
      budget: Math.min(10, Math.max(0, budget)),
      timeline: Math.min(10, Math.max(0, timeline)),
      motivation: Math.min(10, Math.max(0, motivation)),
      authority: Math.min(10, Math.max(0, authority)),
      need: Math.min(10, Math.max(0, need)),
    };

    const factorSum =
      rawFactors.budget +
      rawFactors.timeline +
      rawFactors.motivation +
      rawFactors.authority +
      rawFactors.need;
    const baseScore = Math.round((factorSum / 50) * 100);
    const adjustments = sourceBonus + phoneBonus + priorityBonus;
    const score = Math.min(100, Math.max(0, baseScore + adjustments * 3));

    const aiConfidence = Math.min(
      0.99,
      0.6 + (factorSum / 50) * 0.3 + (input.hasPhone ? 0.05 : 0)
    );

    return {
      score,
      factors: rawFactors,
      aiConfidence: Math.round(aiConfidence * 100) / 100,
      shouldTriggerVoice: score >= this.voiceThreshold && input.hasPhone === true,
    };
  }

  private scoreBudget(budget?: number, priceMax?: number | null): number {
    if (budget !== undefined) return Math.min(10, Math.round(budget));
    if (priceMax) {
      if (priceMax >= 1000000) return 9;
      if (priceMax >= 500000) return 7;
      if (priceMax >= 250000) return 5;
      return 3;
    }
    return 5;
  }

  private estimateTimeline(input: LeadScoringInput): number {
    if (input.priority === 'URGENT') return 9;
    if (input.priority === 'HIGH') return 7;
    return 5;
  }
}
