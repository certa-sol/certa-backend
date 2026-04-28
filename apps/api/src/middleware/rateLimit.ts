import rateLimit from 'express-rate-limit';

import { redis } from '../lib/cache';
import RedisStore, { RedisReply } from 'rate-limit-redis';

/**
 * Per-wallet rate limiting using Redis store.
 */
export const diagnosticCreateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 100,
  keyGenerator: req => (req as any).wallet || '',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ sendCommand: (...args: [string, ...string[]]) => redis.call(...args) as Promise<any> }),
});

export const assessmentCreateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  keyGenerator: req => (req as any).wallet || '',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ sendCommand: (...args: [string, ...string[]]) => redis.call(...args) as Promise<any> }),
});

export const turnSubmitLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: req => (req as any).wallet || '',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ sendCommand: (...args: [string, ...string[]]) => redis.call(...args) as Promise<any> }),
});
