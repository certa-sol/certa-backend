import { supabase } from './client';
import { Currency } from '../types';

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
