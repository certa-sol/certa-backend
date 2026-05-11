import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { verifyPayment } from '../services/payment.service';
import { getUnconsumedPaymentByWallet } from '../db/payments';

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
    if (e.code === 'SIGNATURE_ALREADY_USED') {
      res.status(402).json({ error: e.message, code: e.code });
    } else {
      res.status(400).json({ error: e.message });
    }
  }
});

router.get('/status', authenticate, async (req, res) => {
  try {
    const wallet = (req as any).wallet;
    const payment = await getUnconsumedPaymentByWallet(wallet);
    res.json({
      hasPaidAssessment: !!payment,
      payment: payment
        ? {
            signature: payment.signature,
            currency: payment.currency,
            verifiedAt: payment.verifiedAt,
          }
        : null,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export { router as paymentRouter };
