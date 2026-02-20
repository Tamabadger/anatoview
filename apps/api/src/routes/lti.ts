import { prisma } from '../config/database';
import { storeRefreshToken } from '../config/redis';
import { signAccessToken, signRefreshToken } from '../middleware/auth';
import { lti, isLtiInitialized } from '../config/lti';
import { UserRole } from '@prisma/client';
import { LtiContext } from '../types';

/**
 * Register the LTI onConnect handler.
 *
 * Called after ltijs validates the LTI 1.3 launch JWT from Canvas.
 * This is where we:
 *   1. Extract user/course/role from the LTI token claims
 *   2. Upsert the institution, user, and course in our PostgreSQL database
 *   3. Issue our own JWT access token + refresh token
 *   4. Redirect the user to the appropriate frontend page
 */
export function registerLtiHandlers(): void {
  if (!isLtiInitialized()) {
    console.warn('[LTI] Skipping handler registration — LTI not initialized.');
    console.warn('[LTI] The API will work for non-LTI routes. Set CANVAS_BASE_URL and LTI_CLIENT_ID to enable LTI.');
    return;
  }

  // ─── Main Launch Handler ─────────────────────────────────────
  lti.onConnect(async (token: any, req: any, res: any) => {
    try {
      const context = extractLtiContext(token);
      console.log(`[LTI] Launch from ${context.name} (${context.roles.join(', ')})`);

      // Determine AnatoView role from Canvas LTI roles
      const role = mapCanvasRole(context.roles);

      // Upsert institution
      const institution = await prisma.institution.upsert({
        where: { canvasUrl: context.institutionUrl },
        update: {},
        create: {
          name: extractInstitutionName(context.institutionUrl),
          canvasUrl: context.institutionUrl,
          ltiClientId: process.env.LTI_CLIENT_ID || 'unknown',
        },
      });

      // Upsert user
      const user = await prisma.user.upsert({
        where: {
          institutionId_canvasUserId: {
            institutionId: institution.id,
            canvasUserId: context.userId,
          },
        },
        update: {
          name: context.name,
          email: context.email,
          role: role,
        },
        create: {
          institutionId: institution.id,
          canvasUserId: context.userId,
          name: context.name,
          email: context.email,
          role: role,
        },
      });

      // Upsert course (if course context is present)
      let courseRecord: { id: string; name: string; canvasCourseId: string; institutionId: string; term: string | null } | null = null;
      if (context.courseId) {
        courseRecord = await prisma.course.upsert({
          where: {
            institutionId_canvasCourseId: {
              institutionId: institution.id,
              canvasCourseId: context.courseId,
            },
          },
          update: {
            name: context.courseName || 'Unknown Course',
          },
          create: {
            institutionId: institution.id,
            canvasCourseId: context.courseId,
            name: context.courseName || 'Unknown Course',
            instructorId: role === 'instructor' ? user.id : undefined,
          },
          select: {
            id: true,
            name: true,
            canvasCourseId: true,
            institutionId: true,
            term: true,
          },
        });
      }

      // Issue AnatoView tokens
      const tokenPayload = {
        userId: user.id,
        institutionId: institution.id,
        role: user.role,
        canvasUserId: user.canvasUserId,
        email: user.email || undefined,
        name: user.name,
      };

      const accessToken = signAccessToken(tokenPayload);
      const refreshToken = signRefreshToken(tokenPayload);

      // Store refresh token in Redis (7-day TTL)
      await storeRefreshToken(user.id, refreshToken);

      console.log(`[LTI] Issued tokens for ${user.name} (${user.role})`);

      // Build redirect URL based on role
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost';
      let redirectPath: string;

      if (role === 'instructor' || role === 'admin' || role === 'ta') {
        redirectPath = '/dashboard';
      } else if (context.labId) {
        redirectPath = `/lab/${context.labId}`;
      } else {
        redirectPath = '/dashboard';
      }

      // Redirect to frontend with tokens + course context as URL hash params
      // The frontend reads these from the hash and stores in memory only
      const hashParams = new URLSearchParams({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (courseRecord) {
        hashParams.set('course_id', courseRecord.id);
        hashParams.set('course_name', courseRecord.name);
        hashParams.set('canvas_course_id', courseRecord.canvasCourseId);
        hashParams.set('institution_id', courseRecord.institutionId);
        if (courseRecord.term) hashParams.set('course_term', courseRecord.term);
      }

      const redirectUrl = `${frontendUrl}${redirectPath}#${hashParams.toString()}`;

      return res.redirect(redirectUrl);
    } catch (error: any) {
      console.error('[LTI] Launch error:', error.message);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost';
      return res.redirect(`${frontendUrl}/unauthorized?error=${encodeURIComponent(error.message)}`);
    }
  });

  // ─── Deep Linking Handler ─────────────────────────────────────
  lti.onDeepLinking(async (token: any, req: any, res: any) => {
    try {
      console.log('[LTI] Deep Linking request');
      // Deep linking allows instructors to select which lab to embed in Canvas
      // Full implementation in Prompt 4 when lab creation is built
      // For now, return the deep linking response form
      return lti.redirect(res, '/deep-link-picker', { newResource: true });
    } catch (error: any) {
      console.error('[LTI] Deep Linking error:', error.message);
      return res.status(500).json({ error: 'Deep Linking failed' });
    }
  });

  console.log('[LTI] Handlers registered (onConnect, onDeepLinking)');
}

// ─── Helper Functions ──────────────────────────────────────────

/**
 * Extract structured context from the raw ltijs token object.
 * Maps the LTI 1.3 claim structure to our LtiContext type.
 */
function extractLtiContext(token: any): LtiContext {
  const platformContext = token.platformContext || {};
  const context = platformContext.context || {};
  const custom = platformContext.custom || {};

  // AGS (Assignment and Grade Services) claim
  const agsEndpoint = platformContext['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'] || {};

  return {
    userId: token.user || '',
    name: token.userInfo?.name || 'Unknown User',
    email: token.userInfo?.email || undefined,
    courseId: context.id || undefined,
    courseName: context.title || undefined,
    roles: platformContext.roles || [],
    labId: custom.lab_id || undefined,
    lineItemUrl: agsEndpoint.lineitem || undefined,
    institutionUrl: process.env.CANVAS_BASE_URL || 'https://canvas.instructure.com',
  };
}

/**
 * Map Canvas LTI role URIs to AnatoView UserRole.
 *
 * Canvas roles follow the IMS Global LTI role URIs:
 *   http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor
 *   http://purl.imsglobal.org/vocab/lis/v2/membership#Learner
 *   http://purl.imsglobal.org/vocab/lis/v2/membership#ContentDeveloper
 *   http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator
 */
function mapCanvasRole(roles: string[]): UserRole {
  const roleString = roles.join(' ').toLowerCase();

  if (roleString.includes('administrator') || roleString.includes('sysadmin')) {
    return 'admin';
  }
  if (roleString.includes('instructor') || roleString.includes('contentdeveloper')) {
    return 'instructor';
  }
  if (roleString.includes('teachingassistant') || roleString.includes('ta')) {
    return 'ta';
  }
  // Default to student for Learner or any unrecognized role
  return 'student';
}

/**
 * Extract a human-readable institution name from the Canvas URL.
 * e.g., "https://my-university.instructure.com" → "my-university"
 */
function extractInstitutionName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // "my-university.instructure.com" → "my-university"
    const parts = hostname.split('.');
    if (parts.length >= 2 && parts[parts.length - 2] === 'instructure') {
      return parts.slice(0, -2).join('.');
    }
    return hostname;
  } catch {
    return 'Unknown Institution';
  }
}
