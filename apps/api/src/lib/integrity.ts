import { Session } from '../types';

export type IntegrityFlag =
  | 'FAST_RESPONSE'
  | 'STRUCTURED_CODE_PASTE'
  | 'SUDDEN_QUALITY_SPIKE'
  | 'IMPLAUSIBLE_LENGTH';

/**
 * Analyses an incoming answer against session history to detect
 * possible AI-assisted responses or copy-paste behaviour.
 * Returns an array of flags (empty = clean).
 */
export function checkIntegrity(session: Session, answer: string, elapsedMs: number): IntegrityFlag[] {
  const flags: IntegrityFlag[] = [];
  if (answer.length > 50 && elapsedMs < 4000) flags.push('FAST_RESPONSE');
  if (answer.length > 800 && /```/.test(answer)) flags.push('STRUCTURED_CODE_PASTE');
  const prev = session.turns.filter(t => t.role === 'user').map(t => t.content.length);
  if (prev.length > 2) {
    const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
    if (avg < 80 && answer.length > 500) flags.push('SUDDEN_QUALITY_SPIKE');
  }
  if (answer.length > 1500) flags.push('IMPLAUSIBLE_LENGTH');
  return flags;
}

/**
 * Returns a summary of integrity flags across the entire session.
 * Used in the final verdict to inform the scoring engine.
 */
export function summariseIntegrityFlags(session: Session): string[] {
  const allFlags = session.turns.flatMap(t => t.integrityFlags || []);
  return Array.from(new Set(allFlags));
}
