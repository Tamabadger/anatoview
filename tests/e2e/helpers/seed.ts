import { request } from '@playwright/test';
import { signTestToken, INSTRUCTOR_USER, STUDENT_USER, type TestJwtPayload } from './auth';

const API_BASE = 'http://localhost/api';

/**
 * Create an authenticated API request context for direct API calls during tests.
 */
export async function createApiContext(user: TestJwtPayload) {
  const token = signTestToken(user);
  return request.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

// ─── Seed data IDs (deterministic for E2E) ──────────────────────

export const E2E_IDS = {
  institutionId: 'e2e-institution-001',
  courseId: 'e2e-course-001',
  instructorId: 'e2e-instructor-001',
  studentId: 'e2e-student-001',
  // Seed animal IDs from apps/api/prisma/seed.ts
  catAnimalId: 'animal-cat-001',
  catCardioModelId: 'model-cat-cardio-001',
  // First 10 cardiovascular structure IDs
  structureIds: [
    'struct-cat-cv-001', // Left Ventricle
    'struct-cat-cv-002', // Right Ventricle
    'struct-cat-cv-003', // Left Atrium
    'struct-cat-cv-004', // Right Atrium
    'struct-cat-cv-005', // Aorta
    'struct-cat-cv-006', // Pulmonary Trunk
    'struct-cat-cv-007', // Superior Vena Cava
    'struct-cat-cv-008', // Inferior Vena Cava
    'struct-cat-cv-009', // Pulmonary Veins
    'struct-cat-cv-010', // Mitral Valve
  ],
  // Structure names for answer testing
  structureNames: {
    'struct-cat-cv-001': 'Left Ventricle',
    'struct-cat-cv-002': 'Right Ventricle',
    'struct-cat-cv-003': 'Left Atrium',
    'struct-cat-cv-004': 'Right Atrium',
    'struct-cat-cv-005': 'Aorta',
    'struct-cat-cv-006': 'Pulmonary Trunk',
    'struct-cat-cv-007': 'Superior Vena Cava',
    'struct-cat-cv-008': 'Inferior Vena Cava',
    'struct-cat-cv-009': 'Pulmonary Veins',
    'struct-cat-cv-010': 'Mitral Valve',
  } as Record<string, string>,
};

/**
 * Seed the test database with an institution, course, instructor, and student.
 * This directly calls the database through the API health endpoint to verify
 * connectivity, then creates records via API routes.
 *
 * Must be called once before all E2E tests.
 */
export async function seedTestDatabase(): Promise<void> {
  // Use instructor API context to create test records
  const api = await createApiContext(INSTRUCTOR_USER);

  try {
    // Verify API is reachable
    const healthResp = await api.get('/health');
    if (healthResp.status() !== 200) {
      throw new Error(`API health check failed: ${healthResp.status()}`);
    }

    console.log('[E2E Seed] API is healthy, ready for tests.');
  } finally {
    await api.dispose();
  }
}

/**
 * Create a fully configured lab via the API, ready for student interaction.
 * Returns the created lab's ID.
 */
export async function createTestLab(options: {
  title?: string;
  structureIds?: string[];
  publish?: boolean;
  rubric?: Record<string, unknown>;
  maxPoints?: number;
} = {}): Promise<string> {
  const {
    title = 'E2E Test Lab — Cat Cardiovascular',
    structureIds = E2E_IDS.structureIds.slice(0, 5), // First 5 structures
    publish = true,
    rubric = {
      hintPenaltyPercent: 10,
      fuzzyMatch: true,
      partialCredit: false,
      acceptedAliases: {
        'struct-cat-cv-001': ['LV', 'left vent'],
        'struct-cat-cv-005': ['main artery'],
      },
    },
    maxPoints = 100,
  } = options;

  const api = await createApiContext(INSTRUCTOR_USER);

  try {
    const resp = await api.post('/labs', {
      data: {
        courseId: E2E_IDS.courseId,
        title,
        instructions: 'Identify the labeled cardiovascular structures.',
        animalId: E2E_IDS.catAnimalId,
        organSystems: ['cardiovascular'],
        labType: 'identification',
        settings: {
          timeLimitMinutes: 60,
          attemptsAllowed: 3,
          showHints: true,
          randomizeOrder: false,
        },
        rubric,
        maxPoints,
        structureIds,
      },
    });

    if (resp.status() !== 201) {
      const body = await resp.text();
      throw new Error(`Failed to create lab (${resp.status()}): ${body}`);
    }

    const lab = await resp.json();

    if (publish) {
      const publishResp = await api.post(`/labs/${lab.id}/publish`);
      if (publishResp.status() !== 200) {
        const body = await publishResp.text();
        throw new Error(`Failed to publish lab (${publishResp.status()}): ${body}`);
      }
    }

    console.log(`[E2E Seed] Created ${publish ? 'published' : 'draft'} lab: ${lab.id}`);
    return lab.id;
  } finally {
    await api.dispose();
  }
}

/**
 * Create a graded attempt for the student, ready for Canvas sync testing.
 * Returns the attempt ID.
 */
export async function createGradedAttempt(labId: string): Promise<string> {
  const api = await createApiContext(STUDENT_USER);

  try {
    // 1. Get or create attempt
    const attemptResp = await api.get(`/labs/${labId}/attempt`);
    const attempt = await attemptResp.json();
    const attemptId = attempt.id;

    // 2. Start the attempt
    await api.post(`/labs/${labId}/attempt/start`);

    // 3. Submit responses (3 correct, 2 wrong out of first 5 structures)
    const responses = [
      { structureId: 'struct-cat-cv-001', studentAnswer: 'Left Ventricle', hintsUsed: 0 },
      { structureId: 'struct-cat-cv-002', studentAnswer: 'Right Ventricle', hintsUsed: 0 },
      { structureId: 'struct-cat-cv-003', studentAnswer: 'Left Atrium', hintsUsed: 0 },
      { structureId: 'struct-cat-cv-004', studentAnswer: 'Wrong Answer 1', hintsUsed: 0 },
      { structureId: 'struct-cat-cv-005', studentAnswer: 'Wrong Answer 2', hintsUsed: 1 },
    ];

    await api.post(`/attempts/${attemptId}/responses`, {
      data: { responses },
    });

    // 4. Submit for grading
    const submitResp = await api.post(`/labs/${labId}/attempt/submit`);
    const submitData = await submitResp.json();

    console.log(
      `[E2E Seed] Created graded attempt ${attemptId}: ${submitData.gradeResult?.percentage}%`
    );

    return attemptId;
  } finally {
    await api.dispose();
  }
}

/**
 * Delete a lab and all its attempts (cleanup after tests).
 */
export async function deleteTestLab(labId: string): Promise<void> {
  const api = await createApiContext(INSTRUCTOR_USER);
  try {
    await api.delete(`/labs/${labId}`);
    console.log(`[E2E Seed] Deleted lab ${labId}`);
  } finally {
    await api.dispose();
  }
}
