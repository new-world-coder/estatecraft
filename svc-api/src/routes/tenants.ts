import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/rbac';
import { getPrisma } from '../services/prisma-store';
import { logger } from '../utils/logger';
import { config } from '../config';
import { DATA_REGIONS, PLAN_DEFAULTS, tenantHostname, type DataRegionCode } from '../tenant/plans';
import { getTenantContext } from '../tenant/context';

const router = Router();

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;

function requirePlatformKey(req: AuthRequest, res: import('express').Response, next: import('express').NextFunction) {
  const key = req.headers['x-platform-admin-key'];
  if (!config.platformAdminKey) {
    return res.status(503).json({
      error: 'Not Configured',
      message: 'PLATFORM_ADMIN_KEY is not set',
    });
  }
  if (key !== config.platformAdminKey) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid platform admin key' });
  }
  next();
}

/** Public: resolve tenant by slug (for login page branding). */
router.get('/by-slug/:slug', async (req, res) => {
  try {
    const db = getPrisma();
    const tenant = await db.tenant.findUnique({
      where: { slug: String(req.params.slug).toLowerCase() },
      include: { plan: true },
    });
    if (!tenant || tenant.status === 'OFFBOARDING') {
      return res.status(404).json({ error: 'Not Found', message: 'Tenant not found' });
    }
    res.json({
      success: true,
      data: {
        slug: tenant.slug,
        name: tenant.name,
        region: tenant.region,
        status: tenant.status,
        plan: tenant.plan.code,
        ssoRequired: tenant.ssoRequired,
        ssoEnabled: tenant.ssoEnabled,
        hostname: tenantHostname(tenant.slug, config.saasBaseDomain),
        dialBringYourOwn: true,
      },
    });
  } catch (error) {
    logger.error('Tenant lookup error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to lookup tenant' });
  }
});

/** List plans (public catalog). */
router.get('/plans', async (_req, res) => {
  try {
    const db = getPrisma();
    const plans = await db.plan.findMany({ orderBy: { priceMonthlyUsd: 'asc' } });
    res.json({ success: true, data: plans.length ? plans : Object.values(PLAN_DEFAULTS) });
  } catch (error) {
    logger.error('List plans error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list plans' });
  }
});

/** Current tenant profile (authenticated + tenant context). */
router.get('/current', authMiddleware, tenantMiddleware, async (req: AuthRequest, res) => {
  try {
    const ctx = getTenantContext();
    const db = getPrisma();
    const tenant = await db.tenant.findUnique({
      where: { id: ctx?.tenantId || req.user?.tenantId },
      include: { plan: true },
    });
    if (!tenant) {
      return res.status(404).json({ error: 'Not Found', message: 'Tenant not found' });
    }

    const integrations = (tenant.integrations || {}) as Record<string, unknown>;
    const dial = (integrations.dial || {}) as Record<string, unknown>;

    res.json({
      success: true,
      data: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        region: tenant.region,
        status: tenant.status,
        plan: tenant.plan,
        settings: tenant.settings,
        ssoRequired: tenant.ssoRequired,
        ssoEnabled: tenant.ssoEnabled,
        hostname: tenantHostname(tenant.slug, config.saasBaseDomain),
        dial: {
          bringYourOwn: true,
          configured: Boolean(dial.apiKey),
          fromNumberId: dial.fromNumberId || null,
        },
      },
    });
  } catch (error) {
    logger.error('Current tenant error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to load tenant' });
  }
});

/**
 * Provision a new tenant + owner (platform ops).
 * Requires header: X-Platform-Admin-Key
 */
