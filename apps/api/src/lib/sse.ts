import { Response } from 'express';

export interface SSEClient {
  res: Response;
  connectedAt: number;
}

const clients = new Map<string, SSEClient>();

/**
 * Register a new SSE client for a session
 */
export function registerSSEClient(sessionId: string, res: Response): void {
  clients.set(sessionId, { res, connectedAt: Date.now() });
}

/**
 * Remove a client (called on connection close)
 */
export function removeSSEClient(sessionId: string): void {
  clients.delete(sessionId);
}

/**
 * Send an event to a session's connected client
 * Returns true if client was found and event sent, false otherwise
 */
export function sendSSEEvent(sessionId: string, data: object): boolean {
  const client = clients.get(sessionId);
  if (!client) return false;
  try {
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Send an error event and remove the client
 */
export function sendSSEError(sessionId: string, error: string): void {
  const client = clients.get(sessionId);
  if (client) {
    client.res.write(`event: error\ndata: ${JSON.stringify({ error })}\n\n`);
    client.res.end();
    clients.delete(sessionId);
  }
}

/**
 * Return count of active connections — used in health check
 */
export function activeConnectionCount(): number {
  return clients.size;
}
