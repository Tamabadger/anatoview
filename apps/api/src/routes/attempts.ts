import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { anyRole, staffOnly } from '../middleware/roles';
import { validate, validateParams } from '../middleware/validate';
import { AuthenticatedRequest } from '../types';
import { gradeAttempt, overrideResponseGrade, recalculateAttemptScore } from '../services/gradingService';
import { getIO } from '../config/socket';

const router = Router();

// ─── Validation Schemas ──────────────────────────────────────

const labIdParams = z.object({
  id: z.string().min(1, 'Lab ID is required'),
});

const attemptIdParams = z.object({
  id: z.string().min(1, 'Attempt ID is required'),
});

const bulkResponsesSchema = z.object({
  responses: z.array(
    z.object({
      structureId: z.string().uuid('Invalid structure ID'),
      studentAnswer: z.string().nullable().optional(),
      confidenceLevel: z.number().min(1).max(5).optional(),
      hintsUsed: z.number().min(0).optional().default(0),
      timeSpentSeconds: z.number().min(0).optional(),
    })
  ).min(1, 'At least one response is required'),
});

const gradeOverrideSchema = z.object({
  responseId: z.string().uuid('Invalid response ID'),
  overridePoints: z.number().min(0),
  feedback: z.string().optional(),
});

const eventBatchSchema = z.object({
  events: z.array(
    z.object({
      eventType: z.string().min(1),
      structureId: z.string().uuid().optional(),
      payload: z.record(z.unknown()).optional(),
    })
  ).min(1, 'At least one event is required'),
});

// ─── GET /labs/:id/attempt ───────────────────────────────────
/**
 * Get or create the current student's attempt for a lab.
 * If no attempt exists, creates one with status 'not_started'.
 */
router.get(
  '/labs/:id/attempt',
  authenticate,
  anyRole,
  validateParams(labIdParams),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const labId = req.params.id;
      const studentId = req.user!.userId;

      // Verify lab exists and is published
      const lab = await prisma.lab.findUnique({
        where: { id: labId },
        select: { id: true, title: true, isPublished: true, maxPoints: true },
      });

      if (!lab) {
        res.status(404).json({
          error: 'Not Found',
          message: `Lab with ID ${labId} does not exist.`,
        });
        return;
      }

      if (!lab.isPublished && req.user!.role === 'student') {
        res.status(404).json({
          error: 'Not Found',
          message: 'Lab not found.',
        });
        return;
      }

      // Find existing active attempt (not_started or in_progress)
      let attempt = await prisma.labAttempt.findFirst({
        where: {
          labId,
          studentId,
          status: { in: ['not_started', 'in_progress'] },
        },
        include: {
          responses: {
            include: {
              structure: {
                select: { id: true, name: true, latinName: true, hint: true },
              },
            },
          },
          _count: { select: { events: true } },
        },
        orderBy: { attemptNumber: 'desc' },
      });

      if (!attempt) {
        // Count previous attempts for this student/lab
        const previousCount = await prisma.labAttempt.count({
          where: { labId, studentId },
        });

        attempt = await prisma.labAttempt.create({
          data: {
            labId,
            studentId,
            attemptNumber: previousCount + 1,
            status: 'not_started',
          },
          include: {
            responses: {
              include: {
                structure: {
                  select: { id: true, name: true, latinName: true, hint: true },
                },
              },
            },
            _count: { select: { events: true } },
          },
        });

        console.log(`[Attempts] Created attempt #${attempt.attemptNumber} for student ${studentId} on lab ${labId}`);
      }

      res.json(attempt);
    } catch (error: any) {
      console.error('[Attempts] Get/create error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── POST /labs/:id/attempt/start ────────────────────────────
/**
 * Start the timer on an attempt (transition from not_started to in_progress).
 */
router.post(
  '/labs/:id/attempt/start',
  authenticate,
  anyRole,
  validateParams(labIdParams),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const labId = req.params.id;
      const studentId = req.user!.userId;

      const attempt = await prisma.labAttempt.findFirst({
        where: {
          labId,
          studentId,
          status: 'not_started',
        },
        orderBy: { attemptNumber: 'desc' },
      });

      if (!attempt) {
        res.status(404).json({
          error: 'Not Found',
          message: 'No unstarted attempt found. Get /labs/:id/attempt first.',
        });
        return;
      }

      const updated = await prisma.labAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'in_progress',
          startedAt: new Date(),
        },
      });

      console.log(`[Attempts] Started attempt ${updated.id} for student ${studentId}`);
      res.json(updated);
    } catch (error: any) {
      console.error('[Attempts] Start error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── POST /labs/:id/attempt/submit ───────────────────────────
/**
 * Submit an attempt for grading.
 * Triggers auto-grading pipeline and enqueues Canvas grade passback.
 */
router.post(
  '/labs/:id/attempt/submit',
  authenticate,
  anyRole,
  validateParams(labIdParams),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const labId = req.params.id;
      const studentId = req.user!.userId;

      const attempt = await prisma.labAttempt.findFirst({
        where: {
          labId,
          studentId,
          status: 'in_progress',
        },
        orderBy: { attemptNumber: 'desc' },
      });

      if (!attempt) {
        res.status(404).json({
          error: 'Not Found',
          message: 'No in-progress attempt found. Start an attempt first.',
        });
        return;
      }

      // Calculate time spent
      const timeSpentSeconds = attempt.startedAt
        ? Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000)
        : 0;

      // Mark as submitted
      await prisma.labAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'submitted',
          submittedAt: new Date(),
          timeSpentSeconds,
        },
      });

      // Run auto-grading
      const gradeResult = await gradeAttempt(attempt.id);

      // Fetch the fully graded attempt
      const gradedAttempt = await prisma.labAttempt.findUnique({
        where: { id: attempt.id },
        include: {
          responses: {
            include: {
              structure: {
                select: { id: true, name: true, latinName: true },
              },
            },
          },
        },
      });

      console.log(`[Attempts] Submitted & graded attempt ${attempt.id}: ${gradeResult.percentage}%`);

      // Emit real-time event to lab room
      getIO()?.to(`lab:${labId}`).emit('attempt:submitted', {
        attemptId: attempt.id,
        studentName: req.user!.name,
        score: gradeResult.totalScore,
        percentage: gradeResult.percentage,
      });

      res.json({
        attempt: gradedAttempt,
        gradeResult,
      });
    } catch (error: any) {
      console.error('[Attempts] Submit error:', error.message);
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  }
);

