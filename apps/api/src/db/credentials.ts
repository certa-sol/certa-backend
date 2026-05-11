import { supabase } from './client';
import { Credential } from '../types';

/**
 * Creates a new credential record.
 */
export async function createCredential(data: {
  wallet: string;
  sessionId: string;
  mintAddress: string;
  score: number;
}): Promise<Credential> {
  const { data: result, error } = await supabase
    .from('credentials')
    .insert([{ ...data, session_id: data.sessionId, mint_address: data.mintAddress }])
    .select()
    .single();
  if (error) throw error;
  return {
    id: result.id,
    wallet: result.wallet,
    sessionId: result.session_id,
    mintAddress: result.mint_address,
    score: result.score,
    issuedAt: result.issued_at,
  };
}

/**
 * Gets a credential by wallet address.
 */
export async function getCredentialByWallet(wallet: string): Promise<Credential | null> {
  const { data, error } = await supabase
    .from('credentials')
    .select('*')
    .eq('wallet', wallet)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    wallet: data.wallet,
    sessionId: data.session_id,
    mintAddress: data.mint_address,
    score: data.score,
    issuedAt: data.issued_at,
  };
}

/**
 * Gets a credential by mint address.
 */
export async function getCredentialByMint(mintAddress: string): Promise<Credential | null> {
  const { data, error } = await supabase
    .from('credentials')
    .select('*')
    .eq('mint_address', mintAddress)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    wallet: data.wallet,
    sessionId: data.session_id,
    mintAddress: data.mint_address,
    score: data.score,
    issuedAt: data.issued_at,
  };
}

/**
 * Lists credentials with optional filters and pagination.
 */
export async function listCredentials(filters?: {
  minScore?: number;
  limit?: number;
  offset?: number;
}): Promise<Credential[]> {
  let query = supabase.from('credentials').select('*', { count: 'exact' });
  if (filters?.minScore !== undefined) {
    query = query.gte('score', filters.minScore);
  }
  const limit = filters?.limit ?? 20;
  const offset = filters?.offset ?? 0;
  query = query.range(offset, offset + limit - 1);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    wallet: row.wallet,
    sessionId: row.session_id,
    mintAddress: row.mint_address,
    score: row.score,
    issuedAt: row.issued_at,
  }));
}

/**
 * Lists all credentials for a specific wallet address.
 */
export async function listCredentialsByWallet(wallet: string): Promise<Credential[]> {
  const { data, error } = await supabase
    .from('credentials')
    .select('*')
    .eq('wallet', wallet)
    .order('issued_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    wallet: row.wallet,
    sessionId: row.session_id,
    mintAddress: row.mint_address,
    score: row.score,
    issuedAt: row.issued_at,
  }));
}