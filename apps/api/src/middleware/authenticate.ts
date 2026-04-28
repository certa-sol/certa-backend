import { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '../lib/auth';

/**
 * JWT bearer token middleware. Attaches req.wallet on success.
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = auth.slice(7);
  try {
    const payload = verifyJWT(token);
    (req as any).wallet = payload.wallet;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
