import { Router } from 'express';
import { verifyJWT } from '../lib/auth';
import { registerSSEClient, removeSSEClient, activeConnectionCount } from '../lib/sse';

const router = Router();

router.get('/session/:id/stream', (req, res) => {
  try {
    const { id } = req.params;
    const token = req.query.token as string;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const payload = verifyJWT(token);
    // Set SSE headers
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders();
    registerSSEClient(id, res);
    const heartbeat = setInterval(() => {
      res.write(':heartbeat\n\n');
    }, 30000);
    res.on('close', () => {
      clearInterval(heartbeat);
      removeSSEClient(id);
    });
  } catch (e: any) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

export { router as streamRouter };
