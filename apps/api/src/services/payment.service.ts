import { Connection, PublicKey } from '@solana/web3.js';
import { config } from '../config';
import { isSignatureUsed, recordSignature } from '../db/payments';
import { Currency } from '../types';

export type PaymentErrorCode =
  | 'TX_NOT_FOUND'
  | 'TX_FAILED'
  | 'SIGNATURE_ALREADY_USED'
  | 'WRONG_RECIPIENT'
  | 'INSUFFICIENT_AMOUNT'
  | 'INVALID_TOKEN_MINT';

export class PaymentVerificationError extends Error {
  code: PaymentErrorCode;
  constructor(code: PaymentErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Verifies that a Solana transaction signature represents a valid
 * flat-fee payment to the Certa treasury wallet.
 * @throws PaymentVerificationError with a descriptive message on failure
 */
export async function verifyPayment(
  signature: string,
  walletAddress: string,
  currency: Currency
): Promise<void> {
  const conn = new Connection(config.HELIUS_RPC, 'confirmed');
  const tx = await conn.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
  if (!tx) throw new PaymentVerificationError('TX_NOT_FOUND', 'Transaction not found');
  if (tx.meta?.err) throw new PaymentVerificationError('TX_FAILED', 'Transaction failed');
  if (await isSignatureUsed(signature)) throw new PaymentVerificationError('SIGNATURE_ALREADY_USED', 'Signature already used');

  const treasury = config.TREASURY_WALLET;
  let valid = false;
  let amount = 0;

  if (currency === 'SOL') {
    for (const ix of tx.transaction.message.instructions) {
      if ('parsed' in ix && ix.parsed?.type === 'transfer') {
        const info = ix.parsed.info;
        if (info.destination === treasury && info.source === walletAddress) {
          amount = Number(info.lamports) / 1e9;
          if (amount >= config.ASSESSMENT_FEE_SOL) valid = true;
        }
      }
    }
    if (!valid) throw new PaymentVerificationError('WRONG_RECIPIENT', 'Recipient or amount invalid');
  } else if (currency === 'USDC') {
        for (const ix of tx.transaction.message.instructions) {
            if ('parsed' in ix && ix.parsed?.type === 'transfer' && ix.program === 'spl-token') {
            const info = ix.parsed.info
            if (info.authority !== walletAddress) continue

            // Fetch destination token account to verify owner + mint
            const destAccountInfo = await conn.getParsedAccountInfo(new PublicKey(info.destination))
            const destData = (destAccountInfo.value?.data as any)?.parsed?.info
            if (!destData) continue
            if (destData.mint !== config.USDC_MINT) {
                throw new PaymentVerificationError('INVALID_TOKEN_MINT', 'Wrong token mint')
            }
            if (destData.owner !== treasury) continue  // not our treasury ATA

            amount = Number(info.amount)
            if (amount >= config.ASSESSMENT_FEE_USDC) {
                valid = true
                break
            }
        }
        if (!valid) throw new PaymentVerificationError('INSUFFICIENT_AMOUNT', 'Insufficient USDC payment')
        }
    if (!valid) throw new PaymentVerificationError('INVALID_TOKEN_MINT', 'Token mint or recipient invalid');
  }
  if (!valid) throw new PaymentVerificationError('INSUFFICIENT_AMOUNT', 'Insufficient payment amount');
  await recordSignature({ signature, wallet: walletAddress, currency });
}
