import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { instructorOnly, staffOnly, anyRole } from '../middleware/roles';
import { validate, validateQuery, validateParams } from '../middleware/validate';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ─── Validation Schemas ──────────────────────────────────────

const labIdParams = z.object({
  id: z.string().min(1, 'Lab ID is required'),
});

const listLabsQuery = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
});

const createLabSchema = z.object({
  courseId: z.string().uuid('Invalid course ID'),
  title: z.string().min(1, 'Title is required').max(255),
  instructions: z.string().optional(),
  animalId: z.string().uuid('Invalid animal ID'),
  organSystems: z.array(z.string()).min(1, 'At least one organ system is required'),
  labType: z.enum(['identification', 'dissection', 'quiz', 'practical']),
  settings: z.record(z.unknown()).optional().default({}),
  rubric: z.record(z.unknown()).optional().default({}),
  dueDate: z.string().datetime().optional(),
  maxPoints: z.number().positive().optional().default(100),
  structureIds: z.array(z.string().uuid()).optional().default([]),
});

const updateLabSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  instructions: z.string().optional(),
  organSystems: z.array(z.string()).optional(),
  labType: z.enum(['identification', 'dissection', 'quiz', 'practical']).optional(),
  settings: z.record(z.unknown()).optional(),
  rubric: z.record(z.unknown()).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  maxPoints: z.number().positive().optional(),
  structureIds: z.array(z.string().uuid()).optional(),
});

// ─── GET /labs?courseId= ──────────────────────────────────────
/**
 * List labs for a given course.
 * Students see only published labs; staff see all.
 */
