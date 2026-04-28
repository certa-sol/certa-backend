import { supabase } from './client';
import { SessionType, Currency, Session, Turn } from '../types';

/**
 * Creates a new session.
 */
export async function createSession(data: {
  wallet: string;
  type: SessionType;
  paymentSignature?: string;
  currency?: Currency;
}): Promise<Session> {
  const { data: result, error } = await supabase
    .from('sessions')
    .insert([{ ...data, payment_signature: data.paymentSignature, currency: data.currency }])
    .select()
    .single();
  if (error) throw error;
  return mapSession(result);
}

/**
 * Gets a session by ID.
 */
export async function getSession(id: string): Promise<Session | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapSession(data);
}

/**
 * Appends a turn to the session using the Supabase RPC function.
 */
export async function appendTurn(id: string, turn: Turn): Promise<void> {
  const { error } = await supabase.rpc('append_turn', {
    session_id: id,
    turn,
  });
  if (error) throw error;
}

/**
 * Updates a session with partial fields.
 */
export async function updateSession(id: string, updates: Partial<Session>): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

/**
 * Gets any active session for this wallet of this type.
 */
export async function getActiveSessionByWallet(wallet: string, type: SessionType): Promise<Session | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('wallet', wallet)
    .eq('type', type)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapSession(data);
}

function mapSession(row: any): Session {
  return {
    id: row.id,
    wallet: row.wallet,
    type: row.type,
    status: row.status,
    turns: row.turns,
    verdict: row.verdict,
    score: row.score,
    scores: row.scores,
    gaps: row.gaps,
    resources: row.resources,
    summary: row.summary,
    integrityFlags: row.integrity_flags,
    paymentSignature: row.payment_signature,
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
