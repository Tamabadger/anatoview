import request from 'supertest';
import { app } from '../app';
import {
  instructorToken,
  studentToken,
  taToken,
  seedTestData,
  cleanupTestData,
  disconnectDb,
  TestFixtures,
} from './helpers';

// ─── Mocks ──────────────────────────────────────────────────────
// Bull queue requires Redis — mock it so grading doesn't fail
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

// ─── Health Check ───────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with service info', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('anatoview-api');
    expect(res.body).toHaveProperty('timestamp');
  });
});

// ─── Authentication ─────────────────────────────────────────────

describe('Authentication', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await request(app).get('/labs').query({ courseId: fixtures.course.id });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('returns 401 with malformed token', async () => {
    const res = await request(app)
      .get('/labs')
      .query({ courseId: fixtures.course.id })
      .set('Authorization', 'Bearer invalid-token-garbage');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('returns 401 with expired token', async () => {
    const jwt = require('jsonwebtoken');
    const expiredToken = jwt.sign(
      { userId: 'test', institutionId: 'test', role: 'student', canvasUserId: 'c1', name: 'X' },
      'dev_jwt_secret_change_in_production',
      { expiresIn: '-1s' }
    );

    const res = await request(app)
      .get('/labs')
      .query({ courseId: fixtures.course.id })
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('expired');
  });
});

// ─── GET /labs ──────────────────────────────────────────────────

describe('GET /labs', () => {
  it('returns labs for the course when authenticated as instructor', async () => {
    const res = await request(app)
      .get('/labs')
      .query({ courseId: fixtures.course.id })
      .set('Authorization', `Bearer ${instToken}`);

    expect(res.status).toBe(200);
    expect(res.body.labs).toBeInstanceOf(Array);
    expect(res.body.labs.length).toBeGreaterThanOrEqual(1);
    expect(res.body.total).toBe(res.body.labs.length);

    const lab = res.body.labs[0];
    expect(lab).toHaveProperty('id');
    expect(lab).toHaveProperty('title');
    expect(lab).toHaveProperty('animal');
    expect(lab.animal).toHaveProperty('commonName');
    expect(lab).toHaveProperty('_count');
    expect(lab._count).toHaveProperty('structures');
  });

  it('returns only published labs for students', async () => {
    // Create an unpublished lab
    const { prisma } = require('../config/database');
    const unpubLab = await prisma.lab.create({
      data: {
        courseId: fixtures.course.id,
        title: 'Unpublished Lab',
        animalId: fixtures.animal.id,
        organSystems: ['cardiovascular'],
        labType: 'identification',
        settings: {},
        rubric: {},
        maxPoints: 50,
        isPublished: false,
        createdBy: fixtures.instructorUser.id,
      },
    });

    const res = await request(app)
      .get('/labs')
      .query({ courseId: fixtures.course.id })
      .set('Authorization', `Bearer ${studToken}`);

    expect(res.status).toBe(200);
    const labIds = res.body.labs.map((l: any) => l.id);
    expect(labIds).not.toContain(unpubLab.id);

    // Instructor should see it
    const instRes = await request(app)
      .get('/labs')
      .query({ courseId: fixtures.course.id })
      .set('Authorization', `Bearer ${instToken}`);

    const instLabIds = instRes.body.labs.map((l: any) => l.id);
    expect(instLabIds).toContain(unpubLab.id);

    // Cleanup
    await prisma.lab.delete({ where: { id: unpubLab.id } });
  });

  it('returns 400 without courseId query param', async () => {
    const res = await request(app)
      .get('/labs')
      .set('Authorization', `Bearer ${instToken}`);

    expect(res.status).toBe(400);
  });
});

// ─── POST /labs ─────────────────────────────────────────────────

describe('POST /labs', () => {
  let createdLabId: string | null = null;

  afterEach(async () => {
    if (createdLabId) {
      const { prisma } = require('../config/database');
      await prisma.labStructure.deleteMany({ where: { labId: createdLabId } });
      await prisma.lab.delete({ where: { id: createdLabId } });
      createdLabId = null;
    }
  });

  it('creates a lab as instructor', async () => {
    const res = await request(app)
      .post('/labs')
      .set('Authorization', `Bearer ${instToken}`)
      .send({
        courseId: fixtures.course.id,
        title: 'New Test Lab',
        instructions: 'Test instructions',
        animalId: fixtures.animal.id,
        organSystems: ['cardiovascular'],
        labType: 'identification',
        maxPoints: 50,
        structureIds: fixtures.structures.map(s => s.id),
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('New Test Lab');
    expect(res.body.structures).toHaveLength(fixtures.structures.length);
    createdLabId = res.body.id;
  });

  it('returns 403 when student tries to create a lab', async () => {
    const res = await request(app)
      .post('/labs')
      .set('Authorization', `Bearer ${studToken}`)
      .send({
        courseId: fixtures.course.id,
        title: 'Student Lab',
        animalId: fixtures.animal.id,
        organSystems: ['cardiovascular'],
        labType: 'identification',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('returns 400 with invalid body (missing required fields)', async () => {
    const res = await request(app)
      .post('/labs')
      .set('Authorization', `Bearer ${instToken}`)
      .send({ title: 'Missing Fields' });

    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent course', async () => {
    const res = await request(app)
      .post('/labs')
      .set('Authorization', `Bearer ${instToken}`)
      .send({
        courseId: '00000000-0000-0000-0000-000000000000',
        title: 'Bad Course Lab',
        animalId: fixtures.animal.id,
        organSystems: ['cardiovascular'],
        labType: 'identification',
      });

    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent animal', async () => {
    const res = await request(app)
      .post('/labs')
      .set('Authorization', `Bearer ${instToken}`)
      .send({
        courseId: fixtures.course.id,
        title: 'Bad Animal Lab',
        animalId: '00000000-0000-0000-0000-000000000000',
        organSystems: ['cardiovascular'],
        labType: 'identification',
      });

    expect(res.status).toBe(404);
  });
});

// ─── GET /labs/:id ──────────────────────────────────────────────

describe('GET /labs/:id', () => {
  it('returns full lab detail with structures and animal models', async () => {
    const res = await request(app)
      .get(`/labs/${fixtures.lab.id}`)
      .set('Authorization', `Bearer ${instToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(fixtures.lab.id);
    expect(res.body.title).toBe('Cat Cardiovascular Lab');
    expect(res.body).toHaveProperty('animal');
    expect(res.body.animal).toHaveProperty('models');
    expect(res.body.animal.models).toBeInstanceOf(Array);
    expect(res.body.animal.models.length).toBeGreaterThanOrEqual(1);
    expect(res.body.animal.models[0]).toHaveProperty('modelFileUrl');
    expect(res.body).toHaveProperty('structures');
    expect(res.body.structures).toHaveLength(3);
    expect(res.body).toHaveProperty('course');
    expect(res.body).toHaveProperty('_count');
  });

  it('student can see a published lab', async () => {
    const res = await request(app)
      .get(`/labs/${fixtures.lab.id}`)
      .set('Authorization', `Bearer ${studToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(fixtures.lab.id);
  });

  it('returns 404 for non-existent lab', async () => {
    const res = await request(app)
      .get('/labs/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${instToken}`);

    expect(res.status).toBe(404);
  });

  it('student cannot see unpublished lab', async () => {
    const { prisma } = require('../config/database');
    const unpubLab = await prisma.lab.create({
      data: {
        courseId: fixtures.course.id,
        title: 'Hidden Lab',
        animalId: fixtures.animal.id,
        organSystems: ['cardiovascular'],
        labType: 'identification',
        settings: {},
        rubric: {},
        maxPoints: 50,
        isPublished: false,
        createdBy: fixtures.instructorUser.id,
      },
    });

    const res = await request(app)
      .get(`/labs/${unpubLab.id}`)
      .set('Authorization', `Bearer ${studToken}`);

    expect(res.status).toBe(404);

    await prisma.lab.delete({ where: { id: unpubLab.id } });
  });
});

// ─── PUT /labs/:id ──────────────────────────────────────────────

describe('PUT /labs/:id', () => {
  it('updates lab title as instructor', async () => {
    const res = await request(app)
      .put(`/labs/${fixtures.lab.id}`)
      .set('Authorization', `Bearer ${instToken}`)
      .send({ title: 'Updated Lab Title' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Lab Title');

    // Restore original title
    await request(app)
      .put(`/labs/${fixtures.lab.id}`)
      .set('Authorization', `Bearer ${instToken}`)
      .send({ title: 'Cat Cardiovascular Lab' });
  });

  it('returns 403 when student tries to update', async () => {
    const res = await request(app)
      .put(`/labs/${fixtures.lab.id}`)
      .set('Authorization', `Bearer ${studToken}`)
      .send({ title: 'Hacked Title' });

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent lab', async () => {
    const res = await request(app)
      .put('/labs/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${instToken}`)
      .send({ title: 'Ghost Lab' });

    expect(res.status).toBe(404);
  });

  it('can update structures list', async () => {
    const res = await request(app)
      .put(`/labs/${fixtures.lab.id}`)
      .set('Authorization', `Bearer ${instToken}`)
      .send({
        structureIds: [fixtures.structures[0].id, fixtures.structures[1].id],
      });

    expect(res.status).toBe(200);
    expect(res.body.structures).toHaveLength(2);

    // Restore all 3
    await request(app)
      .put(`/labs/${fixtures.lab.id}`)
      .set('Authorization', `Bearer ${instToken}`)
      .send({
        structureIds: fixtures.structures.map(s => s.id),
      });
  });
});

// ─── POST /labs/:id/publish ─────────────────────────────────────

describe('POST /labs/:id/publish', () => {
  let unpubLabId: string;

  beforeEach(async () => {
    const { prisma } = require('../config/database');
    const unpubLab = await prisma.lab.create({
      data: {
        courseId: fixtures.course.id,
        title: 'Publish Me',
        animalId: fixtures.animal.id,
        organSystems: ['cardiovascular'],
        labType: 'identification',
        settings: {},
        rubric: {},
        maxPoints: 50,
        isPublished: false,
        createdBy: fixtures.instructorUser.id,
        structures: {
          create: [{ structureId: fixtures.structures[0].id, orderIndex: 0 }],
        },
      },
    });
    unpubLabId = unpubLab.id;
  });

  afterEach(async () => {
    const { prisma } = require('../config/database');
    await prisma.labStructure.deleteMany({ where: { labId: unpubLabId } });
    await prisma.lab.delete({ where: { id: unpubLabId } }).catch(() => {});
  });

  it('publishes a lab with structures', async () => {
    const res = await request(app)
      .post(`/labs/${unpubLabId}/publish`)
      .set('Authorization', `Bearer ${instToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('published');
    expect(res.body.lab.isPublished).toBe(true);
  });

  it('returns 400 when lab has no structures', async () => {
    const { prisma } = require('../config/database');
    // Remove structures
    await prisma.labStructure.deleteMany({ where: { labId: unpubLabId } });

    const res = await request(app)
      .post(`/labs/${unpubLabId}/publish`)
      .set('Authorization', `Bearer ${instToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('no structures');
  });

  it('returns 400 when lab is already published', async () => {
    // Publish first
    await request(app)
      .post(`/labs/${unpubLabId}/publish`)
      .set('Authorization', `Bearer ${instToken}`);

    // Try again
    const res = await request(app)
      .post(`/labs/${unpubLabId}/publish`)
      .set('Authorization', `Bearer ${instToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('already published');
  });

  it('returns 403 for students', async () => {
    const res = await request(app)
      .post(`/labs/${unpubLabId}/publish`)
      .set('Authorization', `Bearer ${studToken}`);

    expect(res.status).toBe(403);
  });
});

// ─── DELETE /labs/:id ───────────────────────────────────────────

describe('DELETE /labs/:id', () => {
  it('deletes a lab as instructor', async () => {
    const { prisma } = require('../config/database');
    const toDelete = await prisma.lab.create({
      data: {
        courseId: fixtures.course.id,
        title: 'Delete Me',
        animalId: fixtures.animal.id,
        organSystems: ['cardiovascular'],
        labType: 'identification',
        settings: {},
        rubric: {},
        maxPoints: 50,
        isPublished: false,
        createdBy: fixtures.instructorUser.id,
      },
    });

    const res = await request(app)
      .delete(`/labs/${toDelete.id}`)
      .set('Authorization', `Bearer ${instToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');

    // Verify it's gone
    const check = await prisma.lab.findUnique({ where: { id: toDelete.id } });
    expect(check).toBeNull();
  });

  it('returns 403 for students', async () => {
    const res = await request(app)
      .delete(`/labs/${fixtures.lab.id}`)
      .set('Authorization', `Bearer ${studToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent lab', async () => {
    const res = await request(app)
      .delete('/labs/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${instToken}`);

    expect(res.status).toBe(404);
  });
});

// ─── GET /labs/:id/results ──────────────────────────────────────

describe('GET /labs/:id/results', () => {
  it('returns results for staff', async () => {
    const res = await request(app)
      .get(`/labs/${fixtures.lab.id}/results`)
      .set('Authorization', `Bearer ${instToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('lab');
    expect(res.body.lab.id).toBe(fixtures.lab.id);
    expect(res.body).toHaveProperty('attempts');
    expect(res.body.attempts).toBeInstanceOf(Array);
  });

  it('returns 403 for students', async () => {
    const res = await request(app)
      .get(`/labs/${fixtures.lab.id}/results`)
      .set('Authorization', `Bearer ${studToken}`);

    expect(res.status).toBe(403);
  });

  it('TAs can access results', async () => {
    const taTkn = taToken();
    const res = await request(app)
      .get(`/labs/${fixtures.lab.id}/results`)
      .set('Authorization', `Bearer ${taTkn}`);

    expect(res.status).toBe(200);
  });
});

// ─── GET /labs/:id/grades ───────────────────────────────────────

describe('GET /labs/:id/grades', () => {
  it('returns grades for staff', async () => {
    const res = await request(app)
      .get(`/labs/${fixtures.lab.id}/grades`)
      .set('Authorization', `Bearer ${instToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('lab');
    expect(res.body).toHaveProperty('grades');
    expect(res.body).toHaveProperty('total');
  });

  it('returns 403 for students', async () => {
    const res = await request(app)
      .get(`/labs/${fixtures.lab.id}/grades`)
      .set('Authorization', `Bearer ${studToken}`);

    expect(res.status).toBe(403);
  });
});
