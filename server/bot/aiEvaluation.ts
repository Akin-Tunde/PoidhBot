/**
 * AI-powered claim evaluation using OpenRouter API
 * Supports vision analysis and linked URL inspection
 */

import axios from "axios";
import { extractUrls, uniqueNormalizedUrls } from "./uri.js";
import { AiServiceError } from "./types.js";
import type {
  ClaimTuple,
  ClaimEvidence,
  ClaimEvaluation,
  AiClaimEvaluation,
  AiEvaluationVerdict,
} from "./types.js";

// ============================================================================
// OpenRouter Client
// ============================================================================

interface AiEvaluationOptions {
  apiKey: string;
  model: string;
  minConfidence: number;
  enableVision: boolean;
  inspectLinkedUrls: boolean;
  maxLinkedUrls: number;
}

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string | object[] }>
): Promise<string> {
  try {
    const response = await axios.post(
      `${OPENROUTER_BASE_URL}/chat/completions`,
      {
        model,
        messages,
        temperature: 0.3, // Lower temperature for more consistent evaluation
        max_tokens: 1000,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://poidh.xyz",
          "X-Title": "POIDH Sentinel",
        },
        timeout: 30000,
      }
    );

    const content = response.data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No response content from OpenRouter");
    }

    return content;
  } catch (error) {
    throw new AiServiceError("OpenRouter API call failed", {
      model,
      error: String(error),
    });
  }
}

// ============================================================================
// Vision Analysis
// ============================================================================

