export type SessionType = 'diagnostic' | 'assessment'
export type SessionStatus = 'active' | 'complete' | 'abandoned'
export type Currency = 'SOL' | 'USDC'
export type DiagnosticVerdict = 'ready' | 'developing' | 'beginner'
export type AssessmentVerdict = 'pass' | 'fail'

export interface Turn {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  integrityFlags?: string[]
}

export interface TopicScores {
  accountModel: number
  transactions: number
  anchor: number
  splTokens: number
  patterns: number
  testing: number
  security?: number
  advancedPatterns?: number
  deployment?: number
}

export interface DiagnosticResult {
  complete: true
  type: 'diagnostic'
  verdict: DiagnosticVerdict
  topicScores: TopicScores
  gaps: string[]
  resources: string[]
  summary: string
}

export interface AssessmentResult {
  complete: true
  type: 'assessment'
  verdict: AssessmentVerdict
  score: number
  topicScores: TopicScores
  strengths: string[]
  gaps: string[]
  integrityFlags: string[]
  summary: string
}

export type LLMResult = DiagnosticResult | AssessmentResult

export interface TurnResponse {
  complete: false
  question: string
}

export interface Session {
  id: string
  wallet: string
  type: SessionType
  status: SessionStatus
  turns: Turn[]
  verdict?: string
  score?: number
  scores?: TopicScores
  gaps?: string[]
  resources?: string[]
  summary?: string
  integrityFlags?: string[]
  paymentSignature?: string
  currency?: Currency
  createdAt: string
  updatedAt: string
}

export interface Credential {
  id: string
  wallet: string
  sessionId: string
  mintAddress: string
  score: number
  issuedAt: string
}

export interface JWTPayload {
  wallet: string
  iat: number
  exp: number
}
