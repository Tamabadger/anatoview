import { createServer } from 'http';
import { app } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { initializeLTI } from './config/lti';
import { registerLtiHandlers } from './routes/lti';
import { initSocketIO } from './config/socket';

const PORT = process.env.PORT || 3001;

let httpServer: import('http').Server | null = null;

/**
 * Race a promise against a timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Bootstrap the AnatoView API server.
 *
 * Order matters:
 *   1. Connect to PostgreSQL (Prisma)
 *   2. Connect to Redis (sessions, refresh tokens, job queue)
 *   3. Initialize LTI 1.3 provider (ltijs) and mount on Express — optional
 *   4. Register LTI launch/deep-linking handlers
 *   5. Start listening
 */
async function bootstrap(): Promise<void> {
  console.log('─────────────────────────────────────────');
  console.log('  AnatoView API — Starting...');
  console.log('─────────────────────────────────────────');

  // 1. Database
  await connectDatabase();

  // 2. Redis
  await connectRedis();

  // 3. LTI Provider (optional — only if Canvas credentials are configured)
  const hasLtiCredentials =
    process.env.LTI_CLIENT_ID &&
    process.env.LTI_CLIENT_ID !== 'your_canvas_client_id' &&
    process.env.LTI_DB_URL;

  if (hasLtiCredentials) {
    try {
      await withTimeout(initializeLTI(app), 10000, 'LTI initialization');
    } catch (error: any) {
      console.warn('[LTI] Initialization failed (API will work without LTI):');
      console.warn(`[LTI]   ${error.message}`);
    }
  } else {
    console.log('[LTI] Skipped — no Canvas credentials configured.');
    console.log('[LTI] Set LTI_CLIENT_ID, CANVAS_BASE_URL, and LTI_DB_URL to enable.');
  }

  // 4. LTI Handlers (only registers if LTI was initialized)
  registerLtiHandlers();

  // 5. Create HTTP server and attach Socket.IO
  httpServer = createServer(app);
  initSocketIO(httpServer);

  // 6. Start server
  httpServer.listen(PORT, () => {
    console.log('─────────────────────────────────────────');
    console.log(`  AnatoView API running on port ${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  Health: http://localhost:${PORT}/health`);
    console.log('─────────────────────────────────────────');
  });
}

// ─── Graceful Shutdown ──────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  if (httpServer) {
    httpServer.close();
  }
  await disconnectDatabase();
  await disconnectRedis();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ─── Start ──────────────────────────────────────────────────────

bootstrap().catch((error) => {
  console.error('Fatal error during bootstrap:', error);
  process.exit(1);
});