router.post('/', requirePlatformKey, async (req: AuthRequest, res) => {
  try {
    const {
      slug,
      name,
      region = 'US',
      planCode = 'STARTER',
      owner,
      integrations,
      oidc,
    } = req.body as {
      slug: string;
      name: string;
      region?: DataRegionCode;
      planCode?: 'STARTER' | 'PRO' | 'ENTERPRISE';
      owner: { email: string; password?: string; firstName: string; lastName: string };
      integrations?: { dial?: { apiKey?: string; baseUrl?: string; fromNumberId?: string } };
      oidc?: { issuer?: string; clientId?: string; clientSecret?: string };
    };

    if (!slug || !name || !owner?.email || !owner?.firstName || !owner?.lastName) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'slug, name, and owner { email, firstName, lastName } are required',
      });
    }

    const normalizedSlug = String(slug).toLowerCase().trim();
    if (!SLUG_RE.test(normalizedSlug)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'slug must be 3–63 chars, lowercase alphanumeric and hyphens',
      });
    }

    if (!DATA_REGIONS.includes(region)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `region must be one of: ${DATA_REGIONS.join(', ')}`,
      });
    }

    const planDefaults = PLAN_DEFAULTS[planCode];
    if (!planDefaults) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid planCode' });
    }

    const db = getPrisma();
    const plan = await db.plan.findUnique({ where: { code: planCode } });
    if (!plan) {
      return res.status(500).json({ error: 'Internal Server Error', message: 'Plans not seeded' });
    }

    const ssoRequired = Boolean(planDefaults.features.ssoRequired);
    const ssoEnabled = Boolean(planDefaults.features.ssoEnabled);

    if (!ssoRequired && !owner.password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'owner.password is required for Starter (password auth) tenants',
      });
    }

    const existing = await db.tenant.findUnique({ where: { slug: normalizedSlug } });
    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'Tenant slug already exists' });
    }

    const passwordHash = owner.password ? await bcrypt.hash(owner.password, 12) : null;
    const email = owner.email.toLowerCase();

    const result = await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug: normalizedSlug,
          name,
          region,
          status: 'ACTIVE',
          planId: plan.id,
          settings: {
            timezone: region === 'EU' ? 'Europe/Berlin' : region === 'UAE' ? 'Asia/Dubai' : 'America/New_York',
          },
          integrations: {
            dial: {
              bringYourOwn: true,
              ...(integrations?.dial || {}),
            },
          },
          ssoRequired,
          ssoEnabled,
          oidcIssuer: oidc?.issuer,
          oidcClientId: oidc?.clientId,
          oidcClientSecret: oidc?.clientSecret,
        },
      });

      let user = await tx.user.findUnique({ where: { email } });
      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            password: passwordHash,
            firstName: owner.firstName,
            lastName: owner.lastName,
            role: 'ADMIN',
            tenantId: tenant.id,
          },
        });
      }

      await tx.tenantMembership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: 'ADMIN',
        },
      });

      return { tenant, user };
    });

    logger.info('Tenant provisioned', {
      slug: result.tenant.slug,
      region: result.tenant.region,
      plan: planCode,
    });

    res.status(201).json({
      success: true,
      data: {
        tenant: {
          id: result.tenant.id,
          slug: result.tenant.slug,
          name: result.tenant.name,
          region: result.tenant.region,
          plan: planCode,
          hostname: tenantHostname(result.tenant.slug, config.saasBaseDomain),
          ssoRequired: result.tenant.ssoRequired,
        },
        owner: {
          id: result.user.id,
          email: result.user.email,
        },
      },
    });
  } catch (error) {
    logger.error('Provision tenant error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to provision tenant',
    });
  }
});

/** Update BYO Dial integration for current tenant (admin). */
router.put(
  '/current/integrations/dial',
  authMiddleware,
  tenantMiddleware,
  requireRole('ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) {
        return res.status(400).json({ error: 'Bad Request', message: 'Tenant context required' });
      }

      const { apiKey, baseUrl, fromNumberId } = req.body as {
        apiKey?: string;
        baseUrl?: string;
        fromNumberId?: string;
      };

      if (!apiKey) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'apiKey is required (bring-your-own Dial)',
        });
      }

      const db = getPrisma();
      const tenant = await db.tenant.findUnique({ where: { id: ctx.tenantId } });
      if (!tenant) {
        return res.status(404).json({ error: 'Not Found', message: 'Tenant not found' });
      }

      const integrations = {
        ...((tenant.integrations as object) || {}),
        dial: {
          bringYourOwn: true,
          apiKey,
          baseUrl: baseUrl || 'https://api.getdial.ai',
          fromNumberId: fromNumberId || null,
        },
      };

      const updated = await db.tenant.update({
        where: { id: tenant.id },
        data: { integrations },
      });

      res.json({
        success: true,
        data: {
          configured: true,
          fromNumberId: (updated.integrations as { dial?: { fromNumberId?: string } })?.dial?.fromNumberId ?? null,
        },
      });
    } catch (error) {
      logger.error('Update Dial integration error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update Dial config' });
    }
  }
);

export { router as tenantRoutes };
