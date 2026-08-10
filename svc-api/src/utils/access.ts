import { AuthRequest } from '../middleware/auth';
import { isElevatedRole } from '../middleware/rbac';

/** Prisma where clause: agents only see leads assigned to them. */
export function leadAccessWhere(req: AuthRequest): { assignedTo?: string } {
  if (isElevatedRole(req.user?.role)) {
    return {};
  }
  return { assignedTo: req.user!.id };
}

/** Returns false when an AGENT tries to access a lead they do not own. */
export function canAccessLead(
  req: AuthRequest,
  lead: { assignedTo: string | null }
): boolean {
  if (isElevatedRole(req.user?.role)) {
    return true;
  }
  return lead.assignedTo === req.user?.id;
}
