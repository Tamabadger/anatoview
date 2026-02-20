import jwt from 'jsonwebtoken';
import { Page } from '@playwright/test';

/**
 * JWT secret must match the API's JWT_SECRET in docker-compose.test.yml
 */
const JWT_SECRET = 'test_jwt_secret_for_e2e';

/**
 * JWT payload shape — mirrors apps/api/src/types/index.ts JwtPayload
 */
export interface TestJwtPayload {
  userId: string;
  institutionId: string;
  role: 'instructor' | 'student' | 'ta' | 'admin';
  canvasUserId: string;
  email?: string;
  name: string;
}

/**
 * Sign a test JWT that the API will accept.
 * @param expiresInSeconds — token lifetime in seconds (default: 7200 = 2 hours)
 */
export function signTestToken(payload: TestJwtPayload, expiresInSeconds = 7200): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresInSeconds });
}

// ─── Pre-built test user payloads ───────────────────────────────

export const INSTRUCTOR_USER: TestJwtPayload = {
  userId: 'e2e-instructor-001',
  institutionId: 'e2e-institution-001',
  role: 'instructor',
  canvasUserId: 'canvas-instructor-001',
  email: 'dr.smith@vetuniversity.edu',
  name: 'Dr. Sarah Smith',
};

export const STUDENT_USER: TestJwtPayload = {
  userId: 'e2e-student-001',
  institutionId: 'e2e-institution-001',
  role: 'student',
  canvasUserId: 'canvas-student-001',
  email: 'alex.johnson@vetuniversity.edu',
  name: 'Alex Johnson',
};

/**
 * Inject an authentication token into the browser so the React app
 * picks it up. The frontend reads tokens from the URL hash fragment
 * (simulating the LTI launch redirect).
 *
 * Usage:
 *   await injectAuth(page, INSTRUCTOR_USER);
 *   await page.goto('/dashboard');
 */
export async function injectAuth(page: Page, user: TestJwtPayload): Promise<string> {
  const accessToken = signTestToken(user);
  const refreshToken = signTestToken(user, 604800);

  // The frontend client.ts reads tokens set via setTokens().
  // We inject them via page.evaluate after navigating to the app origin.
  // First navigate to a blank page on the same origin to set up the context.
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Inject tokens into the app's in-memory token storage
  // and set up the Zustand store with the user identity
  await page.evaluate(
    ({ accessToken, refreshToken, user }) => {
      // Set tokens in localStorage for the interceptor to pick up
      // (we'll also inject via hash for the initial load)
      window.localStorage.setItem('e2e_access_token', accessToken);
      window.localStorage.setItem('e2e_refresh_token', refreshToken);
      window.localStorage.setItem('e2e_user', JSON.stringify(user));
    },
    { accessToken, refreshToken, user }
  );

  return accessToken;
}

/**
 * Set up route intercept that adds the Authorization header to all API calls.
 * This ensures the React app's API requests carry the test JWT.
 */
export async function setupAuthIntercept(page: Page, user: TestJwtPayload): Promise<string> {
  const token = signTestToken(user);

  // Intercept all API requests and inject the auth header
  await page.route('**/api/**', async (route) => {
    const headers = {
      ...route.request().headers(),
      authorization: `Bearer ${token}`,
    };
    await route.continue({ headers });
  });

  // Also set up the Zustand store so RoleGuard doesn't redirect
  await page.addInitScript(
    ({ user, token, refreshToken }) => {
      // This runs before any page scripts execute
      (window as any).__E2E_USER__ = user;
      (window as any).__E2E_ACCESS_TOKEN__ = token;
      (window as any).__E2E_REFRESH_TOKEN__ = refreshToken;
    },
    { user, token, refreshToken: signTestToken(user, 604800) }
  );

  return token;
}