async function analyzeWithVision(
  apiKey: string,
  model: string,
  evidence: ClaimEvidence,
  description: string
): Promise<{ summary: string; signals: string[] }> {
  try {
    // Build vision message
    const imageUrl = evidence.imageUrl || evidence.animationUrl;
    if (!imageUrl) {
      return { summary: "", signals: [] };
    }

    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this image as proof for the following task:

Task: ${description}

Provide a brief summary of what you see and list specific signals that confirm the task completion. Format your response as:
SUMMARY: [brief description]
SIGNALS: [comma-separated list of signals]`,
          },
          {
            type: "image",
            image: imageUrl,
          },
        ],
      },
    ];

    const response = await callOpenRouter(apiKey, model, messages as any);

    // Parse response
    const summaryMatch = response.match(/SUMMARY:\s*(.+?)(?=SIGNALS:|$)/s);
    const signalsMatch = response.match(/SIGNALS:\s*(.+?)$/s);

    const summary = summaryMatch ? summaryMatch[1].trim() : "";
    const signals = signalsMatch
      ? signalsMatch[1]
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];

    return { summary, signals };
  } catch (error) {
    console.warn("Vision analysis failed:", error);
    return { summary: "", signals: [] };
  }
}

// ============================================================================
// URL Inspection
// ============================================================================

async function inspectLinkedUrls(
  apiKey: string,
  model: string,
  urls: string[],
  maxUrls: number
): Promise<string> {
  if (urls.length === 0) return "";

  try {
    const urlsToInspect = urls.slice(0, maxUrls);
    const urlContents = await Promise.all(
      urlsToInspect.map(async (url) => {
        try {
          const response = await axios.get(url, {
            timeout: 5000,
            headers: { "user-agent": "poidh-sentinel/1.0" },
          });
          return `URL: ${url}\nContent: ${String(response.data).substring(0, 500)}`;
        } catch {
          return `URL: ${url}\n[Failed to fetch]`;
        }
      })
    );

    const messages = [
      {
        role: "user",
        content: `Summarize the content of these URLs in the context of a proof-of-work task:\n\n${urlContents.join("\n\n")}`,
      },
    ];

    return await callOpenRouter(apiKey, model, messages);
  } catch (error) {
    console.warn("URL inspection failed:", error);
    return "";
  }
}

// ============================================================================
// Claim Evaluation
// ============================================================================

async function evaluateClaimWithAi(
  claim: ClaimTuple,
  evidence: ClaimEvidence,
  description: string,
  options: AiEvaluationOptions
): Promise<ClaimEvaluation> {
  try {
    // Gather evidence
    let visionSummary = "";
    let visionSignals: string[] = [];

    if (options.enableVision && (evidence.imageUrl || evidence.animationUrl)) {
      const visionResult = await analyzeWithVision(
        options.apiKey,
        options.model,
        evidence,
        description
      );
      visionSummary = visionResult.summary;
      visionSignals = visionResult.signals;
    }

    // Inspect linked URLs
    let urlAnalysis = "";
    if (options.inspectLinkedUrls) {
      const urls = extractUrls(evidence.text || "");
      const normalizedUrls = uniqueNormalizedUrls(urls);
      if (normalizedUrls.length > 0) {
        urlAnalysis = await inspectLinkedUrls(
          options.apiKey,
          options.model,
          normalizedUrls,
          options.maxLinkedUrls
        );
      }
    }

    // Build evaluation prompt
    const evaluationPrompt = `You are evaluating a claim for a real-world task bounty.

Task Description: ${description}

Claim Evidence:
- Title: ${evidence.title || "N/A"}
- Text: ${evidence.text || "N/A"}
- Content Type: ${evidence.contentType}
- OCR Text: ${evidence.ocrText || "N/A"}

${visionSummary ? `Vision Analysis: ${visionSummary}` : ""}
${urlAnalysis ? `URL Analysis: ${urlAnalysis}` : ""}

Based on this evidence, determine if the claim satisfies the task requirements.

Respond in this exact format:
VERDICT: [accept|reject|needs_review]
CONFIDENCE: [0.0-1.0]
REASONING: [brief explanation]`;

    const messages = [
      {
        role: "user",
        content: evaluationPrompt,
      },
    ];

    const response = await callOpenRouter(options.apiKey, options.model, messages);

    // Parse response
    const verdictMatch = response.match(/VERDICT:\s*(accept|reject|needs_review)/i);
    const confidenceMatch = response.match(/CONFIDENCE:\s*([\d.]+)/);
    const reasoningMatch = response.match(/REASONING:\s*(.+?)$/s);

    const verdict = (verdictMatch?.[1]?.toLowerCase() || "needs_review") as AiEvaluationVerdict;
    const confidence = parseFloat(confidenceMatch?.[1] || "0.5");
    const reasoning = reasoningMatch?.[1]?.trim() || "No reasoning provided";

    // Determine if accepted
    const accepted =
      verdict === "accept" && confidence >= options.minConfidence;

    // Calculate score
    let score = 0;
    if (verdict === "accept") score = Math.round(confidence * 100);
    else if (verdict === "needs_review") score = Math.round(confidence * 50);
    else score = Math.round((1 - confidence) * 20);

    const aiEvaluation: AiClaimEvaluation = {
      verdict,
      confidence,
      reasons: [reasoning],
      model: options.model,
      visionSummary: visionSummary || undefined,
      visionSignals: visionSignals.length > 0 ? visionSignals : undefined,
    };

    return {
      claim,
      evidence,
      score,
      accepted,
      reasons: [reasoning],
      aiEvaluation,
    };
  } catch (error) {
    throw new AiServiceError("Failed to evaluate claim with AI", {
      claimId: claim.id.toString(),
      error: String(error),
    });
  }
}

// ============================================================================
// Batch Evaluation
// ============================================================================

export async function evaluateClaimsWithAi(
  claims: ClaimTuple[],
  evidences: ClaimEvidence[],
  description: string,
  options: AiEvaluationOptions
): Promise<ClaimEvaluation[]> {
  const results: ClaimEvaluation[] = [];

  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];
    const evidence = evidences[i];

    if (!evidence) {
      console.warn(`No evidence found for claim ${claim.id}`);
      continue;
    }

    try {
      const evaluation = await evaluateClaimWithAi(claim, evidence, description, options);
      results.push(evaluation);

      // Rate limiting: wait between requests
      if (i < claims.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Failed to evaluate claim ${claim.id} with AI:`, error);
    }
  }

  return results;
}

// ============================================================================
// Model Availability Check
// ============================================================================

export async function checkModelAvailability(
  apiKey: string,
  model: string
): Promise<boolean> {
  try {
    const response = await axios.get(`${OPENROUTER_BASE_URL}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 5000,
    });

    const models = response.data.data || [];
    return models.some((m: any) => m.id === model);
  } catch (error) {
    console.warn("Failed to check model availability:", error);
    return false;
  }
}
