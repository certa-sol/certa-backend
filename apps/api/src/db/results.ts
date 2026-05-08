import { supabase } from './client';
import { Result, InsertResultData } from '../types';

/**
 * Inserts a new result row.
 * Throws if sessionId already has a result (unique constraint).
 */
export async function insertResult(data: InsertResultData): Promise<Result> {
  const { data: result, error } = await supabase
    .from('results')
    .insert({
      session_id: data.sessionId,
      wallet: data.wallet,
      type: data.type,
      verdict: data.verdict,
      score: data.score,
      topic_scores: data.topicScores,
      gaps: data.gaps,
      resources: data.resources,
      strengths: data.strengths,
      summary: data.summary,
      integrity_flags: data.integrityFlags,
      completed_at: data.completedAt.toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return mapResult(result);
}

/**
 * Returns all results for a wallet, ordered by completedAt descending.
 */
export async function getResultsByWallet(wallet: string): Promise<Result[]> {
  const { data, error } = await supabase
    .from('results')
    .select('*')
    .eq('wallet', wallet)
    .order('completed_at', { ascending: false });
  if (error) throw error;
  return data.map(mapResult);
}

/**
 * Returns the result for a specific session, or null if not yet complete.
 */
export async function getResultBySession(sessionId: string): Promise<Result | null> {
  const { data, error } = await supabase
    .from('results')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapResult(data);
}

function mapResult(data: any): Result {
  return {
    id: data.id,
    sessionId: data.session_id,
    wallet: data.wallet,
    type: data.type,
    verdict: data.verdict,
    score: data.score,
    topicScores: data.topic_scores,
    gaps: data.gaps,
    resources: data.resources,
    strengths: data.strengths,
    summary: data.summary,
    integrityFlags: data.integrity_flags,
    completedAt: data.completed_at,
  };
}