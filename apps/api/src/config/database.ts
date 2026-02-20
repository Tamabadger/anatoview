import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

/**
 * Connect to PostgreSQL and verify the connection.
 * Called once during server bootstrap.
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('[Database] Connected to PostgreSQL');
  } catch (error) {
    console.error('[Database] Failed to connect:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown — disconnect Prisma.
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log('[Database] Disconnected');
}
