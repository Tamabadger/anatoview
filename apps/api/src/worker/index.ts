import Bull from 'bull';
import { PrismaClient } from '@prisma/client';
import { sendGradeToCanvas } from '../services/ltiService';

// ─── Configuration ───────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '3', 10);

// Worker gets its own Prisma client (separate process from API)
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['warn', 'error'],
});

// ─── Grade Passback Queue ────────────────────────────────────

const gradeQueue = new Bull('grade-passback', REDIS_URL, {
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

console.log('─────────────────────────────────────────');
console.log('  AnatoView Worker — Starting...');
console.log(`  Redis: ${REDIS_URL}`);
console.log(`  Concurrency: ${CONCURRENCY}`);
console.log('─────────────────────────────────────────');

// ─── Job Processor ───────────────────────────────────────────

gradeQueue.process('grade-passback', CONCURRENCY, async (job) => {
  const { attemptId } = job.data;

  console.log(`[Worker] Processing grade passback for attempt ${attemptId} (job ${job.id})`);

  try {
    const result = await sendGradeToCanvas(attemptId);

    if (result.success) {
      console.log(`[Worker] ✓ Grade synced to Canvas for attempt ${attemptId}`);
    } else {
      console.warn(`[Worker] ✗ Grade sync returned non-success for attempt ${attemptId}: ${result.message}`);
      // If it's a "no outcome URL" case, don't retry
      if (result.status === 0 && result.message?.includes('No LTI outcome URL')) {
        return result; // Complete the job — nothing to retry
      }
    }

    return result;
  } catch (error: any) {
    console.error(`[Worker] Grade passback failed for attempt ${attemptId}:`, error.message);
    throw error; // Bull will retry based on job options
  }
});

// ─── Event Handlers ──────────────────────────────────────────

gradeQueue.on('completed', (job, result) => {
  console.log(`[Worker] Job ${job.id} completed:`, result?.success ? 'synced' : 'skipped');
});

gradeQueue.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts}):`, err.message);
});

gradeQueue.on('stalled', (job) => {
  console.warn(`[Worker] Job ${job.id} stalled — will be retried`);
});

gradeQueue.on('error', (error) => {
  console.error('[Worker] Queue error:', error.message);
});

// ─── Health Logging ──────────────────────────────────────────

async function logQueueHealth(): Promise<void> {
  try {
    const counts = await gradeQueue.getJobCounts();
    console.log(`[Worker] Queue health — waiting: ${counts.waiting}, active: ${counts.active}, completed: ${counts.completed}, failed: ${counts.failed}, delayed: ${counts.delayed}`);
  } catch (error: any) {
    console.error('[Worker] Could not fetch queue health:', error.message);
  }
}

// Log health every 60 seconds
const healthInterval = setInterval(logQueueHealth, 60000);

// Initial health log
logQueueHealth();

// ─── Graceful Shutdown ───────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Worker] ${signal} received — shutting down gracefully...`);

  clearInterval(healthInterval);

  try {
    await gradeQueue.close();
    console.log('[Worker] Queue closed');
  } catch (error: any) {
    console.error('[Worker] Error closing queue:', error.message);
  }

  try {
    await prisma.$disconnect();
    console.log('[Worker] Database disconnected');
  } catch (error: any) {
    console.error('[Worker] Error disconnecting database:', error.message);
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

console.log('[Worker] Ready — listening for grade-passback jobs');
