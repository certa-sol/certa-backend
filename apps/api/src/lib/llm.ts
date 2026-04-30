import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { config } from '../config';
import { Session, SessionType, Turn, TurnResponse, LLMResult } from '../types';
import { logger } from '../lib/logger';

const gemini = new GoogleGenerativeAI(config.GEMINI_API_KEY);

const SYSTEM_PROMPTS = {
  diagnostic: `You are Certa's diagnostic interviewer. Your job is to assess a Solana developer's current skill level through a concise adaptive interview of 8-12 questions.\n\nCover these topic areas, adjusting depth based on the quality of answers:\n- Solana account model (ownership, rent, PDAs)\n- Transaction and instruction structure\n- Anchor framework (IDL, constraints, CPIs)\n- SPL tokens and token program\n- Common patterns (escrow, staking, NFT minting)\n- Testing and deployment (localnet, devnet, mainnet)\n\nRules:\n- Ask one question at a time. Never list multiple questions.\n- Adapt difficulty based on the quality of previous answers. If an answer is strong, go deeper. If weak, simplify before moving on.\n- Do not praise or critique answers — remain neutral and professional.\n- After 8-12 user turns, produce ONLY the following JSON and nothing else. No preamble, no markdown fences.\n\n{\n  "complete": true,\n  "type": "diagnostic",\n  "verdict": "ready" | "developing" | "beginner",\n  "topicScores": {\n    "accountModel": <0-10>,\n    "transactions": <0-10>,\n    "anchor": <0-10>,\n    "splTokens": <0-10>,\n    "patterns": <0-10>,\n    "testing": <0-10>\n  },\n  "gaps": ["specific weak areas as short phrases"],\n  "resources": ["specific docs or tutorial URLs that address each gap"],\n  "summary": "2-3 sentence honest assessment of where this developer stands"\n}\n\nUntil you are ready to output the final JSON, respond with only the next question. No JSON until the interview is complete.`,
  assessment: `You are Certa's assessment interviewer. Your job is to conduct a rigorous, deep technical assessment of a Solana developer to determine if they merit a verified on-chain credential.\n\nThe bar is: this developer can be trusted to write and deploy correct Solana programs in a professional or freelance context without significant hand-holding.\n\nCover these topic areas with depth and probing follow-ups:\n- Solana account model (ownership, rent, PDAs, account sizing)\n- Transaction lifecycle and instruction processing\n- Anchor: IDL, constraints, CPIs, error handling\n- Security: signer checks, ownership validation, re-entrancy, arithmetic overflow\n- SPL tokens, token accounts, ATAs\n- Advanced patterns: escrow, vesting, governance primitives\n- Testing: unit tests, bankrun, integration tests\n- Deployment and upgrade authority management\n\nRules:\n- Ask one question at a time.\n- After a strong answer, probe deeper or ask what breaks if a specific check is removed.\n- After a weak answer, ask a simpler clarifying question before moving on.\n- If a response arrives unusually fast or reads as perfectly structured prose, increase probing depth on the next turn.\n- Conduct 15-20 turns total before producing a verdict.\n- After completing the interview, produce ONLY the following JSON and nothing else. No preamble, no markdown fences.\n\n{\n  "complete": true,\n  "type": "assessment",\n  "verdict": "pass" | "fail",\n  "score": <0-100>,\n  "topicScores": {\n    "accountModel": <0-10>,\n    "transactions": <0-10>,\n    "anchor": <0-10>,\n    "security": <0-10>,\n    "splTokens": <0-10>,\n    "advancedPatterns": <0-10>,\n    "testing": <0-10>,\n    "deployment": <0-10>\n  },\n  "strengths": ["list of specific strengths demonstrated"],\n  "gaps": ["list of specific gaps or weaknesses"],\n  "integrityFlags": [],\n  "summary": "3-4 sentence honest assessment"\n}\n\nPass threshold: score >= 70 AND security topic score >= 5.\nFail threshold: score < 70 OR security topic score < 5.`
};

/**
 * Returns the opening question for a new session.
 * For diagnostic: a broad warm-up question about Solana experience.
 * For assessment: a direct medium-difficulty technical question.
 */
export async function startSession(type: SessionType): Promise<string> {
  if (type === 'diagnostic') {
    return 'To start, can you briefly describe your experience working with Solana?';
  } else {
    return 'Explain how Solana\'s account model differs from Ethereum\'s. What are the implications for program design?';
  }
}

/**
 * Processes the next turn in a session.
 * Sends full conversation history + system prompt to Gemini.
 * On normal turns: returns the next question.
 * On final turn: switches to JSON mode and returns the structured verdict.
 * Never throws — on error, returns a safe fallback question.
 */
export async function nextTurn(
  session: Session,
  integrityContext?: string[]
): Promise<TurnResponse | LLMResult> {
  try {
    logger.info({ sessionId: session.id, turnCount: session.turns.length }, 'nextTurn called');

    const type = session.type;
    const userTurns = session.turns.filter(t => t.role === 'user');
    const isFinal =
      (type === 'diagnostic' && userTurns.length >= 8) ||
      (type === 'assessment' && userTurns.length >= 15);

    let systemPrompt = SYSTEM_PROMPTS[type];
    if (integrityContext && integrityContext.length > 0) {
      systemPrompt += `\nNote: The following integrity signals were detected during this session: [${integrityContext.join(', ')}]. Consider probing more deeply on the next turn if the interview is not yet complete.`;
    }

    // Map directly to Gemini format — no intermediate Turn mapping
    const contents = session.turns.map(t => ({
      role: t.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: t.content }],
    }));

    const model = gemini.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
      systemInstruction: systemPrompt,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
    });

    if (!isFinal) {
      const result = await model.generateContent({ contents });
      const text = result.response.text().trim();
      return { complete: false, question: text };
    } else {
      const result = await model.generateContent({
        contents,
        generationConfig: { responseMimeType: 'application/json' },
      });
      const text = result.response.text().trim();
      try {
        return JSON.parse(text);
      } catch {
        logger.error({ text }, 'Failed to parse LLM final verdict JSON');
        return { complete: false, question: 'Interview complete. Unable to parse result. Please contact support.' };
      }
    }
  } catch (e) {
    logger.error({ err: e }, 'LLM nextTurn failed');
    return { complete: false, question: 'Sorry, there was an error processing your answer. Please try again.' };
  }
}