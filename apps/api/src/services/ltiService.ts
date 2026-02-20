import { prisma } from '../config/database';
import { lti } from '../config/lti';
import { GradePassbackResult } from '../types';

/**
 * Send a graded attempt's score to Canvas via LTI 1.3 AGS (Assignment and Grade Services).
 *
 * Uses ltijs Provider.Grade.ScorePublish() which handles the OAuth2 token exchange
 * with Canvas and posts the score to the correct line item.
 *
 * Creates a GradeSyncLog entry regardless of success or failure.
 */
export async function sendGradeToCanvas(attemptId: string): Promise<GradePassbackResult> {
  const attempt = await prisma.labAttempt.findUnique({
    where: { id: attemptId },
    include: {
      lab: true,
      student: {
        include: { institution: true },
      },
    },
  });

  if (!attempt) {
    throw new Error(`Attempt not found: ${attemptId}`);
  }

  if (!attempt.score && attempt.score !== 0) {
    throw new Error(`Attempt ${attemptId} has no score — grade it first.`);
  }

  if (!attempt.ltiOutcomeUrl) {
    console.warn(`[LTI] Attempt ${attemptId} has no ltiOutcomeUrl — skipping Canvas sync.`);

    await prisma.gradeSyncLog.create({
      data: {
        attemptId,
        canvasStatus: 'skipped',
        canvasResponse: { reason: 'No LTI outcome URL on attempt' } as any,
      },
    });

    return {
      success: false,
      status: 0,
      attemptId,
      message: 'No LTI outcome URL — this attempt was not launched via Canvas.',
    };
  }

  try {
    // Build the AGS score payload per IMS Global spec
    const scorePayload = {
      userId: attempt.student.canvasUserId,
      scoreGiven: Number(attempt.score),
      scoreMaximum: Number(attempt.lab.maxPoints),
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      timestamp: new Date().toISOString(),
    };

    console.log(`[LTI] Sending grade for attempt ${attemptId}: ${scorePayload.scoreGiven}/${scorePayload.scoreMaximum}`);

    // ltijs handles the OAuth2 token exchange and POSTs the score to Canvas
    // The token is retrieved from the LTI launch context stored by ltijs
    const scoreResult = await lti.Grade.ScorePublish(
      attempt.ltiOutcomeUrl,  // The line item URL from the LTI launch
      scorePayload
    );

    const status = scoreResult?.status || 200;
    const success = status >= 200 && status < 300;

    // Log the result
    await prisma.gradeSyncLog.create({
      data: {
        attemptId,
        canvasStatus: success ? 'success' : 'failed',
        canvasResponse: (scoreResult || { status }) as any,
      },
    });

    console.log(`[LTI] Grade sync ${success ? 'succeeded' : 'failed'} for attempt ${attemptId} (HTTP ${status})`);

    return {
      success,
      status,
      attemptId,
      message: success ? 'Grade synced to Canvas.' : `Canvas returned HTTP ${status}`,
    };
  } catch (error: any) {
    console.error(`[LTI] Grade sync error for attempt ${attemptId}:`, error.message);

    // Log the failure
    await prisma.gradeSyncLog.create({
      data: {
        attemptId,
        canvasStatus: 'error',
        canvasResponse: {
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        } as any,
      },
    });

    return {
      success: false,
      status: 0,
      attemptId,
      message: `Grade sync failed: ${error.message}`,
    };
  }
}

/**
 * Get the sync history for an attempt.
 */
export async function getGradeSyncLogs(attemptId: string) {
  return prisma.gradeSyncLog.findMany({
    where: { attemptId },
    orderBy: { syncedAt: 'desc' },
  });
}
