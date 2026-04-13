/**
 * Social media integration for decision transparency
 * Posts bot decisions to Farcaster
 */

import axios from "axios";
import { SocialServiceError } from "./types.js";
import type { SocialDecision, FarcasterPost } from "./types.js";

// ============================================================================
// Neynar Client
// ============================================================================

const NEYNAR_BASE_URL = "https://api.neynar.com/v2";

interface NeynarPublishCastRequest {
  signer_uuid: string;
  text: string;
  embeds?: Array<{
    url: string;
  }>;
}

async function publishCastWithNeynar(
  apiKey: string,
  signerUuid: string,
  text: string,
  embeds?: Array<{ url: string }>
): Promise<string> {
  try {
    const response = await axios.post(
      `${NEYNAR_BASE_URL}/farcaster/cast/publish`,
      {
        signer_uuid: signerUuid,
        text,
        embeds,
      } as NeynarPublishCastRequest,
      {
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    const hash = response.data.cast?.hash;
    if (!hash) {
      throw new Error("No cast hash in response");
    }

    return hash;
  } catch (error) {
    throw new SocialServiceError("Failed to publish cast with Neynar", {
      error: String(error),
    });
  }
}

// ============================================================================
// Farcaster Signer Registration
// ============================================================================

async function registerFarcasterSigner(
  neynarApiKey: string,
  privateKey: string
): Promise<string> {
  try {
    // Create a signer from private key
    const response = await axios.post(
      `${NEYNAR_BASE_URL}/farcaster/signer/create`,
      {
        signer_from_warpcast: false,
      },
      {
        headers: {
          "X-API-Key": neynarApiKey,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    const signerUuid = response.data.signer_uuid;
    if (!signerUuid) {
      throw new Error("No signer UUID in response");
    }

    return signerUuid;
  } catch (error) {
    throw new SocialServiceError("Failed to register Farcaster signer", {
      error: String(error),
    });
  }
}

// ============================================================================
// Decision Formatting
// ============================================================================

function formatDecisionCast(decision: SocialDecision): string {
  const lines: string[] = [];

  lines.push(`🎯 POIDH Bounty Decision`);
  lines.push("");
  lines.push(`📋 Bounty: ${decision.bountyName}`);
  lines.push(`🏆 Winner: Claim #${decision.winnerId}`);
  lines.push(`📊 Score: ${decision.reasoning}`);
  lines.push("");
  lines.push(`🔗 View: ${decision.bountyUrl}`);
  lines.push(`📸 Proof: ${decision.winnerProof}`);
  lines.push("");

  if (decision.model) {
    lines.push(`⚙️ Model: ${decision.model}`);
    if (decision.confidence !== undefined) {
      lines.push(`📈 Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
    }
  }

  lines.push("");
  lines.push(`🤖 Autonomous evaluation by POIDH Sentinel`);

  return lines.join("\n");
}

// ============================================================================
// Public API
// ============================================================================

export async function postDecisionToFarcaster(
  decision: SocialDecision,
  neynarApiKey: string,
  signerUuid: string
): Promise<FarcasterPost> {
  try {
    const castText = formatDecisionCast(decision);

    // Publish cast
    const castHash = await publishCastWithNeynar(neynarApiKey, signerUuid, castText, [
      {
        url: decision.bountyUrl,
      },
    ]);

    return {
      cast: castText,
      embeds: [{ url: decision.bountyUrl }],
    };
  } catch (error) {
    throw new SocialServiceError("Failed to post decision to Farcaster", {
      bountyId: decision.bountyId,
      error: String(error),
    });
  }
}

export async function postDecisionThread(
  decision: SocialDecision,
  evaluationSummary: string,
  neynarApiKey: string,
  signerUuid: string
): Promise<{ mainCast: FarcasterPost; replyCast?: FarcasterPost }> {
  try {
    // Main cast
    const mainCast = await postDecisionToFarcaster(decision, neynarApiKey, signerUuid);

    // Reply with evaluation details (if summary is provided)
    if (evaluationSummary) {
      const replyText = `📊 Evaluation Summary:\n\n${evaluationSummary}`;

      await publishCastWithNeynar(neynarApiKey, signerUuid, replyText);

      return {
        mainCast,
        replyCast: {
          cast: replyText,
        },
      };
    }

    return { mainCast };
  } catch (error) {
    throw new SocialServiceError("Failed to post decision thread", {
      error: String(error),
    });
  }
}

// ============================================================================
// Verification
// ============================================================================

export async function verifyFarcasterSigner(
  neynarApiKey: string,
  signerUuid: string
): Promise<boolean> {
  try {
    const response = await axios.get(
      `${NEYNAR_BASE_URL}/farcaster/signer?signer_uuid=${signerUuid}`,
      {
        headers: {
          "X-API-Key": neynarApiKey,
        },
        timeout: 5000,
      }
    );

    return !!response.data.signer_uuid;
  } catch {
    return false;
  }
}

// ============================================================================
// Mock Implementation (for testing without Neynar)
// ============================================================================

export function formatDecisionForLogging(decision: SocialDecision): string {
  return formatDecisionCast(decision);
}
