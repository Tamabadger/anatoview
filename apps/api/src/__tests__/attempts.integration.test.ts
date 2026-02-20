import request from 'supertest';
import { app } from '../app';
import { prisma } from '../config/database';
import {
  instructorToken,
  studentToken,
  seedTestData,
  cleanupTestData,
  disconnectDb,
  TestFixtures,
  TEST_IDS,
} from './helpers';

// ─── Mocks ──────────────────────────────────────────────────────
jest.mock('../services/gradeQueue', () => ({
  getGradeQueue: () => ({
    add: jest.fn().mockResolvedValue({}),
    on: jest.fn(),
  }),
  closeGradeQueue: jest.fn(),
}));

// ─── Test Suite ─────────────────────────────────────────────────

let fixtures: TestFixtures;
let instToken: string;
let studToken: string;

beforeAll(async () => {
  fixtures = await seedTestData();
  instToken = instructorToken();
  studToken = studentToken();
});

afterAll(async () => {
  await cleanupTestData();
  await disconnectDb();
});

// ─── GET /labs/:id/attempt ──────────────────────────────────────

describe('GET /labs/:id/attempt', () => {
  afterEach(async () => {
    // Clean up any attempts created during tests
    await prisma.structureResponse.deleteMany({});
    await prisma.dissectionEvent.deleteMany({});
    await prisma.labAttempt.deleteMany({});
  });

  it('creates a new attempt if none exists', async () => {
    const res = await request(app)
      .get(`/labs/${fixtures.lab.id}/attempt`)
      .set('Authorization', `Bearer ${studToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.labId).toBe(fixtures.lab.id);
    expect(res.body.studentId).toBe(TEST_IDS.student);
    expect(res.body.status).toBe('not_started');
    expect(res.body.attemptNumber).toBe(1);
    expect(res.body).toHaveProperty('responses');
    expect(res.body.responses).toEqual([]);
  });

  it('returns existing attempt on subsequent calls', async () => {
    // First call creates
    const res1 = await request(app)
      .get(`/labs/${fixtures.lab.id}/attempt`)
      .set('Authorization', `Bearer ${studToken}`);

    // Second call returns same
    const res2 = await request(app)
      .get(`/labs/${fixtures.lab.id}/attempt`)
      .set('Authorization', `Bearer ${studToken}`);

    expect(res2.status).toBe(200);
    expect(res2.body.id).toBe(res1.body.id);
  });

  it('returns 404 for non-existent lab', async () => {
    const res = await request(app)
      .get('/labs/00000000-0000-0000-0000-000000000000/attempt')
      .set('Authorization', `Bearer ${studToken}`);

    expect(res.status).toBe(404);
  });
});

// ─── POST /labs/:id/attempt/start ───────────────────────────────

describe('POST /labs/:id/attempt/start', () => {
  afterEach(async () => {
    await prisma.structureResponse.deleteMany({});
    await prisma.dissectionEvent.deleteMany({});
    await prisma.labAttempt.deleteMany({});
  });

  it('transitions attempt from not_started to in_progress', async () => {
    // Create attempt first
    await request(app)
      .get(`/labs/${fixtures.lab.id}/attempt`)
      .set('Authorization', `Bearer ${studToken}`);

    // Start it
    const res = await request(app)
      .post(`/labs/${fixtures.lab.id}/attempt/start`)
      .set('Authorization', `Bearer ${studToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
    expect(res.body.startedAt).toBeTruthy();
  });

  it('returns 404 if no unstarted attempt exists', async () => {
    const res = await request(app)
      .post(`/labs/${fixtures.lab.id}/attempt/start`)
      .set('Authorization', `Bearer ${studToken}`);

    expect(res.status).toBe(404);
  });
});

// ─── POST /attempts/:id/responses ───────────────────────────────

describe('POST /attempts/:id/responses', () => {
  let attemptId: string;

  beforeEach(async () => {
    // Create and start an attempt
    const getRes = await request(app)
      .get(`/labs/${fixtures.lab.id}/attempt`)
      .set('Authorization', `Bearer ${studToken}`);
    attemptId = getRes.body.id;

    await request(app)
      .post(`/labs/${fixtures.lab.id}/attempt/start`)
      .set('Authorization', `Bearer ${studToken}`);
  });

  afterEach(async () => {
    await prisma.structureResponse.deleteMany({});
    await prisma.dissectionEvent.deleteMany({});
    await prisma.labAttempt.deleteMany({});
  });

  it('saves structure responses', async () => {
    const res = await request(app)
      .post(`/attempts/${attemptId}/responses`)
      .set('Authorization', `Bearer ${studToken}`)
      .send({
        responses: [
          { structureId: fixtures.structures[0].id, studentAnswer: 'Heart', hintsUsed: 0 },
          { structureId: fixtures.structures[1].id, studentAnswer: 'Aorta', hintsUsed: 1 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('2 responses saved');
    expect(res.body.responses).toHaveLength(2);
  });

  it('upserts existing responses (does not duplicate)', async () => {
    // First save
    await request(app)
      .post(`/attempts/${attemptId}/responses`)
      .set('Authorization', `Bearer ${studToken}`)
      .send({
        responses: [
          { structureId: fixtures.structures[0].id, studentAnswer: 'Wrong Answer', hintsUsed: 0 },
        ],
      });

    // Upsert with corrected answer
    const res = await request(app)
      .post(`/attempts/${attemptId}/responses`)
      .set('Authorization', `Bearer ${studToken}`)
      .send({
        responses: [
          { structureId: fixtures.structures[0].id, studentAnswer: 'Heart', hintsUsed: 1 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.responses).toHaveLength(1);
    expect(res.body.responses[0].studentAnswer).toBe('Heart');
    expect(res.body.responses[0].hintsUsed).toBe(1);

    // Verify only 1 response exists in DB for this structure
    const responses = await prisma.structureResponse.findMany({
      where: { attemptId, structureId: fixtures.structures[0].id },
    });
    expect(responses).toHaveLength(1);
  });

  it('returns 404 for non-existent attempt', async () => {
    const res = await request(app)
      .post('/attempts/00000000-0000-0000-0000-000000000000/responses')
      .set('Authorization', `Bearer ${studToken}`)
      .send({
        responses: [
          { structureId: fixtures.structures[0].id, studentAnswer: 'Heart' },
        ],
      });

    expect(res.status).toBe(404);
  });

  it('returns 400 when attempt is already submitted', async () => {
    // Submit the attempt
    await prisma.labAttempt.update({
      where: { id: attemptId },
      data: { status: 'submitted', submittedAt: new Date() },
    });

    const res = await request(app)
      .post(`/attempts/${attemptId}/responses`)
      .set('Authorization', `Bearer ${studToken}`)
      .send({
        responses: [
          { structureId: fixtures.structures[0].id, studentAnswer: 'Heart' },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('submitted');
  });

  it('returns 400 with empty responses array', async () => {
    const res = await request(app)
      .post(`/attempts/${attemptId}/responses`)
      .set('Authorization', `Bearer ${studToken}`)
      .send({ responses: [] });

    expect(res.status).toBe(400);
  });

  it('prevents a student from writing to another student\'s attempt', async () => {
    const otherId = 'a0000000-0000-4000-8000-000000000050';
    const otherStudToken = studentToken({
      userId: otherId,
      canvasUserId: 'canvas-other',
      email: 'other@test.edu',
      name: 'Other Student',
    });

    // Create the other student user first
    await prisma.user.create({
      data: {
        id: otherId,
        institutionId: fixtures.institution.id,
        canvasUserId: 'canvas-other',
        email: 'other@test.edu',
        name: 'Other Student',
        role: 'student',
      },
    }).catch(() => {}); // Ignore if exists

    const res = await request(app)
      .post(`/attempts/${attemptId}/responses`)
      .set('Authorization', `Bearer ${otherStudToken}`)
      .send({
        responses: [
          { structureId: fixtures.structures[0].id, studentAnswer: 'Hacked' },
        ],
      });

    expect(res.status).toBe(403);

    // Cleanup
    await prisma.user.delete({ where: { id: otherId } }).catch(() => {});
  });
});

// ─── POST /attempts/:id/events ──────────────────────────────────

describe('POST /attempts/:id/events', () => {
  let attemptId: string;

  beforeEach(async () => {
    const getRes = await request(app)
      .get(`/labs/${fixtures.lab.id}/attempt`)
      .set('Authorization', `Bearer ${studToken}`);
    attemptId = getRes.body.id;

    await request(app)
      .post(`/labs/${fixtures.lab.id}/attempt/start`)
      .set('Authorization', `Bearer ${studToken}`);
  });

  afterEach(async () => {
    await prisma.dissectionEvent.deleteMany({});
    await prisma.structureResponse.deleteMany({});
    await prisma.labAttempt.deleteMany({});
  });

  it('logs a batch of events', async () => {
    const res = await request(app)
      .post(`/attempts/${attemptId}/events`)
      .set('Authorization', `Bearer ${studToken}`)
      .send({
        events: [
          { eventType: 'click', structureId: fixtures.structures[0].id, payload: { x: 100, y: 200 } },
          { eventType: 'zoom', payload: { scale: 1.5 } },
          { eventType: 'hint_request', structureId: fixtures.structures[1].id },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);

    // Verify in DB
    const events = await prisma.dissectionEvent.findMany({ where: { attemptId } });
    expect(events).toHaveLength(3);
  });

  it('returns 400 with empty events array', async () => {
    const res = await request(app)
      .post(`/attempts/${attemptId}/events`)
      .set('Authorization', `Bearer ${studToken}`)
      .send({ events: [] });

    expect(res.status).toBe(400);
  });
});

// ─── GET /attempts/:id ──────────────────────────────────────────

describe('GET /attempts/:id', () => {
  let attemptId: string;

  beforeEach(async () => {
    const getRes = await request(app)
      .get(`/labs/${fixtures.lab.id}/attempt`)
      .set('Authorization', `Bearer ${studToken}`);
    attemptId = getRes.body.id;
  });

  afterEach(async () => {
    await prisma.dissectionEvent.deleteMany({});
    await prisma.structureResponse.deleteMany({});
    await prisma.labAttempt.deleteMany({});
  });

  it('returns full attempt detail for the owning student', async () => {
    const res = await request(app)
      .get(`/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${studToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(attemptId);
    expect(res.body).toHaveProperty('lab');
    expect(res.body).toHaveProperty('student');
    expect(res.body).toHaveProperty('responses');
    expect(res.body).toHaveProperty('events');
  });

  it('instructor can view any attempt', async () => {
    const res = await request(app)
      .get(`/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${instToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(attemptId);
  });

  it('returns 404 for non-existent attempt', async () => {
    const res = await request(app)
      .get('/attempts/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${studToken}`);

    expect(res.status).toBe(404);
  });

  it('prevents student from viewing another student\'s attempt', async () => {
    const otherId = 'a0000000-0000-4000-8000-000000000051';
    const otherStudToken = studentToken({
      userId: otherId,
      canvasUserId: 'canvas-other-2',
      name: 'Other Student 2',
    });

    await prisma.user.create({
      data: {
        id: otherId,
        institutionId: fixtures.institution.id,
        canvasUserId: 'canvas-other-2',
        name: 'Other Student 2',
        role: 'student',
      },
    }).catch(() => {});

    const res = await request(app)
      .get(`/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${otherStudToken}`);

    expect(res.status).toBe(403);

    await prisma.user.delete({ where: { id: otherId } }).catch(() => {});
  });
});

// ─── GET /attempts/:id/responses ────────────────────────────────

describe('GET /attempts/:id/responses', () => {
  let attemptId: string;

  beforeEach(async () => {
    // Create, start, and save some responses
    const getRes = await request(app)
      .get(`/labs/${fixtures.lab.id}/attempt`)
      .set('Authorization', `Bearer ${studToken}`);
    attemptId = getRes.body.id;

    await request(app)
      .post(`/labs/${fixtures.lab.id}/attempt/start`)
      .set('Authorization', `Bearer ${studToken}`);

    await request(app)
      .post(`/attempts/${attemptId}/responses`)
      .set('Authorization', `Bearer ${studToken}`)
      .send({
        responses: [
          { structureId: fixtures.structures[0].id, studentAnswer: 'Heart', hintsUsed: 0 },
          { structureId: fixtures.structures[1].id, studentAnswer: 'Aorta', hintsUsed: 2 },
        ],
      });
  });

  afterEach(async () => {
    await prisma.dissectionEvent.deleteMany({});
    await prisma.structureResponse.deleteMany({});
    await prisma.labAttempt.deleteMany({});
  });

  it('returns all responses for an attempt', async () => {
    const res = await request(app)
      .get(`/attempts/${attemptId}/responses`)
      .set('Authorization', `Bearer ${studToken}`);

    expect(res.status).toBe(200);
    expect(res.body.attemptId).toBe(attemptId);
    expect(res.body.responses).toHaveLength(2);
    expect(res.body.total).toBe(2);

    const heartResp = res.body.responses.find((r: any) => r.structureId === fixtures.structures[0].id);
    expect(heartResp.studentAnswer).toBe('Heart');
    expect(heartResp.hintsUsed).toBe(0);
    expect(heartResp).toHaveProperty('structure');
    expect(heartResp.structure.name).toBe('Heart');
  });

  it('instructor can view responses', async () => {
    const res = await request(app)
      .get(`/attempts/${attemptId}/responses`)
      .set('Authorization', `Bearer ${instToken}`);

    expect(res.status).toBe(200);
    expect(res.body.responses).toHaveLength(2);
  });
});

// ─── Full Attempt Lifecycle ─────────────────────────────────────

describe('Full Attempt Lifecycle: create → start → respond → submit → grade', () => {
  afterEach(async () => {
    await prisma.gradeSyncLog.deleteMany({});
    await prisma.dissectionEvent.deleteMany({});
    await prisma.structureResponse.deleteMany({});
    await prisma.labAttempt.deleteMany({});
  });

  it('completes the full lifecycle with grading', async () => {
    // 1. Get/create attempt
    const attemptRes = await request(app)
      .get(`/labs/${fixtures.lab.id}/attempt`)
      .set('Authorization', `Bearer ${studToken}`);

    expect(attemptRes.status).toBe(200);
    expect(attemptRes.body.status).toBe('not_started');
    const attemptId = attemptRes.body.id;

    // 2. Start the attempt
    const startRes = await request(app)
      .post(`/labs/${fixtures.lab.id}/attempt/start`)
      .set('Authorization', `Bearer ${studToken}`);

    expect(startRes.status).toBe(200);
    expect(startRes.body.status).toBe('in_progress');

    // 3. Save responses (all correct)
    const responsesRes = await request(app)
      .post(`/attempts/${attemptId}/responses`)
      .set('Authorization', `Bearer ${studToken}`)
      .send({
        responses: [
          { structureId: fixtures.structures[0].id, studentAnswer: 'Heart', hintsUsed: 0 },
          { structureId: fixtures.structures[1].id, studentAnswer: 'Aorta', hintsUsed: 0 },
          { structureId: fixtures.structures[2].id, studentAnswer: 'Vena Cava', hintsUsed: 0 },
        ],
      });

    expect(responsesRes.status).toBe(200);
    expect(responsesRes.body.responses).toHaveLength(3);

    // 4. Submit for grading
    const submitRes = await request(app)
      .post(`/labs/${fixtures.lab.id}/attempt/submit`)
      .set('Authorization', `Bearer ${studToken}`);

    expect(submitRes.status).toBe(200);
    expect(submitRes.body).toHaveProperty('attempt');
    expect(submitRes.body).toHaveProperty('gradeResult');
    expect(submitRes.body.attempt.status).toBe('graded');

    // Verify grading results
    const { gradeResult } = submitRes.body;
    expect(gradeResult.attemptId).toBe(attemptId);
    expect(gradeResult.percentage).toBe(100); // All correct, no hints
    expect(gradeResult.structureResults).toHaveLength(3);

    // Each result should be correct
    for (const sr of gradeResult.structureResults) {
      expect(sr.isCorrect).toBe(true);
      expect(sr.matchType).toBe('exact');
      expect(sr.hintPenalty).toBe(0);
    }

    // 5. Verify attempt is graded in DB
    const dbAttempt = await prisma.labAttempt.findUnique({
      where: { id: attemptId },
    });
    expect(dbAttempt?.status).toBe('graded');
    expect(dbAttempt?.gradedAt).toBeTruthy();
    expect(Number(dbAttempt?.percentage)).toBe(100);
  });

  it('applies hint penalties during grading', async () => {
    // Create + start attempt
    const attemptRes = await request(app)
      .get(`/labs/${fixtures.lab.id}/attempt`)
      .set('Authorization', `Bearer ${studToken}`);
    const attemptId = attemptRes.body.id;

    await request(app)
      .post(`/labs/${fixtures.lab.id}/attempt/start`)
      .set('Authorization', `Bearer ${studToken}`);

    // Save responses with hints used
    await request(app)
      .post(`/attempts/${attemptId}/responses`)
      .set('Authorization', `Bearer ${studToken}`)
      .send({
        responses: [
          { structureId: fixtures.structures[0].id, studentAnswer: 'Heart', hintsUsed: 2 },
          { structureId: fixtures.structures[1].id, studentAnswer: 'Aorta', hintsUsed: 0 },
          { structureId: fixtures.structures[2].id, studentAnswer: 'Vena Cava', hintsUsed: 1 },
        ],
      });

    // Submit
    const submitRes = await request(app)
      .post(`/labs/${fixtures.lab.id}/attempt/submit`)
      .set('Authorization', `Bearer ${studToken}`);

    expect(submitRes.status).toBe(200);

    const { gradeResult } = submitRes.body;

    // Heart: 2 hints × 10% × 1 point = 0.2 penalty → 0.8 points
    const heartResult = gradeResult.structureResults.find(
      (r: any) => r.structureId === fixtures.structures[0].id
    );
    expect(heartResult.isCorrect).toBe(true);
    expect(heartResult.hintPenalty).toBe(0.2);
    expect(heartResult.pointsEarned).toBe(0.8);

    // Aorta: 0 hints → 1.0 points
    const aortaResult = gradeResult.structureResults.find(
      (r: any) => r.structureId === fixtures.structures[1].id
    );
    expect(aortaResult.hintPenalty).toBe(0);
    expect(aortaResult.pointsEarned).toBe(1);

    // Vena Cava: 1 hint × 10% × 1 point = 0.1 penalty → 0.9 points
    const vcResult = gradeResult.structureResults.find(
      (r: any) => r.structureId === fixtures.structures[2].id
    );
    expect(vcResult.hintPenalty).toBe(0.1);
    expect(vcResult.pointsEarned).toBe(0.9);

    // Total: (0.8 + 1 + 0.9) / 3 * 100 = 90% → scaled to maxPoints 100
    expect(gradeResult.percentage).toBe(90);
  });

  it('handles fuzzy matching (Levenshtein distance ≤ 2)', async () => {
    const attemptRes = await request(app)
      .get(`/labs/${fixtures.lab.id}/attempt`)
      .set('Authorization', `Bearer ${studToken}`);
    const attemptId = attemptRes.body.id;

    await request(app)
      .post(`/labs/${fixtures.lab.id}/attempt/start`)
      .set('Authorization', `Bearer ${studToken}`);

    // "Haert" is distance 2 from "Heart" (transposition + missing letter)
    // "Aotra" is distance 2 from "Aorta" (transposition)
    await request(app)
      .post(`/attempts/${attemptId}/responses`)
      .set('Authorization', `Bearer ${studToken}`)
      .send({
        responses: [
          { structureId: fixtures.structures[0].id, studentAnswer: 'Haert', hintsUsed: 0 },
          { structureId: fixtures.structures[1].id, studentAnswer: 'Aotra', hintsUsed: 0 },
          { structureId: fixtures.structures[2].id, studentAnswer: 'Kidney', hintsUsed: 0 }, // Wrong
        ],
      });

    const submitRes = await request(app)
      .post(`/labs/${fixtures.lab.id}/attempt/submit`)
      .set('Authorization', `Bearer ${studToken}`);

    expect(submitRes.status).toBe(200);
    const { gradeResult } = submitRes.body;

    // Haert → Heart: fuzzy match
    const heartResult = gradeResult.structureResults.find(
      (r: any) => r.structureId === fixtures.structures[0].id
    );
    expect(heartResult.isCorrect).toBe(true);
    expect(heartResult.matchType).toBe('fuzzy');

    // Aotra → Aorta: fuzzy match
    const aortaResult = gradeResult.structureResults.find(
      (r: any) => r.structureId === fixtures.structures[1].id
    );
    expect(aortaResult.isCorrect).toBe(true);
    expect(aortaResult.matchType).toBe('fuzzy');

    // Kidney → Vena Cava: incorrect (too far)
    const vcResult = gradeResult.structureResults.find(
      (r: any) => r.structureId === fixtures.structures[2].id
    );
    expect(vcResult.isCorrect).toBe(false);
    expect(vcResult.matchType).toBe('incorrect');
  });

  it('handles latin name matching', async () => {
    const attemptRes = await request(app)
      .get(`/labs/${fixtures.lab.id}/attempt`)
      .set('Authorization', `Bearer ${studToken}`);
    const attemptId = attemptRes.body.id;

    await request(app)
      .post(`/labs/${fixtures.lab.id}/attempt/start`)
      .set('Authorization', `Bearer ${studToken}`);

    // Use the latin name "Cor" for Heart
    await request(app)
      .post(`/attempts/${attemptId}/responses`)
      .set('Authorization', `Bearer ${studToken}`)
      .send({
        responses: [
          { structureId: fixtures.structures[0].id, studentAnswer: 'Cor', hintsUsed: 0 },
          { structureId: fixtures.structures[1].id, studentAnswer: 'Aorta', hintsUsed: 0 },
          { structureId: fixtures.structures[2].id, studentAnswer: 'Vena cava', hintsUsed: 0 },
        ],
      });

    const submitRes = await request(app)
      .post(`/labs/${fixtures.lab.id}/attempt/submit`)
      .set('Authorization', `Bearer ${studToken}`);

    expect(submitRes.status).toBe(200);
    const { gradeResult } = submitRes.body;

    // "Cor" matches latin name for Heart
    const heartResult = gradeResult.structureResults.find(
      (r: any) => r.structureId === fixtures.structures[0].id
    );
    expect(heartResult.isCorrect).toBe(true);
    expect(heartResult.matchType).toBe('exact');

    // All should be correct
    expect(gradeResult.percentage).toBe(100);
  });

  it('attempt resume: returns existing responses on GET /labs/:id/attempt', async () => {
    // Create + start attempt
    const attemptRes = await request(app)
      .get(`/labs/${fixtures.lab.id}/attempt`)
      .set('Authorization', `Bearer ${studToken}`);
    const attemptId = attemptRes.body.id;

    await request(app)
      .post(`/labs/${fixtures.lab.id}/attempt/start`)
      .set('Authorization', `Bearer ${studToken}`);

    // Save some responses
    await request(app)
      .post(`/attempts/${attemptId}/responses`)
      .set('Authorization', `Bearer ${studToken}`)
      .send({
        responses: [
          { structureId: fixtures.structures[0].id, studentAnswer: 'Heart', hintsUsed: 0 },
          { structureId: fixtures.structures[1].id, studentAnswer: 'Wrong', hintsUsed: 1 },
        ],
      });

    // "Resume" — call GET /labs/:id/attempt again
    const resumeRes = await request(app)
      .get(`/labs/${fixtures.lab.id}/attempt`)
      .set('Authorization', `Bearer ${studToken}`);

    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.id).toBe(attemptId);
    expect(resumeRes.body.status).toBe('in_progress');
    expect(resumeRes.body.responses).toHaveLength(2);

    // Responses should include the saved data
    const heartResp = resumeRes.body.responses.find(
      (r: any) => r.structureId === fixtures.structures[0].id
    );
    expect(heartResp.studentAnswer).toBe('Heart');
    expect(heartResp.hintsUsed).toBe(0);

    const wrongResp = resumeRes.body.responses.find(
      (r: any) => r.structureId === fixtures.structures[1].id
    );
    expect(wrongResp.studentAnswer).toBe('Wrong');
    expect(wrongResp.hintsUsed).toBe(1);
  });
});

// ─── Instructor Grade Override ──────────────────────────────────

describe('PUT /attempts/:id/grade', () => {
  let attemptId: string;
  let responseId: string;

  beforeEach(async () => {
    // Create a fully graded attempt
    const attemptRes = await request(app)
      .get(`/labs/${fixtures.lab.id}/attempt`)
      .set('Authorization', `Bearer ${studToken}`);
    attemptId = attemptRes.body.id;

    await request(app)
      .post(`/labs/${fixtures.lab.id}/attempt/start`)
      .set('Authorization', `Bearer ${studToken}`);

    await request(app)
      .post(`/attempts/${attemptId}/responses`)
      .set('Authorization', `Bearer ${studToken}`)
      .send({
        responses: [
          { structureId: fixtures.structures[0].id, studentAnswer: 'Heart' },
          { structureId: fixtures.structures[1].id, studentAnswer: 'Wrong Answer' },
          { structureId: fixtures.structures[2].id, studentAnswer: 'Vena Cava' },
        ],
      });

    const submitRes = await request(app)
      .post(`/labs/${fixtures.lab.id}/attempt/submit`)
      .set('Authorization', `Bearer ${studToken}`);

    // Get the responseId for the wrong answer
    const wrongResponse = submitRes.body.gradeResult.structureResults.find(
      (r: any) => r.structureId === fixtures.structures[1].id
    );
    responseId = wrongResponse.responseId;
  });

  afterEach(async () => {
    await prisma.gradeSyncLog.deleteMany({});
    await prisma.dissectionEvent.deleteMany({});
    await prisma.structureResponse.deleteMany({});
    await prisma.labAttempt.deleteMany({});
  });

  it('allows instructor to override a grade', async () => {
    const res = await request(app)
      .put(`/attempts/${attemptId}/grade`)
      .set('Authorization', `Bearer ${instToken}`)
      .send({
        responseId,
        overridePoints: 0.5,
        feedback: 'Close enough — partial credit given.',
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('override');
    expect(res.body.overridePoints).toBe(0.5);
    expect(res.body).toHaveProperty('newTotalScore');
    expect(res.body).toHaveProperty('newPercentage');
  });

  it('returns 403 for student attempting grade override', async () => {
    const res = await request(app)
      .put(`/attempts/${attemptId}/grade`)
      .set('Authorization', `Bearer ${studToken}`)
      .send({
        responseId,
        overridePoints: 1,
      });

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent attempt', async () => {
    const res = await request(app)
      .put('/attempts/00000000-0000-0000-0000-000000000000/grade')
      .set('Authorization', `Bearer ${instToken}`)
      .send({
        responseId,
        overridePoints: 1,
      });

    expect(res.status).toBe(404);
  });
});
