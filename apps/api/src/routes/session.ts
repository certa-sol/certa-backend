import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { diagnosticCreateLimit, assessmentCreateLimit, turnSubmitLimit } from '../middleware/rateLimit';
import { createDiagnosticSession, createAssessmentSession, submitTurn } from '../services/session.service';
import { getSession } from '../db/sessions';

const router = Router();

router.post('/diagnostic', authenticate, diagnosticCreateLimit, async (req, res) => {
  try {
    const wallet = (req as any).wallet;
    const result = await createDiagnosticSession(wallet);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

const assessmentSchema = z.object({
  paymentSignature: z.string(),
  currency: z.enum(['SOL', 'USDC']),
});

router.post('/assessment', authenticate, assessmentCreateLimit, async (req, res) => {
  try {
    const wallet = (req as any).wallet;
    const { paymentSignature, currency } = assessmentSchema.parse(req.body);
    const result = await createAssessmentSession({ wallet, paymentSignature, currency });
    res.json(result);
  } catch (e: any) {
    if (e.message === 'PAYMENT_REQUIRED' || e.message === 'SIGNATURE_ALREADY_USED') {
      res.status(402).json({ error: e.message });
    } else if (e.message === 'INTERNAL_ERROR') {
      res.status(500).json({ error: e.message });
    } else {
      res.status(400).json({ error: e.message });
    }
  }
});

const turnSchema = z.object({
  answer: z.string(),
  elapsedMs: z.number(),
});

router.post('/:id/turn', authenticate, turnSubmitLimit, async (req, res) => {
  try {
    const wallet = (req as any).wallet;
    const { id } = req.params;
    const { answer, elapsedMs } = turnSchema.parse(req.body);
    const result = await submitTurn(id, wallet, answer, elapsedMs);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/:id/result', authenticate, async (req, res) => {
  try {
    const wallet = (req as any).wallet;
    const { id } = req.params;
    const session = await getSession(id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.wallet !== wallet) return res.status(403).json({ error: 'Forbidden' });
    res.json(session);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export { router as sessionRouter };
