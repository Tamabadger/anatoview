import { test as base, expect, Page } from '@playwright/test';
import {
  setupAuthIntercept,
  INSTRUCTOR_USER,
  STUDENT_USER,
  type TestJwtPayload,
} from './auth';

/**
 * Custom Playwright fixtures that provide:
 *   - instructorPage: a Page authenticated as an instructor
 *   - studentPage: a Page authenticated as a student
 *   - apiBaseURL: the API base URL for direct HTTP calls
 */
type AnatoViewFixtures = {
  instructorPage: Page;
  studentPage: Page;
  apiBaseURL: string;
};

export const test = base.extend<AnatoViewFixtures>({
  /**
   * A page pre-configured with instructor auth.
   * All /api/ requests carry the instructor JWT.
   * The Zustand store is seeded with instructor identity.
   */
  instructorPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await setupAuthIntercept(page, INSTRUCTOR_USER);

    // Inject the app store initialization script
    await page.addInitScript(
      (user) => {
        // Override the RoleGuard loading state
        // The app checks useAppStore for user/isLoading
        // We inject the user before React mounts via window globals
        (window as any).__E2E_INJECT_USER__ = {
          id: user.userId,
          name: user.name,
          email: user.email,
          role: user.role,
          canvasUserId: user.canvasUserId,
          institutionId: user.institutionId,
        };
      },
      INSTRUCTOR_USER
    );

    await use(page);
    await context.close();
  },

  /**
   * A page pre-configured with student auth.
   */
  studentPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await setupAuthIntercept(page, STUDENT_USER);

    await page.addInitScript(
      (user) => {
        (window as any).__E2E_INJECT_USER__ = {
          id: user.userId,
          name: user.name,
          email: user.email,
          role: user.role,
          canvasUserId: user.canvasUserId,
          institutionId: user.institutionId,
        };
      },
      STUDENT_USER
    );

    await use(page);
    await context.close();
  },

  apiBaseURL: async ({}, use) => {
    await use('http://localhost/api');
  },
});

export { expect };
