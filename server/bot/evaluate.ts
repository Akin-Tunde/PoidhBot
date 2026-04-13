/**
 * Deterministic claim evaluation and scoring
 * Implements token overlap, signal detection, and hybrid AI evaluation
 */

import { extractUrls, uniqueNormalizedUrls } from "./uri.js";
import { EvaluationError } from "./types.js";
import type {
  ClaimTuple,
  ClaimEvidence,
  ClaimEvaluation,
  AiClaimEvaluation,
  EvaluateClaimsOptions,
} from "./types.js";

// ============================================================================
// Token Utilities
// ============================================================================

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

function calculateTokenOverlap(description: string, evidence: string): number {
  const descTokens = tokenize(description);
  const evidenceTokens = tokenize(evidence);

  if (descTokens.size === 0) return 0;

  const overlap = [...descTokens].filter((t) => evidenceTokens.has(t)).length;
  return overlap / descTokens.size;
}

// ============================================================================
// Signal Detection
// ============================================================================

interface SignalDetection {
  realWorldSignals: string[];
  missingSignals: string[];
  score: number;
}

function detectRealWorldSignals(
  description: string,
  evidence: ClaimEvidence
): SignalDetection {
  const signals: string[] = [];
  const missing: string[] = [];

  const descLower = description.toLowerCase();
  const textLower = (evidence.text || "").toLowerCase();
  const ocrLower = (evidence.ocrText || "").toLowerCase();
  const combinedText = textLower + " " + ocrLower;

  // Check for real-world proof indicators
  if (evidence.contentType === "image" || evidence.contentType === "video") {
    signals.push("visual_proof");
  }

  // Outdoor signal
  if (
    descLower.includes("outdoor") ||
    descLower.includes("outside") ||
    combinedText.includes("outdoor") ||
    combinedText.includes("outside")
  ) {
    signals.push("outdoor_signal");
  } else if (descLower.includes("outdoor")) {
    missing.push("outdoor_signal");
  }

  // Date signal
  if (
    /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/.test(combinedText) ||
    /\d{4}[\/-]\d{1,2}[\/-]\d{1,2}/.test(combinedText)
  ) {
    signals.push("date_signal");
  } else if (descLower.includes("date")) {
    missing.push("date_signal");
  }

  // Username/identifier signal
  if (combinedText.includes("@") || /\b[a-z0-9_]{3,}\b/i.test(combinedText)) {
    signals.push("username_signal");
  } else if (descLower.includes("username") || descLower.includes("name")) {
    missing.push("username_signal");
  }

  // Handwritten signal
  if (
    descLower.includes("handwritten") ||
    descLower.includes("handwrite") ||
    combinedText.includes("handwritten")
  ) {
    signals.push("handwritten_signal");
  }

  // Specific keyword matching
  const keywords = description.match(/\b[a-z]{4,}\b/gi) || [];
  for (const keyword of keywords) {
    if (combinedText.includes(keyword.toLowerCase())) {
      signals.push(`keyword_${keyword.toLowerCase()}`);
    }
  }

  // Calculate score based on signals
  const baseScore = Math.min(signals.length * 10, 50);
  const penaltyScore = Math.max(missing.length * 5, 0);
  const score = Math.max(baseScore - penaltyScore, 0);

  return { realWorldSignals: signals, missingSignals: missing, score };
}

// ============================================================================
// Deterministic Scoring
// ============================================================================

export function scoreClaimDeterministic(
  description: string,
  evidence: ClaimEvidence,
  createdAt: bigint
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // 1. Token overlap (0-30 points)
  const tokenOverlap = calculateTokenOverlap(description, evidence.text || "");
  const tokenScore = Math.round(tokenOverlap * 30);
  score += tokenScore;
  if (tokenScore > 0) {
    reasons.push(`Token overlap: ${(tokenOverlap * 100).toFixed(1)}% (${tokenScore} pts)`);
  }

  // 2. Evidence type (0-20 points)
  const evidenceTypeScore =
    evidence.contentType === "image"
      ? 20
      : evidence.contentType === "video"
        ? 15
        : evidence.contentType === "web"
          ? 10
          : 0;
  score += evidenceTypeScore;
  if (evidenceTypeScore > 0) {
    reasons.push(`Evidence type: ${evidence.contentType} (${evidenceTypeScore} pts)`);
  }

  // 3. Real-world signals (0-30 points)
  const signals = detectRealWorldSignals(description, evidence);
  score += signals.score;
  if (signals.score > 0) {
    reasons.push(
      `Real-world signals: ${signals.realWorldSignals.join(", ")} (${signals.score} pts)`
    );
  }
  if (signals.missingSignals.length > 0) {
    reasons.push(`Missing signals: ${signals.missingSignals.join(", ")}`);
  }

  // 4. Metadata completeness (0-10 points)
  let metadataScore = 0;
  if (evidence.title) metadataScore += 3;
  if (evidence.text) metadataScore += 3;
  if (evidence.imageUrl || evidence.animationUrl) metadataScore += 4;
  score += metadataScore;
  if (metadataScore > 0) {
    reasons.push(`Metadata completeness: ${metadataScore} pts`);
  }

  // 5. Freshness bonus (0-10 points)
  const ageSeconds = Number(BigInt(Date.now()) / BigInt(1000) - createdAt);
  const freshnessScore = ageSeconds < 3600 ? 10 : ageSeconds < 86400 ? 5 : 0;
  score += freshnessScore;
  if (freshnessScore > 0) {
    reasons.push(`Freshness bonus: ${freshnessScore} pts`);
  }

  // Ensure score is within 0-100
  const finalScore = Math.min(Math.max(score, 0), 100);

  return { score: finalScore, reasons };
}

