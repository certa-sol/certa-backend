import Redis from 'ioredis';
import { config } from '../config';
import { Session } from '../types';

const redis = new Redis(config.REDIS_URL);
const SESSION_TTL_SECONDS = 60 * 60 * 4; // 4 hours

/**
 * Returns parsed Session or null on miss or error. Never throws.
 */
export async function getCachedSession(id: string): Promise<Session | null> {
  try {
    const data = await redis.get(`session:${id}`);
    if (!data) return null;
    return JSON.parse(data) as Session;
  } catch {
    return null;
  }
}

/**
 * Sets session in cache with TTL. Never throws — cache failures are silent.
 */
export async function setCachedSession(session: Session): Promise<void> {
  try {
    await redis.set(`session:${session.id}`,
      JSON.stringify(session),
      'EX',
      SESSION_TTL_SECONDS
    );
  } catch {}
}

/**
 * Deletes session cache key. Never throws.
 */
export async function invalidateCachedSession(id: string): Promise<void> {
  try {
    await redis.del(`session:${id}`);
  } catch {}
}

/**
 * Returns true if Redis is reachable — used in health check.
 */
export async function ping(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

export { redis };
