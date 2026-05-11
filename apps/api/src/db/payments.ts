import { supabase } from './client';
import { Currency, PaymentStatus } from '../types';

/**
 * Checks if a payment signature has already been used (replay protection).
 * @param signature - Solana transaction signature
 * @returns true if used, false otherwise
 */
export async function isSignatureUsed(signature: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('payment_signatures')
      .select('signature')
      .eq('signature', signature)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  } catch {
    return false;
  }
}

/**
 * Records a payment signature to prevent replay.
 * @param data - { signature, wallet, currency }
 */
export async function recordSignature(data: {
  signature: string;
  wallet: string;
  currency: Currency;
}): Promise<void> {
  await supabase.from('payment_signatures').insert([data]);
}

/**
 * Creates or updates a payment record.
 * @param data - payment data
 */
export async function createPaymentRecord(data: {
  signature: string;
  walletAddress: string;
  currency: Currency;
  status: PaymentStatus;
  verifiedAt: Date;
  consumedAt?: Date;
}): Promise<void> {
  const { error } = await supabase
    .from('payments')
    .upsert(
      {
        signature: data.signature,
        wallet_address: data.walletAddress,
        currency: data.currency,
        status: data.status,
        verified_at: data.verifiedAt.toISOString(),
        consumed_at: data.consumedAt?.toISOString() || null,
      },
      { onConflict: 'signature' }
    );
  if (error) throw error;
}

/**
 * Gets a payment record by signature.
 */
export async function getPaymentRecord(signature: string): Promise<{
  signature: string;
  walletAddress: string;
  currency: Currency;
  status: PaymentStatus;
  verifiedAt: string;
  consumedAt: string | null;
} | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('signature', signature)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    signature: data.signature,
    walletAddress: data.wallet_address,
    currency: data.currency,
    status: data.status as PaymentStatus,
    verifiedAt: data.verified_at,
    consumedAt: data.consumed_at,
  };
}

/**
 * Updates a payment record status to consumed.
 * @param signature - the signature to update
 * @param consumedAt - timestamp
 */
export async function consumePayment(signature: string, consumedAt: Date): Promise<void> {
  const { error } = await supabase
    .from('payments')
    .update({ status: 'consumed', consumed_at: consumedAt.toISOString() })
    .eq('signature', signature);
  if (error) throw error;
}

/**
 * Gets a verified (unconsumed) payment for a wallet, if one exists.
 */
export async function getUnconsumedPaymentByWallet(walletAddress: string): Promise<{
  signature: string;
  walletAddress: string;
  currency: Currency;
  status: PaymentStatus;
  verifiedAt: string;
  consumedAt: string | null;
} | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('wallet_address', walletAddress)
    .eq('status', 'verified')
    .order('verified_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    signature: data.signature,
    walletAddress: data.wallet_address,
    currency: data.currency,
    status: data.status as PaymentStatus,
    verifiedAt: data.verified_at,
    consumedAt: data.consumed_at,
  };
}
