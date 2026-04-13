/**
 * Main bot orchestration
 * Handles the complete bounty lifecycle: create → monitor → evaluate → accept → report
 */

import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import pino from "pino";
import { config, currentChainConfig } from "../config.js";
import {
  createSoloBounty,
  getClaimsByBountyId,
  acceptClaim,
  getBountyById,
} from "../core/poidh.js";
import { resolveClaimsEvidence } from "../core/uri.js";
import { evaluateClaimsHybrid, selectWinner, generateEvaluationReport } from "../core/evaluate.js";
import { formatDecisionForLogging } from "../core/social.js";
import { getPoidhBountyUrl, getWalletBalance } from "../core/chains.js";
import type { BountyConfig, BotRunResult, ArtifactPaths, SocialDecision } from "../core/types.js";

// ============================================================================
// Logger Setup
// ============================================================================

const logger = pino({
  level: config.logLevel,
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  },
});

// ============================================================================
// Artifact Management
// ============================================================================

async function ensureArtifactsDir(bountyId: bigint): Promise<string> {
  const bountyDir = join(config.artifactsDir, "production", bountyId.toString());
  await mkdir(bountyDir, { recursive: true });
  return bountyDir;
}

async function saveArtifacts(
  bountyId: bigint,
  artifacts: {
    productionJson: object;
    productionMd: string;
    socialJson?: object;
    socialMd?: string;
  }
): Promise<ArtifactPaths> {
  const bountyDir = await ensureArtifactsDir(bountyId);

  const paths: ArtifactPaths = {
    productionJson: join(bountyDir, "production.json"),
    productionMd: join(bountyDir, "production.md"),
  };

  // Save production JSON
  await writeFile(
    paths.productionJson,
    JSON.stringify(artifacts.productionJson, null, 2)
  );

  // Save production markdown
  await writeFile(paths.productionMd, artifacts.productionMd);

  // Save social artifacts if provided
  if (artifacts.socialJson) {
    paths.socialJson = join(bountyDir, "social.json");
    await writeFile(paths.socialJson, JSON.stringify(artifacts.socialJson, null, 2));
  }

  if (artifacts.socialMd) {
    paths.socialMd = join(bountyDir, "social.md");
    await writeFile(paths.socialMd, artifacts.socialMd);
  }

  return paths;
}

// ============================================================================
// Bot Phases
// ============================================================================

async function phaseCreate(bountyConfig: BountyConfig): Promise<bigint> {
  logger.info("📝 [PHASE 1] Creating bounty...");

  // Validate wallet balance
  const balance = await getWalletBalance();
  const amount = BigInt(bountyConfig.amount);

  if (balance < amount) {
    throw new Error(
      `Insufficient balance. Required: ${amount}, Available: ${balance}`
    );
  }

  // Create bounty
  const result = await createSoloBounty(
    bountyConfig.name,
    bountyConfig.description,
    amount
  );

  if (!result.bountyId) {
    throw new Error("Failed to extract bounty ID from transaction");
  }

  logger.info(
    `✅ Bounty created: #${result.bountyId} (tx: ${result.txHash})`
  );

  return result.bountyId;
}

