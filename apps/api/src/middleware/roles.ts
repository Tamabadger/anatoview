import { Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AuthenticatedRequest } from '../types';

/**
 * Express middleware factory that restricts access to specific roles.
 *
 * Must be used AFTER the `authenticate` middleware so `req.user` is populated.
 *
 * Usage:
 *   router.post('/labs', authenticate, requireRole('instructor', 'admin'), createLab);
 *   router.get('/grades', authenticate, requireRole('instructor', 'ta', 'admin'), getGrades);
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required before role check.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}. Your role: ${req.user.role}`,
      });
      return;
    }

    next();
  };
}

// ─── Convenience guards ───────────────────────────────────────

/** Only instructors and admins */
export const instructorOnly = requireRole('instructor', 'admin');

/** Instructors, TAs, and admins */
export const staffOnly = requireRole('instructor', 'ta', 'admin');

/** Any authenticated user (all roles) */
export const anyRole = requireRole('instructor', 'ta', 'student', 'admin');
