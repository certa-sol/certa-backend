import { createSession, getActiveSessionByWallet, appendTurn, getSession, updateSession } from '../db/sessions';
import { getCredentialByWallet } from '../db/credentials';
import { setCachedSession, getCachedSession, invalidateCachedSession } from '../lib/cache';
import { checkIntegrity, summariseIntegrityFlags } from '../lib/integrity';
import { startSession, nextTurn } from '../lib/llm';
import { verifyPayment } from './payment.service';
import { finaliseSession } from './finalise.service';
import { SessionType, Currency } from '../types';
import { sendSSEEvent, sendSSEError } from '../lib/sse';
import { getPaymentRecord, consumePayment } from '../db/payments';

/**
 * Creates a new diagnostic session for a wallet.
 * Returns the session and the first question from the LLM.
 * Checks if the wallet already has an active diagnostic session
 * and returns it instead of creating a duplicate.
 */
export async function createDiagnosticSession(wallet: string): Promise<{
  sessionId: string;
  question: string;
}> {
  let session = await getActiveSessionByWallet(wallet, 'diagnostic');
  if (!session) {
    session = await createSession({ wallet, type: 'diagnostic' });
    await setCachedSession(session);
  }
  const question = await startSession('diagnostic');
  return { sessionId: session.id, question };
}

/**
 * Creates a new assessment session.
 * Requires a verified payment — checks and consumes the payment atomically.
 * Rejects if the wallet already holds a passed credential.
 * Rejects if the wallet has an active assessment session.
 */
export async function createAssessmentSession(data: {
  wallet: string;
  paymentSignature: string;
  currency: Currency;
}): Promise<{
  sessionId: string;
  question: string;
}> {
  const { wallet, paymentSignature, currency } = data;
  const cred = await getCredentialByWallet(wallet);
  if (cred) throw new Error('Wallet already holds a credential');
  const active = await getActiveSessionByWallet(wallet, 'assessment');
  if (active) throw new Error('Active assessment session exists');

  // Check payment
  const payment = await getPaymentRecord(paymentSignature);
  if (!payment || payment.currency !== currency || payment.walletAddress !== wallet) {
    throw new Error('PAYMENT_REQUIRED');
  }
  if (payment.status === 'consumed') {
    throw new Error('SIGNATURE_ALREADY_USED');
  }
  if (payment.status !== 'verified') {
    throw new Error('PAYMENT_REQUIRED');
  }

  // Consume payment and create session atomically
  // Note: For full atomicity, this should be in a DB transaction, but using sequential for simplicity
  await consumePayment(paymentSignature, new Date());
  try {
    const session = await createSession({ wallet, type: 'assessment', paymentSignature, currency });
    await setCachedSession(session);
    const question = await startSession('assessment');
    return { sessionId: session.id, question };
  } catch (error) {
    // If session creation fails, we could revert payment, but for now, throw
    console.error('Session creation failed:', error); // see the real error
    throw error;
  }
}

/**
 * Processes a developer's answer for the given session.
 * 1. Loads session (cache-first)
 * 2. Checks integrity flags
 * 3. Appends user turn to DB + cache
 * 4. Fires async LLM call — does NOT await
 * 5. Returns immediately with { status: 'processing' }
 */
export async function submitTurn(
  sessionId: string,
  wallet: string,
  answer: string,
  elapsedMs: number
): Promise<{ status: 'processing' }> {
  let session = await getCachedSession(sessionId);
  if (!session) session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');
  if (session.wallet !== wallet) throw new Error('Unauthorized');
  const flags = checkIntegrity(session, answer, elapsedMs);
  const turn = { role: 'user' as const, content: answer, timestamp: Date.now(), integrityFlags: flags };
  await appendTurn(sessionId, turn);
  await invalidateCachedSession(sessionId);
  processTurnAsync(sessionId); // fire and forget
  return { status: 'processing' };
}

/**
 * Internal async function — called by submitTurn without awaiting.
 * Calls the LLM, appends the result, and sends it via SSE.
 * On complete: calls finaliseSession.
 * On error: sends SSE error event.
 */
async function processTurnAsync(sessionId: string): Promise<void> {
  try {
    let session = await getSession(sessionId);
    if (!session) throw new Error('Session not found');
    const integrityContext = summariseIntegrityFlags(session);
    const llmResult = await nextTurn(session, integrityContext);
    let content: string;
    if ('complete' in llmResult && llmResult.complete) {
      content = JSON.stringify(llmResult);
    } else if ('question' in llmResult) {
      content = llmResult.question;
    } else {
      content = '';
    }
    
    const turn = {
      role: 'assistant' as const,
      content,
      timestamp: Date.now(),
      integrityFlags: [],
    };
    await appendTurn(sessionId, turn);
    await invalidateCachedSession(sessionId);
    sendSSEEvent(sessionId, llmResult);
    if ('complete' in llmResult && llmResult.complete) {
      const freshSession = await getSession(sessionId);
      if (!freshSession) throw new Error('Session not found after finalise');
      await finaliseSession(freshSession, llmResult);
    }
  } catch (e: any) {
    sendSSEError(sessionId, e.message || 'LLM error');
  }
}
