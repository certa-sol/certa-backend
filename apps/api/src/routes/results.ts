import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { getResultsByWallet } from '../db/results';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const wallet = (req as any).wallet;
    const results = await getResultsByWallet(wallet);
    const responseResults = results.map(({ wallet: _, ...result }) => result);
    res.json({ results: responseResults });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as resultsRouter };