async function phaseMonitor(
  bountyId: bigint,
  maxWaitSeconds: number = config.botTimeoutMinutes * 60
): Promise<{ claimCount: number; firstClaimTime?: Date }> {
  logger.info("👀 [PHASE 2] Monitoring for claims...");

  const startTime = Date.now();
  let lastClaimCount = 0;
  let firstClaimTime: Date | undefined;

  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    try {
      const claims = await getClaimsByBountyId(bountyId, 0);
      const newClaimCount = claims.length;

      if (newClaimCount > lastClaimCount) {
        logger.info(`📬 New claim received: ${newClaimCount} total`);
        if (!firstClaimTime) {
          firstClaimTime = new Date();
        }
        lastClaimCount = newClaimCount;

        // Check if we should finalize
        if (
          newClaimCount >= (config.minParticipantsBeforeFinalize || 1) &&
          firstClaimTime &&
          Date.now() - firstClaimTime.getTime() >=
            (config.firstClaimCooldownSeconds || 0) * 1000
        ) {
          logger.info(`✅ Minimum participants reached, ready to finalize`);
          break;
        }
      }

      // Wait before next poll
      await new Promise((resolve) =>
        setTimeout(resolve, config.pollingIntervalSeconds * 1000)
      );
      } catch (error) {
        logger.error({ err: error }, "Error during monitoring");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  logger.info(
    `📊 Monitoring complete: ${lastClaimCount} claims received`
  );

  return { claimCount: lastClaimCount, firstClaimTime };
}

async function phaseEvaluate(
  bountyId: bigint,
  description: string
): Promise<{
  winnerClaimId: bigint;
  evaluationReport: string;
  allEvaluations: any[];
}> {
  logger.info("🔍 [PHASE 3] Evaluating claims...");

  // Fetch all claims
  const claims = await getClaimsByBountyId(bountyId, 0);
  logger.info(`📋 Evaluating ${claims.length} claims`);

  if (claims.length === 0) {
    throw new Error("No claims to evaluate");
  }

  // Resolve evidence for all claims
  logger.info("🔗 Resolving claim evidence...");
  const evidences = await resolveClaimsEvidence(claims);

  // Evaluate claims
  logger.info("⚖️ Scoring claims...");
  const evaluations = await evaluateClaimsHybrid(
    claims,
    evidences,
    description,
    {
      mode: config.aiEvaluationMode as any,
      aiApiKey: config.aiApiKey,
      aiModel: config.aiModel,
      aiMinConfidence: config.aiMinConfidence,
      aiEvaluationEnableVision: config.aiEvaluationEnableVision as boolean,
      aiInspectLinkedUrls: config.aiInspectLinkedUrls,
      aiMaxLinkedUrls: config.aiMaxLinkedUrls,
    }
  );

  // Select winner
  const winner = evaluations.find((e) => e.accepted && e.score === Math.max(...evaluations.map((e) => e.score)));

  if (!winner) {
    throw new Error("No acceptable claims found");
  }

  logger.info(
    `🏆 Winner selected: Claim #${winner.claim.id} (score: ${winner.score})`
  );

  // Generate report
  const report = generateEvaluationReport(evaluations);

  return {
    winnerClaimId: winner.claim.id,
    evaluationReport: report,
    allEvaluations: evaluations,
  };
}

async function phaseAccept(
  bountyId: bigint,
  winnerClaimId: bigint
): Promise<string> {
  logger.info("✍️ [PHASE 4] Accepting winning claim...");

  if (config.dryRun) {
    logger.warn("🔒 DRY RUN MODE - Skipping on-chain acceptance");
    return "dry-run-tx-hash";
  }

  const txHash = await acceptClaim(bountyId, winnerClaimId);
  logger.info(`✅ Claim accepted: ${txHash}`);

  return txHash;
}

async function phaseReport(
  bountyId: bigint,
  winnerClaimId: bigint,
  evaluationReport: string,
  allEvaluations: any[]
): Promise<ArtifactPaths> {
  logger.info("📄 [PHASE 5] Generating report...");

  const bountyUrl = getPoidhBountyUrl(bountyId);
  const winnerEval = allEvaluations.find((e) => e.claim.id === winnerClaimId);

  const productionJson = {
    generatedAt: new Date().toISOString(),
    chain: config.targetChain,
    bountyId: bountyId.toString(),
    bountyUrl,
    bountyName: "POIDH Bounty",
    bountyDescription: "Real-world action bounty",
    bountyAmountWei: "0",
    issuerAddress: "0x0",
    currentChainBountyAmountWei: "0",
    issuerPendingWithdrawalsWei: "0",
    winnerClaim: winnerClaimId.toString(),
    evaluations: allEvaluations.map((e) => ({
      claimId: e.claim.id.toString(),
      score: e.score,
      accepted: e.accepted,
      reasons: e.reasons,
    })),
  };

  const productionMd = `# poidh bounty report

- Generated at: ${new Date().toISOString()}
- Chain: ${config.targetChain}
- Bounty ID: ${bountyId}
- Bounty URL: ${bountyUrl}
- Winner claim: ${winnerClaimId}

## Evaluations

${evaluationReport}
`;

  const artifacts = await saveArtifacts(bountyId, {
    productionJson,
    productionMd,
  });

  logger.info(`📁 Artifacts saved to ${artifacts.productionMd}`);

  return artifacts;
}

// ============================================================================
// Main Bot Execution
// ============================================================================

export async function runBot(bountyConfig: BountyConfig): Promise<BotRunResult> {
  try {
    logger.info("🤖 POIDH Sentinel Bot Started");
    logger.info(`Chain: ${config.targetChain}`);
    logger.info(`Mode: ${config.aiEvaluationMode}`);

    // Phase 1: Create bounty
    const bountyId = await phaseCreate(bountyConfig);

    // Phase 2: Monitor claims
    const monitorResult = await phaseMonitor(bountyId);

    if (monitorResult.claimCount === 0) {
      throw new Error("No claims received within timeout period");
    }

    // Phase 3: Evaluate claims
    const evaluateResult = await phaseEvaluate(
      bountyId,
      bountyConfig.description
    );

    // Phase 4: Accept winner
    const txHash = await phaseAccept(
      bountyId,
      evaluateResult.winnerClaimId
    );

    // Phase 5: Generate report
    const artifacts = await phaseReport(
      bountyId,
      evaluateResult.winnerClaimId,
      evaluateResult.evaluationReport,
      evaluateResult.allEvaluations
    );

    logger.info("✅ Bot execution completed successfully");

    return {
      bountyId,
      bountyUrl: getPoidhBountyUrl(bountyId),
      winnerId: evaluateResult.winnerClaimId,
      decision: `Winner: Claim #${evaluateResult.winnerClaimId}`,
      evaluations: evaluateResult.allEvaluations,
      txHash,
      artifacts,
    };
  } catch (error) {
    logger.error({ err: error }, "❌ Bot execution failed");
    throw error;
  }
}

// ============================================================================
// Continuous Mode
// ============================================================================

export async function runBotContinuous(
  bountyConfig: BountyConfig,
  intervalMinutes: number = 60
): Promise<void> {
  logger.info(`🔄 Starting continuous mode (interval: ${intervalMinutes} min)`);

  while (true) {
    try {
      await runBot(bountyConfig);
      logger.info(`⏳ Waiting ${intervalMinutes} minutes before next run...`);
      await new Promise((resolve) =>
        setTimeout(resolve, intervalMinutes * 60 * 1000)
      );
    } catch (error) {
      logger.error({ err: error }, "Error in continuous mode");
      await new Promise((resolve) => setTimeout(resolve, 60 * 1000)); // Wait 1 min before retry
    }
  }
}

export { logger };