// ============================================================================
// Claim Evaluation
// ============================================================================

export async function evaluateClaimDeterministic(
  claim: ClaimTuple,
  evidence: ClaimEvidence,
  description: string
): Promise<ClaimEvaluation> {
  const { score, reasons } = scoreClaimDeterministic(description, evidence, claim.createdAt);

  return {
    claim,
    evidence,
    score,
    accepted: score >= 50, // 50+ is passing
    reasons,
  };
}

// ============================================================================
// Batch Evaluation
// ============================================================================

export async function evaluateClaimsDeterministic(
  claims: ClaimTuple[],
  evidences: ClaimEvidence[],
  description: string
): Promise<ClaimEvaluation[]> {
  const evaluations: ClaimEvaluation[] = [];

  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];
    const evidence = evidences[i];

    if (!evidence) {
      console.warn(`No evidence found for claim ${claim.id}`);
      continue;
    }

    try {
      const evaluation = await evaluateClaimDeterministic(claim, evidence, description);
      evaluations.push(evaluation);
    } catch (error) {
      console.error(`Failed to evaluate claim ${claim.id}:`, error);
    }
  }

  return evaluations;
}

// ============================================================================
// Winner Selection
// ============================================================================

export function selectWinner(evaluations: ClaimEvaluation[]): ClaimEvaluation | null {
  if (evaluations.length === 0) return null;

  // Filter accepted claims
  const accepted = evaluations.filter((e) => e.accepted);
  if (accepted.length === 0) return null;

  // Sort by score (descending), then by creation time (ascending for tie-breaker)
  accepted.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Tie-breaker: earlier submission wins
    return Number(a.claim.createdAt - b.claim.createdAt);
  });

  return accepted[0];
}

// ============================================================================
// Evaluation Report
// ============================================================================

export function generateEvaluationReport(evaluations: ClaimEvaluation[]): string {
  if (evaluations.length === 0) {
    return "No claims to evaluate.";
  }

  const lines: string[] = [];

  lines.push(`# Claim Evaluation Report`);
  lines.push(`Total claims: ${evaluations.length}`);
  lines.push(`Accepted: ${evaluations.filter((e) => e.accepted).length}`);
  lines.push(`Rejected: ${evaluations.filter((e) => !e.accepted).length}`);
  lines.push("");

  // Sort by score descending
  const sorted = [...evaluations].sort((a, b) => b.score - a.score);

  for (const evaluation of sorted) {
    lines.push(`## Claim #${evaluation.claim.id}`);
    lines.push(`Score: ${evaluation.score}/100`);
    lines.push(`Status: ${evaluation.accepted ? "✅ ACCEPTED" : "❌ REJECTED"}`);
    lines.push(`Submitted: ${new Date(Number(evaluation.claim.createdAt) * 1000).toISOString()}`);
    lines.push("");
    lines.push("Reasoning:");
    for (const reason of evaluation.reasons) {
      lines.push(`- ${reason}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ============================================================================
// Hybrid Evaluation (with AI fallback)
// ============================================================================

export async function evaluateClaimsHybrid(
  claims: ClaimTuple[],
  evidences: ClaimEvidence[],
  description: string,
  options: EvaluateClaimsOptions = {}
): Promise<ClaimEvaluation[]> {
  try {
    // First pass: deterministic scoring
    const deterministicEvals = await evaluateClaimsDeterministic(
      claims,
      evidences,
      description
    );

    // If AI is not enabled, return deterministic results
    if (options.mode === "deterministic" || !options.aiApiKey) {
      return deterministicEvals;
    }

    // Second pass: AI evaluation for borderline or rejected claims
    const { evaluateClaimsWithAi } = await import("./aiEvaluation.js");

    const borderlineEvals = deterministicEvals.filter(
      (e) => e.score >= 30 && e.score < 70 // Borderline cases
    );

    if (borderlineEvals.length === 0) {
      return deterministicEvals;
    }

    console.log(`Running AI evaluation on ${borderlineEvals.length} borderline claims...`);

    const aiResults = await evaluateClaimsWithAi(
      borderlineEvals.map((e) => e.claim),
      borderlineEvals.map((e) => e.evidence),
      description,
      {
        apiKey: options.aiApiKey,
        model: options.aiModel || "qwen3.6-plus",
        minConfidence: options.aiMinConfidence || 0.7,
        enableVision: options.aiEvaluationEnableVision !== false,
        inspectLinkedUrls: options.aiInspectLinkedUrls !== false,
        maxLinkedUrls: options.aiMaxLinkedUrls || 3,
      }
    );

    // Merge results
    const finalEvals = deterministicEvals.map((deval) => {
      const aiResult = aiResults.find((a) => a.claim.id === deval.claim.id);
      if (aiResult) {
        return {
          ...deval,
          accepted: aiResult.accepted,
          score: aiResult.score,
          reasons: [...deval.reasons, ...aiResult.reasons],
          aiEvaluation: aiResult.aiEvaluation,
        };
      }
      return deval;
    });

    return finalEvals;
  } catch (error) {
    throw new EvaluationError("Failed to perform hybrid evaluation", {
      error: String(error),
    });
  }
}
