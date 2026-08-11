/** Market-norm plan assumptions for EstateCraft SaaS (USD, list price). */
export const PLAN_DEFAULTS = {
  STARTER: {
    code: 'STARTER' as const,
    name: 'Starter',
    priceMonthlyUsd: 79,
    maxAgents: 10,
    maxLeads: 5000,
    maxCallsPerMonth: 500,
    features: {
      ssoEnabled: false,
      ssoRequired: false,
      customDomain: false,
      dedicatedDb: false,
      apiAccess: true,
      regions: ['US', 'EU', 'UAE'],
      dialBringYourOwn: true,
    },
  },
  PRO: {
    code: 'PRO' as const,
    name: 'Pro',
    priceMonthlyUsd: 249,
    maxAgents: 50,
    maxLeads: 50000,
    maxCallsPerMonth: 5000,
    features: {
      ssoEnabled: true,
      ssoRequired: true,
      customDomain: false,
      dedicatedDb: false,
      apiAccess: true,
      regions: ['US', 'EU', 'UAE'],
      dialBringYourOwn: true,
    },
  },
  ENTERPRISE: {
    code: 'ENTERPRISE' as const,
    name: 'Enterprise',
    priceMonthlyUsd: null as number | null,
    maxAgents: null as number | null,
    maxLeads: null as number | null,
    maxCallsPerMonth: null as number | null,
    features: {
      ssoEnabled: true,
      ssoRequired: true,
      customDomain: true,
      dedicatedDb: true,
      apiAccess: true,
      regions: ['US', 'EU', 'UAE'],
      dialBringYourOwn: true,
      sla: true,
    },
  },
};

export const SAAS_BASE_DOMAIN = 'estatecraft.io';

export const DATA_REGIONS = ['US', 'EU', 'UAE'] as const;
export type DataRegionCode = (typeof DATA_REGIONS)[number];

export function tenantHostname(slug: string, baseDomain = SAAS_BASE_DOMAIN): string {
  return `${slug}.${baseDomain}`;
}
