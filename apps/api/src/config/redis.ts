import Redis from 'ioredis';

let redis: Redis | null = null;

/**
 * Get or create the singleton Redis connection.
 */
export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 3000);
        return delay;
      },
    });

    redis.on('connect', () => {
      console.log('[Redis] Connected');
    });

    redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });
  }

  return redis;
}

/**
 * Connect to Redis and verify the connection.
 * Called once during server bootstrap.
 */
export async function connectRedis(): Promise<void> {
  const client = getRedis();
  try {
    await client.ping();
    console.log('[Redis] Ping successful');
  } catch (error) {
    console.error('[Redis] Failed to connect:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown — disconnect Redis.
 */
export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    console.log('[Redis] Disconnected');
  }
}

// ─── Refresh Token Helpers ─────────────────────────────────────

const REFRESH_TOKEN_PREFIX = 'refresh_token:';
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Store a refresh token in Redis, keyed by userId.
 */
export async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const client = getRedis();
  await client.set(`${REFRESH_TOKEN_PREFIX}${userId}`, token, 'EX', REFRESH_TOKEN_TTL);
}

/**
 * Retrieve a stored refresh token for a user.
 */
export async function getRefreshToken(userId: string): Promise<string | null> {
  const client = getRedis();
  return client.get(`${REFRESH_TOKEN_PREFIX}${userId}`);
}

/**
 * Delete a stored refresh token (logout).
 */
export async function deleteRefreshToken(userId: string): Promise<void> {
  const client = getRedis();
  await client.del(`${REFRESH_TOKEN_PREFIX}${userId}`);
}
