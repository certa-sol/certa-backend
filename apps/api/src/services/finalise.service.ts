import { Session, LLMResult, AssessmentResult } from '../types';
import { updateSession } from '../db/sessions';
import { createCredential } from '../db/credentials';
import { mintCredential } from './mint.service';

/**
 * Called when a session reaches a verdict.
 * For diagnostic: saves result to DB.
 * For assessment:
 *   - Saves result to DB
 *   - If pass: calls mintCredential, saves credential record
 *   - If fail: saves result only
 */
export async function finaliseSession(
  session: Session,
  result: LLMResult
): Promise<void> {
  await updateSession(session.id, {
    verdict: result.verdict,
    score: 'score' in result ? result.score : undefined,
    scores: result.topicScores,
    gaps: result.gaps,
    resources: 'resources' in result ? result.resources : undefined,
    summary: result.summary,
    integrityFlags: 'integrityFlags' in result ? result.integrityFlags : undefined,
    status: 'complete',
  });
  if (result.type === 'assessment' && result.verdict === 'pass') {
    const mintAddress = await mintCredential(session, result as AssessmentResult);
    await createCredential({
      wallet: session.wallet,
      sessionId: session.id,
      mintAddress,
      score: result.score,
    });
  }
}