router.get(
  '/',
  authenticate,
  anyRole,
  validateQuery(listLabsQuery),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { courseId } = req.query as z.infer<typeof listLabsQuery>;
      const isStaff = ['instructor', 'ta', 'admin'].includes(req.user!.role);

      const where: any = { courseId };
      if (!isStaff) {
        where.isPublished = true;
      }

      const labs = await prisma.lab.findMany({
        where,
        include: {
          animal: {
            select: { id: true, commonName: true, thumbnailUrl: true },
          },
          _count: {
            select: { structures: true, attempts: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        labs,
        total: labs.length,
      });
    } catch (error: any) {
      console.error('[Labs] List error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── POST /labs ──────────────────────────────────────────────
/**
 * Create a new lab. Instructors and admins only.
 */
router.post(
  '/',
  authenticate,
  instructorOnly,
  validate(createLabSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        courseId, title, instructions, animalId, organSystems,
        labType, settings, rubric, dueDate, maxPoints, structureIds,
      } = req.body;

      // Verify the course exists and belongs to the user's institution
      const course = await prisma.course.findFirst({
        where: {
          id: courseId,
          institutionId: req.user!.institutionId,
        },
      });

      if (!course) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Course not found or not in your institution.',
        });
        return;
      }

      // Verify animal exists
      const animal = await prisma.animal.findUnique({
        where: { id: animalId },
      });

      if (!animal) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Animal not found.',
        });
        return;
      }

      // Create lab with optional structure assignments
      const lab = await prisma.lab.create({
        data: {
          courseId,
          title,
          instructions,
          animalId,
          organSystems,
          labType,
          settings: settings as any,
          rubric: rubric as any,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          maxPoints,
          createdBy: req.user!.userId,
          structures: structureIds.length > 0
            ? {
                create: structureIds.map((structureId: string, index: number) => ({
                  structureId,
                  orderIndex: index,
                })),
              }
            : undefined,
        },
        include: {
          animal: {
            select: { id: true, commonName: true, thumbnailUrl: true },
          },
          structures: {
            include: {
              structure: {
                select: { id: true, name: true, latinName: true, difficultyLevel: true },
              },
            },
            orderBy: { orderIndex: 'asc' },
          },
        },
      });

      console.log(`[Labs] Created lab "${title}" (${lab.id}) by user ${req.user!.userId}`);
      res.status(201).json(lab);
    } catch (error: any) {
      console.error('[Labs] Create error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── GET /labs/:id ───────────────────────────────────────────
/**
 * Get full lab detail including rubric and structures.
 */
router.get(
  '/:id',
  authenticate,
  anyRole,
  validateParams(labIdParams),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const lab = await prisma.lab.findUnique({
        where: { id: req.params.id },
        include: {
          animal: {
            include: {
              models: {
                where: { isPublished: true },
                orderBy: { layerOrder: 'asc' },
                select: {
                  id: true,
                  organSystem: true,
                  modelFileUrl: true,
                  layerOrder: true,
                  version: true,
                },
              },
            },
          },
          course: {
            select: { id: true, name: true, institutionId: true },
          },
          structures: {
            include: {
              structure: true,
            },
            orderBy: { orderIndex: 'asc' },
          },
          _count: {
            select: { attempts: true },
          },
        },
      });

      if (!lab) {
        res.status(404).json({
          error: 'Not Found',
          message: `Lab with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      // Students can only see published labs
      if (req.user!.role === 'student' && !lab.isPublished) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Lab not found.',
        });
        return;
      }

      res.json(lab);
    } catch (error: any) {
      console.error('[Labs] Get error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── PUT /labs/:id ───────────────────────────────────────────
/**
 * Update a lab. Instructors and admins only.
 * Cannot update a lab that has already been submitted.
 */
router.put(
  '/:id',
  authenticate,
  instructorOnly,
  validateParams(labIdParams),
  validate(updateLabSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existingLab = await prisma.lab.findUnique({
        where: { id: req.params.id },
        include: {
          course: { select: { institutionId: true } },
          _count: { select: { attempts: true } },
        },
      });

      if (!existingLab) {
        res.status(404).json({
          error: 'Not Found',
          message: `Lab with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      // Ensure the lab belongs to the user's institution
      if (existingLab.course.institutionId !== req.user!.institutionId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You cannot modify labs from another institution.',
        });
        return;
      }

      const { structureIds, dueDate, ...updateData } = req.body;

      // Build the update payload
      const data: any = { ...updateData };
      if (dueDate !== undefined) {
        data.dueDate = dueDate ? new Date(dueDate) : null;
      }

      // If structureIds provided, replace the existing lab structures
      if (structureIds !== undefined) {
        // Delete existing structures and recreate
        await prisma.labStructure.deleteMany({
          where: { labId: req.params.id },
        });

        if (structureIds.length > 0) {
          await prisma.labStructure.createMany({
            data: structureIds.map((structureId: string, index: number) => ({
              labId: req.params.id,
              structureId,
              orderIndex: index,
            })),
          });
        }
      }

      const lab = await prisma.lab.update({
        where: { id: req.params.id },
        data,
        include: {
          animal: {
            select: { id: true, commonName: true, thumbnailUrl: true },
          },
          structures: {
            include: {
              structure: {
                select: { id: true, name: true, latinName: true, difficultyLevel: true },
              },
            },
            orderBy: { orderIndex: 'asc' },
          },
        },
      });

      console.log(`[Labs] Updated lab "${lab.title}" (${lab.id})`);
      res.json(lab);
    } catch (error: any) {
      console.error('[Labs] Update error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── DELETE /labs/:id ────────────────────────────────────────
/**
 * Delete a lab. Instructors and admins only.
 * Warning: cascading delete removes all attempts and responses.
 */
router.delete(
  '/:id',
  authenticate,
  instructorOnly,
  validateParams(labIdParams),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const lab = await prisma.lab.findUnique({
        where: { id: req.params.id },
        include: {
          course: { select: { institutionId: true } },
          _count: { select: { attempts: true } },
        },
      });

      if (!lab) {
        res.status(404).json({
          error: 'Not Found',
          message: `Lab with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      if (lab.course.institutionId !== req.user!.institutionId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You cannot delete labs from another institution.',
        });
        return;
      }

      // Delete lab structures first (cascading delete on attempts handled by Prisma)
      await prisma.labStructure.deleteMany({
        where: { labId: req.params.id },
      });

      await prisma.lab.delete({
        where: { id: req.params.id },
      });

      console.log(`[Labs] Deleted lab "${lab.title}" (${req.params.id}) — ${lab._count.attempts} attempts removed`);
      res.json({ message: 'Lab deleted successfully.', deletedAttempts: lab._count.attempts });
    } catch (error: any) {
      console.error('[Labs] Delete error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── POST /labs/:id/publish ──────────────────────────────────
/**
 * Publish a lab, making it visible to students.
 * Validates that the lab has at least one structure assigned.
 */
router.post(
  '/:id/publish',
  authenticate,
  instructorOnly,
  validateParams(labIdParams),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const lab = await prisma.lab.findUnique({
        where: { id: req.params.id },
        include: {
          course: { select: { institutionId: true } },
          _count: { select: { structures: true } },
        },
      });

      if (!lab) {
        res.status(404).json({
          error: 'Not Found',
          message: `Lab with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      if (lab.course.institutionId !== req.user!.institutionId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You cannot publish labs from another institution.',
        });
        return;
      }

      if (lab._count.structures === 0) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Cannot publish a lab with no structures assigned. Add at least one structure first.',
        });
        return;
      }

      if (lab.isPublished) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Lab is already published.',
        });
        return;
      }

      const updatedLab = await prisma.lab.update({
        where: { id: req.params.id },
        data: { isPublished: true },
      });

      console.log(`[Labs] Published lab "${updatedLab.title}" (${updatedLab.id})`);
      res.json({ message: 'Lab published successfully.', lab: updatedLab });
    } catch (error: any) {
      console.error('[Labs] Publish error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── GET /labs/:id/results ───────────────────────────────────
/**
 * Get class results for a lab — instructor/staff only.
 * Returns all attempts with student info and scores.
 */
router.get(
  '/:id/results',
  authenticate,
  staffOnly,
  validateParams(labIdParams),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const lab = await prisma.lab.findUnique({
        where: { id: req.params.id },
        select: { id: true, title: true, maxPoints: true, courseId: true },
      });

      if (!lab) {
        res.status(404).json({
          error: 'Not Found',
          message: `Lab with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      const attempts = await prisma.labAttempt.findMany({
        where: { labId: req.params.id },
        include: {
          student: {
            select: { id: true, name: true, email: true, canvasUserId: true },
          },
          _count: {
            select: { responses: true },
          },
        },
        orderBy: [
          { student: { name: 'asc' } },
          { attemptNumber: 'asc' },
        ],
      });

      // Compute summary stats
      const gradedAttempts = attempts.filter(a => a.status === 'graded');
      const scores = gradedAttempts
        .map(a => Number(a.percentage || 0))
        .filter(s => !isNaN(s));

      const stats = scores.length > 0
        ? {
            count: scores.length,
            average: scores.reduce((a, b) => a + b, 0) / scores.length,
            median: scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)],
            min: Math.min(...scores),
            max: Math.max(...scores),
          }
        : null;

      res.json({
        lab: { id: lab.id, title: lab.title, maxPoints: lab.maxPoints },
        attempts,
        stats,
      });
    } catch (error: any) {
      console.error('[Labs] Results error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── GET /labs/:id/grades ────────────────────────────────────
/**
 * Get all grades for a lab — instructor/staff only.
 * Returns summarized grade data for the grade center view.
 */
router.get(
  '/:id/grades',
  authenticate,
  staffOnly,
  validateParams(labIdParams),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const lab = await prisma.lab.findUnique({
        where: { id: req.params.id },
        select: { id: true, title: true, maxPoints: true },
      });

      if (!lab) {
        res.status(404).json({
          error: 'Not Found',
          message: `Lab with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      const attempts = await prisma.labAttempt.findMany({
        where: {
          labId: req.params.id,
          status: { in: ['submitted', 'graded'] },
        },
        include: {
          student: {
            select: { id: true, name: true, email: true, canvasUserId: true },
          },
          syncLogs: {
            orderBy: { syncedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { student: { name: 'asc' } },
      });

      const grades = attempts.map(attempt => ({
        attemptId: attempt.id,
        studentId: attempt.student.id,
        studentName: attempt.student.name,
        studentEmail: attempt.student.email,
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        score: attempt.score,
        percentage: attempt.percentage,
        maxPoints: lab.maxPoints,
        submittedAt: attempt.submittedAt,
        gradedAt: attempt.gradedAt,
        canvasSyncStatus: attempt.syncLogs[0]?.canvasStatus || 'not_synced',
        lastSyncAt: attempt.syncLogs[0]?.syncedAt || null,
      }));

      res.json({
        lab: { id: lab.id, title: lab.title, maxPoints: lab.maxPoints },
        grades,
        total: grades.length,
      });
    } catch (error: any) {
      console.error('[Labs] Grades error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── GET /labs/:id/analytics — Per-structure analytics ────────
router.get(
  '/:id/analytics',
  authenticate,
  staffOnly,
  validateParams(labIdParams),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const lab = await prisma.lab.findUnique({
        where: { id: req.params.id },
        select: { id: true, title: true, maxPoints: true },
      });

      if (!lab) {
        res.status(404).json({
          error: 'Not Found',
          message: `Lab with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      // Query 1: All attempts (any status) for overview stats
      const allAttempts = await prisma.labAttempt.findMany({
        where: { labId: req.params.id },
        select: {
          id: true,
          status: true,
          score: true,
          percentage: true,
          timeSpentSeconds: true,
          submittedAt: true,
        },
      });

      // Query 2: Graded attempts with per-structure responses
      const gradedAttempts = await prisma.labAttempt.findMany({
        where: { labId: req.params.id, status: 'graded' },
        select: {
          id: true,
          percentage: true,
          timeSpentSeconds: true,
          submittedAt: true,
          responses: {
            select: {
              structureId: true,
              isCorrect: true,
              hintsUsed: true,
              timeSpentSeconds: true,
            },
          },
        },
      });

      // Query 3: Structure names for this lab
      const labStructures = await prisma.labStructure.findMany({
        where: { labId: req.params.id },
        select: {
          structureId: true,
          structure: {
            select: {
              id: true,
              name: true,
              latinName: true,
              difficultyLevel: true,
            },
          },
        },
      });

      // ─── Overview stats ───────────────────────────────────
      const totalAttempts = allAttempts.length;
      const gradedCount = gradedAttempts.length;
      const submittedOrGraded = allAttempts.filter(
        a => a.status === 'submitted' || a.status === 'graded'
      ).length;

      const percentages = gradedAttempts
        .map(a => Number(a.percentage))
        .filter(p => !isNaN(p))
        .sort((a, b) => a - b);

      const averageScore = percentages.length > 0
        ? Math.round(percentages.reduce((s, p) => s + p, 0) / percentages.length * 10) / 10
        : 0;

      const medianScore = percentages.length > 0
        ? percentages.length % 2 === 0
          ? Math.round((percentages[percentages.length / 2 - 1] + percentages[percentages.length / 2]) / 2 * 10) / 10
          : percentages[Math.floor(percentages.length / 2)]
        : 0;

      const timesSeconds = gradedAttempts
        .map(a => a.timeSpentSeconds)
        .filter((t): t is number => t !== null);
      const averageTimeSeconds = timesSeconds.length > 0
        ? Math.round(timesSeconds.reduce((s, t) => s + t, 0) / timesSeconds.length)
        : null;

      const completionRate = totalAttempts > 0
        ? Math.round(submittedOrGraded / totalAttempts * 1000) / 10
        : 0;

      // ─── Structure breakdown ──────────────────────────────
      const structureMap = new Map<string, {
        name: string;
        latinName: string | null;
        difficultyLevel: string;
        correct: number;
        total: number;
        totalHints: number;
        totalTime: number;
        timeCount: number;
      }>();

      // Initialize from lab structures
      for (const ls of labStructures) {
        structureMap.set(ls.structureId, {
          name: ls.structure.name,
          latinName: ls.structure.latinName,
          difficultyLevel: ls.structure.difficultyLevel,
          correct: 0,
          total: 0,
          totalHints: 0,
          totalTime: 0,
          timeCount: 0,
        });
      }

      // Aggregate responses
      for (const attempt of gradedAttempts) {
        for (const resp of attempt.responses) {
          const entry = structureMap.get(resp.structureId);
          if (!entry) continue;
          entry.total++;
          if (resp.isCorrect) entry.correct++;
          entry.totalHints += resp.hintsUsed;
          if (resp.timeSpentSeconds !== null) {
            entry.totalTime += resp.timeSpentSeconds;
            entry.timeCount++;
          }
        }
      }

      const structureBreakdown = Array.from(structureMap.entries()).map(
        ([structureId, stats]) => ({
          structureId,
          name: stats.name,
          latinName: stats.latinName,
          difficultyLevel: stats.difficultyLevel,
          totalAttempts: stats.total,
          correctCount: stats.correct,
          accuracy: stats.total > 0
            ? Math.round(stats.correct / stats.total * 1000) / 10
            : 0,
          avgHintsUsed: stats.total > 0
            ? Math.round(stats.totalHints / stats.total * 100) / 100
            : 0,
          avgTimeSeconds: stats.timeCount > 0
            ? Math.round(stats.totalTime / stats.timeCount)
            : null,
        })
      );

      // ─── Score distribution (10-point buckets) ────────────
      const buckets: Record<string, number> = {};
      for (let i = 0; i <= 90; i += 10) {
        buckets[`${i}-${i + 9}`] = 0;
      }
      buckets['100'] = 0;

      for (const pct of percentages) {
        if (pct === 100) {
          buckets['100']++;
        } else {
          const bucket = Math.floor(pct / 10) * 10;
          const key = `${bucket}-${bucket + 9}`;
          if (key in buckets) buckets[key]++;
        }
      }

      const scoreDistribution = Object.entries(buckets).map(([range, count]) => ({
        range,
        count,
      }));

      // ─── Score trend (grouped by day) ─────────────────────
      const dailyGroups: Record<string, number[]> = {};
      for (const attempt of gradedAttempts) {
        if (!attempt.submittedAt) continue;
        const day = new Date(attempt.submittedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        if (!dailyGroups[day]) dailyGroups[day] = [];
        dailyGroups[day].push(Number(attempt.percentage));
      }

      const scoreTrend = Object.entries(dailyGroups).map(([date, scores]) => ({
        date,
        average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        count: scores.length,
      }));

      res.json({
        lab: { id: lab.id, title: lab.title, maxPoints: lab.maxPoints },
        overview: {
          totalAttempts,
          gradedAttempts: gradedCount,
          averageScore,
          medianScore,
          averageTimeSeconds,
          completionRate,
        },
        structureBreakdown,
        scoreDistribution,
        scoreTrend,
      });
    } catch (error: any) {
      console.error('[Labs] Analytics error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
