/**
 * Core TypeScript types for the POIDH bot
 */

// ============================================================================
// Blockchain Types
// ============================================================================

export type ChainName = "arbitrum" | "base" | "degen";

export interface ClaimTuple {
  id: bigint;
  issuer: string;
  bountyId: bigint;
  bountyIssuer: string;
  name: string;
  description: string;
  createdAt: bigint;
  accepted: boolean;
}

export interface BountyTuple {
  id: bigint;
  issuer: string;
  name: string;
  description: string;
  amount: bigint;
  createdAt: bigint;
  claimCount: bigint;
  acceptedClaimId: bigint | null;
}

// ============================================================================
// Evidence & URI Types
// ============================================================================

export interface ClaimEvidence {
  tokenUri: string;
  contentUri: string;
  contentType: string;
  title?: string;
  text?: string;
  ocrText?: string;
  imageUrl?: string;
  animationUrl?: string;
  rawMetadata?: Record<string, unknown>;
}

export type ContentType = "image" | "video" | "web" | "document" | "unknown";

// ============================================================================
// Evaluation Types
// ============================================================================

export interface ClaimEvaluation {
  claim: ClaimTuple;
  evidence: ClaimEvidence;
  score: number; // 0-100
  accepted: boolean;
  reasons: string[];
  visionSummary?: string;
  visionSignals?: string[];
  aiEvaluation?: AiClaimEvaluation;
}

export type AiEvaluationVerdict = "accept" | "reject" | "needs_review";

export interface AiClaimEvaluation {
  verdict: AiEvaluationVerdict;
  confidence: number; // 0-1
  reasons: string[];
  model: string;
  visionSummary?: string;
  visionSignals?: string[];
}

export type EvaluationMode = "deterministic" | "ai_hybrid" | "ai_required";

export interface EvaluateClaimsOptions {
  mode?: EvaluationMode;
  aiApiKey?: string;
  aiModel?: string;
  aiMinConfidence?: number;
  aiEnableVision?: boolean;
  aiEvaluationEnableVision?: boolean;
  aiInspectLinkedUrls?: boolean;
  aiMaxLinkedUrls?: number;
}

// ============================================================================
// Bounty Types
// ============================================================================

export interface BountyConfig {
  name: string;
  description: string;
  amount: string; // e.g., "0.001ether" or "1000000000000000"
  mode: "solo" | "open";
  minParticipantsBeforeFinalize?: number;
  firstClaimCooldownSeconds?: number;
  maxWaitTimeMinutes?: number;
}

export interface BountyState {
  bountyId: bigint;
  name: string;
  description: string;
  issuer: string;
  amount: bigint;
  createdAt: Date;
  claims: ClaimTuple[];
  winner?: ClaimTuple;
  finalized: boolean;
  finalizedAt?: Date;
}

// ============================================================================
// Bot Execution Types
// ============================================================================

export interface BotRunResult {
  bountyId: bigint;
  bountyUrl: string;
  winnerId?: bigint;
  winnerProof?: string;
  decision: string;
  evaluations: ClaimEvaluation[];
  txHash?: string;
  farcasterCast?: string;
  artifacts: ArtifactPaths;
}

export interface ArtifactPaths {
  productionJson: string;
  productionMd: string;
  farcasterJson?: string;
  farcasterMd?: string;
  socialJson?: string;
  socialMd?: string;
}

// ============================================================================
// Social & Transparency Types
// ============================================================================

export interface FarcasterPost {
  cast: string;
  embeds?: Array<{
    url: string;
  }>;
}

export interface SocialDecision {
  bountyId: string;
  bountyName: string;
  bountyUrl: string;
  winnerId: string;
  winnerProof: string;
  reasoning: string;
  evaluationSummary: string;
  timestamp: string;
  model?: string;
  confidence?: number;
}

// ============================================================================
// Error Types
// ============================================================================

export class PoidhBotError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "PoidhBotError";
  }
}

export class ChainInteractionError extends PoidhBotError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("CHAIN_INTERACTION_ERROR", message, details);
    this.name = "ChainInteractionError";
  }
}

export class EvaluationError extends PoidhBotError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("EVALUATION_ERROR", message, details);
    this.name = "EvaluationError";
  }
}

export class AiServiceError extends PoidhBotError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("AI_SERVICE_ERROR", message, details);
    this.name = "AiServiceError";
  }
}

export class SocialServiceError extends PoidhBotError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("SOCIAL_SERVICE_ERROR", message, details);
    this.name = "SocialServiceError";
  }
}
