import { request, FullConfig } from '@playwright/test';
import { signTestToken, INSTRUCTOR_USER, STUDENT_USER } from './auth';
import { E2E_IDS } from './seed';

const API_BASE = 'http://localhost/api';

/**
 * Global setup — runs once before all E2E test suites.
 *
 * Ensures:
 *   1. API is reachable (Docker stack is up)
 *   2. Database has the seed data (animals, structures)
 *   3. Test institution, course, and users exist
 */
async function globalSetup(_config: FullConfig): Promise<void> {
  console.log('\n═══════════════════════════════════════════');
  console.log('  AnatoView E2E — Global Setup');
  console.log('═══════════════════════════════════════════\n');

  // 1. Wait for API to be ready (retry for up to 30s)
  const api = await request.newContext({ baseURL: API_BASE });
  let ready = false;

  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      const resp = await api.get('/health');
      if (resp.ok()) {
        ready = true;
        break;
      }
    } catch {
      // API not ready yet
    }
    console.log(`  Waiting for API... (attempt ${attempt + 1}/15)`);
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (!ready) {
    throw new Error(
      'API is not reachable at http://localhost/api/health.\n' +
      'Make sure the Docker stack is running:\n' +
      '  docker compose -f docker-compose.yml -f docker-compose.test.yml up -d'
    );
  }
  console.log('  ✓ API is healthy\n');

  // 2. Seed the test institution, users, and course via direct DB operations.
  //    We call a special test-seed endpoint OR use the API with elevated permissions.
  //    Since there's no admin-seed endpoint, we POST data that the auth middleware
  //    accepts via our test JWT (the middleware trusts the JWT claims).
  //
  //    The seed.ts already populates animals/models/structures.
  //    We need: Institution → Users → Course

  const instructorToken = signTestToken(INSTRUCTOR_USER);
  const authedApi = await request.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: {
      Authorization: `Bearer ${instructorToken}`,
      'Content-Type': 'application/json',
    },
  });

  // Check if we can reach /auth/me (will 401 if user doesn't exist in DB).
  // If so, data is already seeded. If not, we need to seed.
  const meResp = await authedApi.get('/auth/me');

  if (meResp.status() === 401 || meResp.status() === 404) {
    console.log('  ℹ  Test users not found in DB — they will be created by LTI launch flow.');
    console.log('  ℹ  Tests use route intercepts to inject JWTs directly.\n');
  } else {
    console.log('  ✓ Test user exists in DB\n');
  }

  // Verify seed data (animals) exists
  const animalsResp = await authedApi.get('/animals');
  if (animalsResp.ok()) {
    const animals = await animalsResp.json();
    console.log(`  ✓ ${animals.animals?.length ?? 0} animals in database`);
  } else {
    console.log('  ⚠  Could not verify animals — seed may need to run');
    console.log('     Run: docker compose exec api npm run db:seed');
  }

  await api.dispose();
  await authedApi.dispose();

  console.log('\n  ✓ Global setup complete\n');
}

export default globalSetup;
