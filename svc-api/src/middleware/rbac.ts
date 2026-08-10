import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export type UserRole = 'ADMIN' | 'MANAGER' | 'AGENT';

const ROLE_RANK: Record<UserRole, number> = {
  ADMIN: 3,
  MANAGER: 2,
  AGENT: 1,
};

function normalizeRole(role: string | undefined): UserRole | null {
  if (!role) return null;
  const upper = role.toUpperCase() as UserRole;
  return upper in ROLE_RANK ? upper : null;
}

/** True when the user is ADMIN or MANAGER (sees all leads / full dashboard). */
export function isElevatedRole(role: string | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'ADMIN' || normalized === 'MANAGER';
}

/**
 * Require the caller to have one of the listed roles.
 * Must run after authMiddleware.
 */
export function requireRole(...allowed: UserRole[]) {
  const allowedSet = new Set(allowed.map((r) => r.toUpperCase()));

  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = normalizeRole(req.user?.role);
    if (!role || !allowedSet.has(role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Requires one of roles: ${allowed.join(', ')}`,
      });
    }
    next();
  };
}

/** Require at least the given minimum role (ADMIN > MANAGER > AGENT). */
export function requireMinRole(minRole: UserRole) {
  const minRank = ROLE_RANK[minRole];

  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = normalizeRole(req.user?.role);
    if (!role || ROLE_RANK[role] < minRank) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Requires ${minRole} role or higher`,
      });
    }
    next();
  };
}
