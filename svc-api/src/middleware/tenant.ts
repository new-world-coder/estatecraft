import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { getPrisma } from '../services/prisma-store';
import { runWithTenant, TenantContext } from '../tenant/context';
import { logger } from '../utils/logger';

function slugFromHost(hostHeader: string | undefined): string | null {
  if (!hostHeader) return null;
  const host = hostHeader.split(':')[0].toLowerCase();
  // *.estatecraft.io or *.localhost for local subdomain testing
  const match = host.match(/^([a-z0-9-]+)\.(estatecraft\.io|localhost)$/);
  if (!match) return null;
  const slug = match[1];
  if (slug === 'www' || slug === 'api' || slug === 'app') return null;
  return slug;
}

/**
 * After authMiddleware: bind tenant from JWT (preferred) or Host subdomain.
 * Sets AsyncLocalStorage tenant context for Prisma middleware + RLS session var.
 */
export async function tenantMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const db = getPrisma();
    let tenantId = req.user?.tenantId;
    let tenantSlug = req.user?.tenantSlug;

    if (!tenantId) {
      const headerSlug =
        (req.headers['x-tenant-slug'] as string | undefined)?.toLowerCase() ||
        slugFromHost(req.headers.host);
      if (headerSlug) {
        const tenant = await db.tenant.findUnique({ where: { slug: headerSlug } });
        if (tenant) {
          tenantId = tenant.id;
          tenantSlug = tenant.slug;
        }
      }
    }

    if (!tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tenant context required (JWT tenant claim, subdomain, or X-Tenant-Slug)',
      });
    }

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    });

    if (!tenant || tenant.status !== 'ACTIVE') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Tenant is not active',
      });
    }

    if (req.user?.tenantId && req.user.tenantId !== tenant.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Token tenant does not match request tenant',
      });
    }

    const ctx: TenantContext = {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      region: tenant.region,
      planCode: tenant.plan.code,
      ssoRequired: tenant.ssoRequired,
    };

    // Postgres RLS session variable (no-op if DB role bypasses RLS)
    try {
      await db.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, tenant.id);
    } catch (err) {
      logger.debug('Could not set app.tenant_id session var', { err });
    }

    runWithTenant(ctx, () => next());
  } catch (error) {
    logger.error('Tenant middleware error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to resolve tenant',
    });
  }
}

/** Optional helper for routes that only need Express locals */
export function getRequestTenant(req: Request): TenantContext | undefined {
  return (req as AuthRequest).user
    ? {
        tenantId: (req as AuthRequest).user!.tenantId!,
        tenantSlug: (req as AuthRequest).user!.tenantSlug || '',
        region: 'US',
        planCode: 'STARTER',
        ssoRequired: false,
      }
    : undefined;
}
