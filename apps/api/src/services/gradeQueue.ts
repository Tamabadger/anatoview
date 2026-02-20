import Bull from 'bull';

let gradeQueue: Bull.Queue | null = null;

/**
 * Get or create the Bull queue for grade passback jobs.
 * This queue is shared between the API (producer) and the worker (consumer).
 */
export function getGradeQueue(): Bull.Queue {
  if (!gradeQueue) {
    gradeQueue = new Bull('grade-passback', process.env.REDIS_URL || 'redis://localhost:6379', {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    gradeQueue.on('error', (error) => {
      console.error('[GradeQueue] Error:', error.message);
    });
  }

  return gradeQueue;
}

/**
 * Graceful shutdown — close the queue connection.
 */
export async function closeGradeQueue(): Promise<void> {
  if (gradeQueue) {
    await gradeQueue.close();
    gradeQueue = null;
    console.log('[GradeQueue] Closed');
  }
}
