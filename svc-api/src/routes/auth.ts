import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { logger } from '../utils/logger';
import { getPrisma } from '../services/prisma-store';
import { SAAS_BASE_DOMAIN, tenantHostname } from '../tenant/plans';

const router = Router();

function resolveSlug(req: { body?: { tenantSlug?: string }; headers: Record<string, unknown> }): string | null {
  if (req.body?.tenantSlug) return String(req.body.tenantSlug).toLowerCase().trim();
  const header = req.headers['x-tenant-slug'];
  if (typeof header === 'string' && header.trim()) return header.toLowerCase().trim();
  const host = typeof req.headers.host === 'string' ? req.headers.host.split(':')[0].toLowerCase() : '';
  const match = host.match(/^([a-z0-9-]+)\.(estatecraft\.io|localhost)$/);
  if (match && !['www', 'api', 'app'].includes(match[1])) return match[1];
  return null;
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const tenantSlug = resolveSlug(req);

    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required',
      });
    }

    if (!tenantSlug) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'tenantSlug is required (or use {slug}.estatecraft.io / X-Tenant-Slug)',
      });
    }

    const db = getPrisma();
    const tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
      include: { plan: true },
    });

    if (!tenant || tenant.status !== 'ACTIVE') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    // Pro / Enterprise: SSO required at launch for SME+
    if (tenant.ssoRequired && !config.tenantSsoPasswordBypass) {
      return res.status(403).json({
        error: 'SSO Required',
        message: 'This workspace requires SSO. Use /api/auth/sso/start.',
        data: {
          tenantSlug: tenant.slug,
          ssoStart: `/api/auth/sso/start?tenantSlug=${tenant.slug}`,
          hostname: tenantHostname(tenant.slug),
        },
      });
    }

    const user = await db.user.findUnique({ where: { email: String(email).toLowerCase() } });
    if (!user || !user.password) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    const membership = await db.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    });

    if (!membership) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    const role = membership.role;
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
    );

    logger.info(`User logged in`, { email, tenantSlug: tenant.slug, region: tenant.region });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role,
        },
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          region: tenant.region,
          plan: tenant.plan.code,
          hostname: tenantHostname(tenant.slug),
          baseDomain: SAAS_BASE_DOMAIN,
          ssoRequired: tenant.ssoRequired,
          dialBringYourOwn: true,
        },
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Login failed',
    });
  }
});

/**
 * Start OIDC SSO for a tenant. Pro/Enterprise require SSO at launch.
 * Full IdP redirect is wired when oidcIssuer + oidcClientId are configured.
 */
router.get('/sso/start', async (req, res) => {
  try {
    const tenantSlug = String(req.query.tenantSlug || resolveSlug(req) || '').toLowerCase();
    if (!tenantSlug) {
      return res.status(400).json({ error: 'Bad Request', message: 'tenantSlug is required' });
    }

    const db = getPrisma();
    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug }, include: { plan: true } });
    if (!tenant || tenant.status !== 'ACTIVE') {
      return res.status(404).json({ error: 'Not Found', message: 'Tenant not found' });
    }

    if (!tenant.ssoEnabled && !tenant.ssoRequired) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'SSO is not enabled for this tenant. Use password login.',
      });
    }

    if (!tenant.oidcIssuer || !tenant.oidcClientId) {
      return res.status(501).json({
        error: 'SSO Not Configured',
        message:
          'SSO is required for this plan but OIDC is not fully configured yet. Contact support to complete IdP setup.',
        data: {
          tenantSlug: tenant.slug,
          plan: tenant.plan.code,
          region: tenant.region,
          hostname: tenantHostname(tenant.slug),
        },
      });
    }

    const redirectUri = `${config.publicApiUrl}/api/auth/sso/callback`;
    const authorizeUrl = new URL(`${tenant.oidcIssuer.replace(/\/$/, '')}/authorize`);
    authorizeUrl.searchParams.set('client_id', tenant.oidcClientId);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('scope', tenant.oidcScopes || 'openid profile email');
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('state', Buffer.from(JSON.stringify({ tenantSlug: tenant.slug })).toString('base64url'));

    res.json({
      success: true,
      data: {
        authorizeUrl: authorizeUrl.toString(),
        tenantSlug: tenant.slug,
      },
    });
  } catch (error) {
    logger.error('SSO start error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to start SSO' });
  }
});

router.get('/sso/callback', async (_req, res) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'OIDC callback exchange will be completed in the SSO hardening pass. Use Starter tenants for password login demos.',
  });
});

router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided',
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as {
        id: string;
        email: string;
        role: string;
        tenantId?: string;
        tenantSlug?: string;
      };

      const db = getPrisma();
      const user = await db.user.findUnique({ where: { id: decoded.id } });

      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid token',
        });
      }

      let tenant = null;
      if (decoded.tenantId) {
        tenant = await db.tenant.findUnique({
          where: { id: decoded.tenantId },
          include: { plan: true },
        });
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: decoded.role || user.role,
          tenant: tenant
            ? {
                id: tenant.id,
                slug: tenant.slug,
                name: tenant.name,
                region: tenant.region,
                plan: tenant.plan.code,
                hostname: tenantHostname(tenant.slug),
                ssoRequired: tenant.ssoRequired,
              }
            : null,
        },
      });
    } catch {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token',
      });
    }
  } catch (error) {
    logger.error('Get user profile error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user profile',
    });
  }
});

export { router as authRoutes };
