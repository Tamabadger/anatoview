/**
 * Shared test helpers for API integration tests.
 *
 * Provides:
 * - JWT token generation for authenticated requests
 * - Test data factories for creating DB fixtures
 * - Database cleanup between tests
 */

import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import type { JwtPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';

// ─── Deterministic UUIDs ────────────────────────────────────────
// Valid UUID v4 format — deterministic so JWT tokens match DB records

export const TEST_IDS = {
  institution: 'a0000000-0000-4000-8000-000000000001',
  instructor:  'a0000000-0000-4000-8000-000000000002',
  student:     'a0000000-0000-4000-8000-000000000003',
  course:      'a0000000-0000-4000-8000-000000000004',
  category:    'a0000000-0000-4000-8000-000000000005',
  animal:      'a0000000-0000-4000-8000-000000000006',
  model:       'a0000000-0000-4000-8000-000000000007',
  lab:         'a0000000-0000-4000-8000-000000000008',
  structHeart: 'a0000000-0000-4000-8000-000000000010',
  structAorta: 'a0000000-0000-4000-8000-000000000011',
  structVena:  'a0000000-0000-4000-8000-000000000012',
} as const;

// ─── Token Factories ────────────────────────────────────────────

/**
 * Generate a valid JWT for an instructor user.
 */
export function instructorToken(overrides: Partial<JwtPayload> = {}): string {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    userId: overrides.userId ?? TEST_IDS.instructor,
    institutionId: overrides.institutionId ?? TEST_IDS.institution,
    role: overrides.role ?? 'instructor',
    canvasUserId: overrides.canvasUserId ?? 'canvas-instructor-1',
    email: overrides.email ?? 'instructor@test.edu',
    name: overrides.name ?? 'Dr. Test Instructor',
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Generate a valid JWT for a student user.
 */
export function studentToken(overrides: Partial<JwtPayload> = {}): string {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    userId: overrides.userId ?? TEST_IDS.student,
    institutionId: overrides.institutionId ?? TEST_IDS.institution,
    role: overrides.role ?? 'student',
    canvasUserId: overrides.canvasUserId ?? 'canvas-student-1',
    email: overrides.email ?? 'student@test.edu',
    name: overrides.name ?? 'Test Student',
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Generate a valid JWT for a TA user.
 */
export function taToken(overrides: Partial<JwtPayload> = {}): string {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    userId: overrides.userId ?? 'a0000000-0000-4000-8000-000000000099',
    institutionId: overrides.institutionId ?? TEST_IDS.institution,
    role: overrides.role ?? 'ta',
    canvasUserId: overrides.canvasUserId ?? 'canvas-ta-1',
    email: overrides.email ?? 'ta@test.edu',
    name: overrides.name ?? 'Test TA',
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

// ─── Seed Data Factories ────────────────────────────────────────

export interface TestFixtures {
  institution: { id: string };
  instructorUser: { id: string };
  studentUser: { id: string };
  course: { id: string };
  category: { id: string };
  animal: { id: string };
  model: { id: string };
  structures: { id: string; name: string }[];
  lab: { id: string };
}

/**
 * Create a full set of test fixtures:
 * institution → users → course → category → animal → model → structures → lab
 */
export async function seedTestData(): Promise<TestFixtures> {
  // Institution
  const institution = await prisma.institution.create({
    data: {
      id: TEST_IDS.institution,
      name: 'Test Veterinary College',
      canvasUrl: 'https://test-canvas.instructure.com',
      ltiClientId: 'test-client-id',
    },
  });

  // Users
  const instructorUser = await prisma.user.create({
    data: {
      id: TEST_IDS.instructor,
      institutionId: institution.id,
      canvasUserId: 'canvas-instructor-1',
      email: 'instructor@test.edu',
      name: 'Dr. Test Instructor',
      role: 'instructor',
    },
  });

  const studentUser = await prisma.user.create({
    data: {
      id: TEST_IDS.student,
      institutionId: institution.id,
      canvasUserId: 'canvas-student-1',
      email: 'student@test.edu',
      name: 'Test Student',
      role: 'student',
    },
  });

  // Course
  const course = await prisma.course.create({
    data: {
      id: TEST_IDS.course,
      institutionId: institution.id,
      canvasCourseId: 'canvas-course-1',
      name: 'Comparative Anatomy 101',
      term: 'Spring 2026',
      instructorId: instructorUser.id,
    },
  });

  // Category
  const category = await prisma.category.create({
    data: {
      id: TEST_IDS.category,
      name: 'Test Mammals',
      color: '#4A90D9',
      icon: 'cat',
      sortOrder: 0,
    },
  });

  // Animal
  const animal = await prisma.animal.create({
    data: {
      id: TEST_IDS.animal,
      commonName: 'Domestic Cat',
      scientificName: 'Felis catus',
      categoryId: category.id,
      description: 'Test cat for integration tests',
      modelType: 'svg',
    },
  });

  // Dissection model
  const model = await prisma.dissectionModel.create({
    data: {
      id: TEST_IDS.model,
      animalId: animal.id,
      version: '1.0',
      organSystem: 'cardiovascular',
      modelFileUrl: 'https://s3.example.com/test-model.svg',
      layerOrder: 0,
      isPublished: true,
    },
  });

  // Anatomical structures (UUIDs so Zod validation passes)
  const structureData = [
    { id: TEST_IDS.structHeart, name: 'Heart', latinName: 'Cor', hint: 'The main pumping organ' },
    { id: TEST_IDS.structAorta, name: 'Aorta', latinName: 'Aorta', hint: 'The largest artery' },
    { id: TEST_IDS.structVena, name: 'Vena Cava', latinName: 'Vena cava', hint: 'Returns blood to the heart' },
  ];

  const structures = [];
  for (const s of structureData) {
    const created = await prisma.anatomicalStructure.create({
      data: {
        id: s.id,
        modelId: model.id,
        name: s.name,
        latinName: s.latinName,
        hint: s.hint,
        difficultyLevel: 'medium',
        tags: ['cardiovascular'],
      },
    });
    structures.push({ id: created.id, name: created.name });
  }

  // Lab with structures assigned
  const lab = await prisma.lab.create({
    data: {
      id: TEST_IDS.lab,
      courseId: course.id,
      title: 'Cat Cardiovascular Lab',
      instructions: 'Identify the cardiovascular structures of the domestic cat.',
      animalId: animal.id,
      organSystems: ['cardiovascular'],
      labType: 'identification',
      settings: { timeLimit: 3600, maxAttempts: 3 },
      rubric: { hintPenaltyPercent: 10, fuzzyMatch: true },
      maxPoints: 100,
      isPublished: true,
      createdBy: instructorUser.id,
      structures: {
        create: structures.map((s, i) => ({
          structureId: s.id,
          orderIndex: i,
          pointsPossible: 1,
        })),
      },
    },
  });

  return {
    institution: { id: institution.id },
    instructorUser: { id: instructorUser.id },
    studentUser: { id: studentUser.id },
    course: { id: course.id },
    category: { id: category.id },
    animal: { id: animal.id },
    model: { id: model.id },
    structures,
    lab: { id: lab.id },
  };
}

// ─── Cleanup ────────────────────────────────────────────────────

/**
 * Tear down all test data. Order matters due to FK constraints.
 */
export async function cleanupTestData(): Promise<void> {
  // Delete in reverse dependency order
  await prisma.gradeSyncLog.deleteMany({});
  await prisma.dissectionEvent.deleteMany({});
  await prisma.structureResponse.deleteMany({});
  await prisma.labAttempt.deleteMany({});
  await prisma.labStructure.deleteMany({});
  await prisma.lab.deleteMany({});
  await prisma.anatomicalStructure.deleteMany({});
  await prisma.dissectionModel.deleteMany({});
  await prisma.animal.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.course.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.institution.deleteMany({});
}

/**
 * Disconnect Prisma after all tests.
 */
export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