// ─── GET /attempts/:id ───────────────────────────────────────
/**
 * Get full attempt detail including all responses.
 * Students can only see their own attempts.
 */
router.get(
  '/attempts/:id',
  authenticate,
  anyRole,
  validateParams(attemptIdParams),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const attempt = await prisma.labAttempt.findUnique({
        where: { id: req.params.id },
        include: {
          lab: {
            select: { id: true, title: true, maxPoints: true, labType: true },
          },
          student: {
            select: { id: true, name: true, email: true },
          },
          responses: {
            include: {
              structure: true,
            },
          },
          events: {
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
          syncLogs: {
            orderBy: { syncedAt: 'desc' },
            take: 5,
          },
        },
      });

      if (!attempt) {
        res.status(404).json({
          error: 'Not Found',
          message: `Attempt with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      // Students can only view their own attempts
      if (
        req.user!.role === 'student' &&
        attempt.studentId !== req.user!.userId
      ) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You can only view your own attempts.',
        });
        return;
      }

      res.json(attempt);
    } catch (error: any) {
      console.error('[Attempts] Get detail error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── PUT /attempts/:id/grade ─────────────────────────────────
/**
 * Instructor grade override for a specific response.
 */
router.put(
  '/attempts/:id/grade',
  authenticate,
  staffOnly,
  validateParams(attemptIdParams),
  validate(gradeOverrideSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { responseId, overridePoints, feedback } = req.body;

      // Verify the attempt exists
      const attempt = await prisma.labAttempt.findUnique({
        where: { id: req.params.id },
        select: { id: true, status: true, labId: true },
      });

      if (!attempt) {
        res.status(404).json({
          error: 'Not Found',
          message: `Attempt with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      // Verify the response belongs to this attempt
      const response = await prisma.structureResponse.findFirst({
        where: {
          id: responseId,
          attemptId: req.params.id,
        },
      });

      if (!response) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Response not found in this attempt.',
        });
        return;
      }

      // Apply override
      await overrideResponseGrade(responseId, overridePoints);

      // Optionally update instructor feedback
      if (feedback) {
        await prisma.labAttempt.update({
          where: { id: req.params.id },
          data: { instructorFeedback: feedback },
        });
      }

      // Recalculate attempt totals
      const { totalScore, percentage } = await recalculateAttemptScore(req.params.id);

      console.log(`[Attempts] Instructor override on attempt ${req.params.id}: response ${responseId} → ${overridePoints} points`);

      // Emit real-time event to lab room
      getIO()?.to(`lab:${attempt.labId}`).emit('grade:updated', {
        attemptId: req.params.id,
        responseId,
      });

      res.json({
        message: 'Grade override applied.',
        attemptId: req.params.id,
        responseId,
        overridePoints,
        newTotalScore: totalScore,
        newPercentage: percentage,
      });
    } catch (error: any) {
      console.error('[Attempts] Grade override error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── POST /attempts/:id/responses ────────────────────────────
/**
 * Bulk upsert structure responses for an attempt.
 * Used as students work through the lab.
 */
router.post(
  '/attempts/:id/responses',
  authenticate,
  anyRole,
  validateParams(attemptIdParams),
  validate(bulkResponsesSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const attemptId = req.params.id;

      // Verify the attempt exists and belongs to this student
      const attempt = await prisma.labAttempt.findUnique({
        where: { id: attemptId },
        select: { id: true, studentId: true, status: true },
      });

      if (!attempt) {
        res.status(404).json({
          error: 'Not Found',
          message: `Attempt with ID ${attemptId} does not exist.`,
        });
        return;
      }

      if (attempt.studentId !== req.user!.userId && req.user!.role === 'student') {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You can only submit responses for your own attempts.',
        });
        return;
      }

      if (!['not_started', 'in_progress'].includes(attempt.status)) {
        res.status(400).json({
          error: 'Validation Error',
          message: `Cannot add responses to an attempt with status "${attempt.status}".`,
        });
        return;
      }

      const { responses } = req.body;

      // Upsert each response
      const upserted = await Promise.all(
        responses.map(async (resp: any) => {
          // Check if a response already exists for this attempt + structure
          const existing = await prisma.structureResponse.findFirst({
            where: {
              attemptId,
              structureId: resp.structureId,
            },
          });

          if (existing) {
            return prisma.structureResponse.update({
              where: { id: existing.id },
              data: {
                studentAnswer: resp.studentAnswer,
                confidenceLevel: resp.confidenceLevel,
                hintsUsed: resp.hintsUsed ?? existing.hintsUsed,
                timeSpentSeconds: resp.timeSpentSeconds,
              },
            });
          }

          return prisma.structureResponse.create({
            data: {
              attemptId,
              structureId: resp.structureId,
              studentAnswer: resp.studentAnswer,
              confidenceLevel: resp.confidenceLevel,
              hintsUsed: resp.hintsUsed ?? 0,
              timeSpentSeconds: resp.timeSpentSeconds,
            },
          });
        })
      );

      res.json({
        message: `${upserted.length} responses saved.`,
        responses: upserted,
      });
    } catch (error: any) {
      console.error('[Attempts] Responses upsert error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── GET /attempts/:id/responses ─────────────────────────────
/**
 * Get all responses for an attempt.
 */
router.get(
  '/attempts/:id/responses',
  authenticate,
  anyRole,
  validateParams(attemptIdParams),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const attempt = await prisma.labAttempt.findUnique({
        where: { id: req.params.id },
        select: { id: true, studentId: true },
      });

      if (!attempt) {
        res.status(404).json({
          error: 'Not Found',
          message: `Attempt with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      // Students can only view their own
      if (req.user!.role === 'student' && attempt.studentId !== req.user!.userId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You can only view your own responses.',
        });
        return;
      }

      const responses = await prisma.structureResponse.findMany({
        where: { attemptId: req.params.id },
        include: {
          structure: {
            select: { id: true, name: true, latinName: true, hint: true, difficultyLevel: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      res.json({
        attemptId: req.params.id,
        responses,
        total: responses.length,
      });
    } catch (error: any) {
      console.error('[Attempts] Get responses error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── POST /attempts/:id/events ───────────────────────────────
/**
 * Log a batch of interaction events (clicks, zooms, layer toggles, etc.).
 */
router.post(
  '/attempts/:id/events',
  authenticate,
  anyRole,
  validateParams(attemptIdParams),
  validate(eventBatchSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const attemptId = req.params.id;

      // Verify attempt exists and belongs to user
      const attempt = await prisma.labAttempt.findUnique({
        where: { id: attemptId },
        select: { id: true, studentId: true, status: true },
      });

      if (!attempt) {
        res.status(404).json({
          error: 'Not Found',
          message: `Attempt with ID ${attemptId} does not exist.`,
        });
        return;
      }

      if (attempt.studentId !== req.user!.userId && req.user!.role === 'student') {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You can only log events for your own attempts.',
        });
        return;
      }

      const { events } = req.body;

      const created = await prisma.dissectionEvent.createMany({
        data: events.map((event: any) => ({
          attemptId,
          eventType: event.eventType,
          structureId: event.structureId || null,
          payload: event.payload || null,
        })),
      });

      res.json({
        message: `${created.count} events logged.`,
        count: created.count,
      });
    } catch (error: any) {
      console.error('[Attempts] Events error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
