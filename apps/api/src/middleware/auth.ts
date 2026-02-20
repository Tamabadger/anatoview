import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, JwtPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';

/**
 * Express middleware that verifies the JWT from the Authorization header.
 *
 * Expected header format: Authorization: Bearer <token>
 *
 * On success, attaches the decoded payload to `req.user`.
 * On failure, returns 401 Unauthorized.
 */
export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header. Expected: Bearer <token>',
    });
    return;
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Token has expired. Please re-launch from Canvas.',
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token.',
      });
      return;
    }

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed.',
    });
  }
}

// ─── Token Helpers ─────────────────────────────────────────────

/**
 * Sign a short-lived access token (1 hour).
 */
export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Sign a longer-lived refresh token (7 days).
 */
export function signRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Verify and decode a token (used for refresh flow).
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
