import { Request } from 'express';
import { UserRole } from '@prisma/client';

/**
 * JWT payload issued by AnatoView after LTI launch
 */
export interface JwtPayload {
  userId: string;
  institutionId: string;
  role: UserRole;
  canvasUserId: string;
  email?: string;
  name: string;
  iat?: number;
  exp?: number;
}

/**
 * Extended Express Request with authenticated user info
 */
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/**
 * LTI 1.3 token context extracted from ltijs
 */
export interface LtiContext {
  userId: string;
  name: string;
  email?: string;
  courseId?: string;
  courseName?: string;
  roles: string[];
  labId?: string;
  lineItemUrl?: string;
  institutionUrl: string;
}

/**
 * Grade passback result from Canvas AGS
 */
export interface GradePassbackResult {
  success: boolean;
  status: number;
  attemptId: string;
  message?: string;
}
