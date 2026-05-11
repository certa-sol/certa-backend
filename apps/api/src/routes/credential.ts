import { Router } from 'express';
import { z } from 'zod';
import { getCredentialByMint, listCredentials, listCredentialsByWallet } from '../db/credentials';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.get('/wallet/:walletAddress', authenticate, async (req, res) => {
  try {
    const wallet = (req as any).wallet;
    const { walletAddress } = req.params;
    if (wallet !== walletAddress) return res.status(403).json({ error: 'Forbidden' });
    const credentials = await listCredentialsByWallet(walletAddress);
    res.json({ credentials });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/:mintAddress', async (req, res) => {
  try {
    const { mintAddress } = req.params;
    const credential = await getCredentialByMint(mintAddress);
    if (!credential) return res.status(404).json({ error: 'Credential not found' });
    res.json({
      credential,
      verifyUrl: `https://certa.xyz/verify/${credential.wallet}`,
      solscanUrl: `https://solscan.io/token/${credential.mintAddress}`,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const minScore = req.query.minScore ? Number(req.query.minScore) : undefined;
    let limit = req.query.limit ? Number(req.query.limit) : 20;
    let offset = req.query.offset ? Number(req.query.offset) : 0;
    if (limit > 100) limit = 100;
    const credentials = await listCredentials({ minScore, limit, offset });
    res.json({ credentials, total: credentials.length, hasMore: credentials.length === limit });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export { router as credentialRouter };
