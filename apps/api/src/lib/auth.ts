import nacl from 'tweetnacl';
import bs58 from 'bs58';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JWTPayload } from '../types';

/**
 * Verifies a nacl signature produced by a Solana wallet.
 * @param walletAddress - base58 public key
 * @param message - the plaintext message that was signed
 * @param signature - base64-encoded signature
 * @returns true if valid
 */
export function verifyWalletSignature(
  walletAddress: string,
  message: string,
  signature: string
): boolean {
  try {
    const pubKey = bs58.decode(walletAddress);
    const msg = Buffer.from(message, 'utf8');
    const sig = Buffer.from(signature, 'base64');
    return nacl.sign.detached.verify(msg, sig, pubKey);
  } catch {
    return false;
  }
}

/**
 * Issues a signed JWT for the given wallet address.
 */
export function issueJWT(wallet: string): string {
  const payload: JWTPayload = {
    wallet,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + parseExpiry(config.JWT_EXPIRY),
  };
  return jwt.sign(payload, config.JWT_SECRET);
}

/**
 * Verifies and decodes a JWT. Throws if invalid or expired.
 */
export function verifyJWT(token: string): JWTPayload {
  return jwt.verify(token, config.JWT_SECRET) as JWTPayload;
}

/**
 * Generates a unique challenge string for the wallet to sign.
 * Includes timestamp to prevent replay.
 */
export function generateChallenge(wallet: string): string {
  return `Certa login for ${wallet} at ${Date.now()}`;
}

function parseExpiry(expiry: string): number {
  // Supports "24h", "1h", "3600s", "60m"
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 24 * 60 * 60; // default 24h
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 24 * 60 * 60;
    default: return 24 * 60 * 60;
  }
}
