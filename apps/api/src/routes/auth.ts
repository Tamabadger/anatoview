import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { deleteRefreshToken, getRefreshToken, storeRefreshToken } from '../config/redis';
import { authenticate, signAccessToken, signRefreshToken, verifyToken } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();

/**
 * GET /api/auth/me
 * Returns the current authenticated user's profile.
 */
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        institution: {
          select: { id: true, name: true, canvasUrl: true },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Fetch the user's first course for this institution
    const course = await prisma.course.findFirst({
      where: { institutionId: user.institutionId },
      select: {
        id: true,
        name: true,
        canvasCourseId: true,
        institutionId: true,
        term: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      canvasUserId: user.canvasUserId,
      institutionId: user.institutionId,
      institution: user.institution,
      course: course || null,
      createdAt: user.createdAt,
    });
  } catch (error: any) {
    console.error('[Auth] /me error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout
 * Invalidates the user's refresh token in Redis.
 */
router.post('/logout', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await deleteRefreshToken(req.user!.userId);
    res.json({ message: 'Logged out successfully.' });
  } catch (error: any) {
    console.error('[Auth] Logout error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/refresh
 * Exchange a refresh token for a new access token.
 */
router.post('/refresh', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required.' });
      return;
    }

    // Verify the refresh token
    const payload = verifyToken(refreshToken);

    // Check it matches what's stored in Redis
    const storedToken = await getRefreshToken(payload.userId);
    if (!storedToken || storedToken !== refreshToken) {
      res.status(401).json({ error: 'Invalid or expired refresh token.' });
      return;
    }

    // Issue a new access token
    const newAccessToken = signAccessToken({
      userId: payload.userId,
      institutionId: payload.institutionId,
      role: payload.role,
      canvasUserId: payload.canvasUserId,
      email: payload.email,
      name: payload.name,
    });

    res.json({ accessToken: newAccessToken });
  } catch (error: any) {
    console.error('[Auth] Refresh error:', error.message);
    res.status(401).json({ error: 'Invalid or expired refresh token.' });
  }
});

/**
 * POST /api/auth/dev-login
 * Development-only endpoint that issues real JWTs for a seeded dev user.
 * Accepts { role: 'instructor' | 'student' } to select which dev user to log in as.
 * Disabled in production.
 */
if (process.env.NODE_ENV !== 'production') {
  router.post('/dev-login', async (req: Request, res: Response) => {
    try {
      const role = req.body.role || 'instructor';
      const userId = role === 'student' ? 'dev-student-001' : 'dev-instructor-001';

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          institution: { select: { id: true, name: true, canvasUrl: true } },
        },
      });

      if (!user) {
        res.status(404).json({
          error: 'Dev user not found. Run `make seed` first.',
        });
        return;
      }

      const tokenPayload = {
        userId: user.id,
        institutionId: user.institutionId,
        role: user.role,
        canvasUserId: user.canvasUserId,
        email: user.email ?? undefined,
        name: user.name,
      };

      const accessToken = signAccessToken(tokenPayload);
      const refreshToken = signRefreshToken(tokenPayload);

      await storeRefreshToken(user.id, refreshToken);

      res.json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          canvasUserId: user.canvasUserId,
          institutionId: user.institutionId,
          institution: user.institution,
        },
      });
    } catch (error: any) {
      console.error('[Auth] Dev login error:', error.message);
      res.status(500).json({ error: 'Dev login failed.' });
    }
  });
}

export default router;
