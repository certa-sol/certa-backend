import { Request, Response, NextFunction } from 'express';
import pino from 'pino';

const logger = pino();

/**
 * Global Express error handler. Logs error and returns structured JSON.
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error({
    err,
    errKeys: Object.keys(err),
    status: err.status,
    statusCode: err.statusCode,
    message: err.message,
    stack: err.stack,
  });
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = process.env.NODE_ENV === 'production' ? 'An error occurred.' : (err.message || 'Unknown error');
  res.status(status).json({ error: message, code, status });
}
