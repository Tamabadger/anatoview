import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { staffOnly } from '../middleware/roles';
import { validateParams } from '../middleware/validate';
import { AuthenticatedRequest } from '../types';
import { sendGradeToCanvas, getGradeSyncLogs } from '../services/ltiService';
import { getGradeQueue } from '../services/gradeQueue';

const router = Router();

// ─── Validation Schemas ──────────────────────────────────────

const labIdParams = z.object({
  id: z.string().min(1, 'Lab ID is required'),
});

const attemptIdParams = z.object({
  attemptId: z.string().min(1, 'Attempt ID is required'),
});

// ─── POST /labs/:id/grades/sync ──────────────────────────────
/**
 * Sync ALL graded attempts for a lab to Canvas.
 * Enqueues a Bull job for each attempt. Staff only.
 */
router.post(
  '/labs/:id/grades/sync',
  authenticate,
  staffOnly,
  validateParams(labIdParams),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const labId = req.params.id;

      // Verify lab exists
      const lab = await prisma.lab.findUnique({
        where: { id: labId },
        select: { id: true, title: true },
      });

      if (!lab) {
        res.status(404).json({
          error: 'Not Found',
          message: `Lab with ID ${labId} does not exist.`,
        });
        return;
      }

      // Find all graded attempts for this lab
      const gradedAttempts = await prisma.labAttempt.findMany({
        where: {
          labId,
          status: 'graded',
        },
        select: { id: true },
      });

      if (gradedAttempts.length === 0) {
        res.json({
          message: 'No graded attempts to sync.',
          enqueuedCount: 0,
        });
        return;
      }

      // Enqueue a grade passback job for each attempt
      const gradeQueue = getGradeQueue();
      let enqueuedCount = 0;

      for (const attempt of gradedAttempts) {
        try {
          await gradeQueue.add(
            'grade-passback',
            { attemptId: attempt.id },
            {
              attempts: 3,
              backoff: { type: 'exponential', delay: 2000 },
              removeOnComplete: 100,
              removeOnFail: 50,
            }
          );
          enqueuedCount++;
        } catch (error: any) {
          console.warn(`[Grades] Failed to enqueue passback for attempt ${attempt.id}: ${error.message}`);
        }
      }

      console.log(`[Grades] Bulk sync: enqueued ${enqueuedCount}/${gradedAttempts.length} attempts for lab ${labId}`);

      res.json({
        message: `Enqueued ${enqueuedCount} grade passback jobs for "${lab.title}".`,
        enqueuedCount,
        totalGraded: gradedAttempts.length,
      });
    } catch (error: any) {
      console.error('[Grades] Bulk sync error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── POST /grades/:attemptId/sync ────────────────────────────
/**
 * Sync a single attempt's grade to Canvas.
 * Calls sendGradeToCanvas directly (synchronous, not queued).
 */
router.post(
  '/:attemptId/sync',
  authenticate,
  staffOnly,
  validateParams(attemptIdParams),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { attemptId } = req.params;

      // Verify attempt exists and is graded
      const attempt = await prisma.labAttempt.findUnique({
        where: { id: attemptId },
        select: { id: true, status: true, score: true },
      });

      if (!attempt) {
        res.status(404).json({
          error: 'Not Found',
          message: `Attempt with ID ${attemptId} does not exist.`,
        });
        return;
      }

      if (attempt.status !== 'graded') {
        res.status(400).json({
          error: 'Validation Error',
          message: `Cannot sync an attempt with status "${attempt.status}". Grade it first.`,
        });
        return;
      }

      const result = await sendGradeToCanvas(attemptId);

      console.log(`[Grades] Single sync for attempt ${attemptId}: ${result.success ? 'success' : 'failed'}`);

      res.json(result);
    } catch (error: any) {
      console.error('[Grades] Single sync error:', error.message);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
      });
    }
  }
);

// ─── GET /grades/:attemptId/sync-logs ────────────────────────
/**
 * Get the sync history for an attempt. Staff only.
 */
router.get(
  '/:attemptId/sync-logs',
  authenticate,
  staffOnly,
  validateParams(attemptIdParams),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { attemptId } = req.params;

      const logs = await getGradeSyncLogs(attemptId);

      res.json({
        attemptId,
        logs,
        total: logs.length,
      });
    } catch (error: any) {
      console.error('[Grades] Sync logs error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
