import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { verifyPayment } from '../services/payment.service';

const router = Router();

const verifySchema = z.object({
  signature: z.string(),
  currency: z.enum(['SOL', 'USDC']),
});

router.post('/verify', authenticate, async (req, res) => {
  try {
    const { signature, currency } = verifySchema.parse(req.body);
    const wallet = (req as any).wallet;
    await verifyPayment(signature, wallet, currency);
    res.json({ verified: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export { router as paymentRouter };
