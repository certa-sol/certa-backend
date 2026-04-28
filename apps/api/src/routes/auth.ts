import { Router } from 'express';
import { z } from 'zod';
import { generateChallenge, verifyWalletSignature, issueJWT } from '../lib/auth';
import { setCachedSession, getCachedSession } from '../lib/cache';
import { config } from '../config';
import { redis } from '../lib/cache';

const router = Router();

const challengeSchema = z.object({ walletAddress: z.string() });
const verifySchema = z.object({ walletAddress: z.string(), signature: z.string(), challenge: z.string() });

router.post('/challenge', async (req, res) => {
  try {
    const { walletAddress } = challengeSchema.parse(req.body);
    const challenge = generateChallenge(walletAddress);
    await redis.set(`challenge:${walletAddress}`, challenge, 'EX', 300);
    res.json({ challenge });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { walletAddress, signature, challenge } = verifySchema.parse(req.body);
    const expected = await redis.get(`challenge:${walletAddress}`);
    if (!expected || expected !== challenge) throw new Error('Invalid or expired challenge');
    if (!verifyWalletSignature(walletAddress, challenge, signature)) throw new Error('Invalid signature');
    const token = issueJWT(walletAddress);
    res.json({ token });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export { router as authRouter };
