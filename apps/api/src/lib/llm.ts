import Groq from 'groq-sdk';
import { config } from '../config';
import { Session, SessionType, Turn, TurnResponse, LLMResult } from '../types';
import { logger } from '../lib/logger';

const groq = new Groq({ apiKey: config.GROQ_API_KEY });

// Model to use — swap to 'llama-3.1-8b-instant' for even higher rate limits if needed
const GROQ_MODEL = 'llama-3.3-70b-versatile';

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
    return "Explain how Solana's account model differs from Ethereum's. What are the implications for program design?";
  }
}

/**
 * Processes the next turn in a session.
 * Sends full conversation history + system prompt to Groq.
 * On normal turns: returns the next question.
 * On final turn: requests JSON output and returns the structured verdict.
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
    const forceFinish =
      (type === 'diagnostic' && userTurns.length >= 12) ||
      (type === 'assessment' && userTurns.length >= 20);

    let systemPrompt = SYSTEM_PROMPTS[type];
    if (integrityContext && integrityContext.length > 0) {
      systemPrompt += `\nNote: The following integrity signals were detected during this session: [${integrityContext.join(', ')}]. Consider probing more deeply on the next turn if the interview is not yet complete.`;
    }

    // Groq uses OpenAI-style messages — role is 'assistant' (not 'model' like Gemini)
    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      ...session.turns.map(t => ({
        role: t.role as 'user' | 'assistant',
        content: t.content,
      })),
    ];

    if (!forceFinish) {
      const result = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
      });

      const text = result.choices[0].message.content?.trim() ?? '';

      try {
        const parsed = JSON.parse(text);
        if (parsed.complete === true) return parsed; // LLM finished on its own
      } catch {
        // Not JSON, normal question response
      }
      return { complete: false, question: text };

    } else {
      // Groq supports JSON mode via response_format — enforces valid JSON output
      const result = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            // Reinforce JSON-only output — required when using response_format json_object
            content: systemPrompt + '\n\nYou must now output the final JSON verdict and nothing else.',
          },
          ...messages,
        ],
        temperature: 0.3, // Lower temp for structured output — less creative variance
        response_format: { type: 'json_object' },
      });

      const text = result.choices[0].message.content?.trim() ?? '';
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