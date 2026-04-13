import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

// ============================================================================
// Configuration Schema
// ============================================================================

const ConfigSchema = z.object({
  // Blockchain & Wallet
  privateKey: z.string().min(1, "PRIVATE_KEY is required"),
  rpcUrl: z.string().url("RPC_URL must be a valid URL"),
  targetChain: z.enum(["arbitrum", "base", "degen"]).default("arbitrum"),

  // Bounty Configuration
  bountyName: z.string().default("Test Bounty"),
  bountyDescription: z.string().default("A test bounty"),
  bountyAmount: z.string().default("0.001ether"),
  bountyMode: z.enum(["solo", "open"]).default("solo"),
  minParticipantsBeforeFinalize: z.number().int().positive().default(1),
  firstClaimCooldownSeconds: z.number().int().nonnegative().default(300),

  // AI & Evaluation
  aiApiKey: z.string().optional(),
  aiModel: z.string().default("qwen3.6-plus"),
  aiEvaluationMode: z.enum(["deterministic", "ai_hybrid", "ai_required"]).default("ai_hybrid"),
  aiEvaluationEnableVision: z.boolean().default(true),
  aiMinConfidence: z.number().min(0).max(1).default(0.7),
  aiInspectLinkedUrls: z.boolean().default(true),
  aiMaxLinkedUrls: z.number().int().positive().default(3),

  // OCR
  ocrEnable: z.boolean().default(true),

  // IPFS & Storage
  pinataJwt: z.string().optional(),
  pinataGateway: z.string().url().optional(),

  // Social & Transparency
  farcasterPrivateKey: z.string().optional(),
  neynarApiKey: z.string().optional(),

  // Polymarket
  polymarketApiKey: z.string().optional(),
  polymarketSecret: z.string().optional(),
  polymarketPassphrase: z.string().optional(),
  polymarketEnv: z.enum(["production", "staging"]).default("production"),

  // Bot Behavior
  pollingIntervalSeconds: z.number().int().positive().default(30),
  maxClaimsPerPoll: z.number().int().positive().default(10),
  botTimeoutMinutes: z.number().int().positive().default(120),
  dryRun: z.boolean().default(false),

  // Logging
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  artifactsDir: z.string().default("./artifacts"),

  // Advanced
  gasPriceMultiplier: z.number().positive().default(1.0),
  gasLimit: z.number().int().positive().default(500000),
  retryAttempts: z.number().int().nonnegative().default(3),
  retryDelayMs: z.number().int().nonnegative().default(1000),
});

type Config = z.infer<typeof ConfigSchema>;

// ============================================================================
// Load & Validate Configuration
// ============================================================================

function parseEnv(): Config {
  const env = {
    privateKey: process.env.PRIVATE_KEY,
    rpcUrl: process.env.RPC_URL,
    targetChain: process.env.TARGET_CHAIN,

    bountyName: process.env.BOUNTY_NAME,
    bountyDescription: process.env.BOUNTY_DESCRIPTION,
    bountyAmount: process.env.BOUNTY_AMOUNT,
    bountyMode: process.env.BOUNTY_MODE,
    minParticipantsBeforeFinalize: process.env.MIN_PARTICIPANTS_BEFORE_FINALIZE
      ? parseInt(process.env.MIN_PARTICIPANTS_BEFORE_FINALIZE, 10)
      : undefined,
    firstClaimCooldownSeconds: process.env.FIRST_CLAIM_COOLDOWN_SECONDS
      ? parseInt(process.env.FIRST_CLAIM_COOLDOWN_SECONDS, 10)
      : undefined,

    aiApiKey: process.env.AI_API_KEY,
    aiModel: process.env.AI_MODEL,
    aiEvaluationMode: process.env.AI_EVALUATION_MODE,
    aiEvaluationEnableVision: process.env.AI_EVALUATION_ENABLE_VISION === "true",
    aiMinConfidence: process.env.AI_MIN_CONFIDENCE
      ? parseFloat(process.env.AI_MIN_CONFIDENCE)
      : undefined,
    aiInspectLinkedUrls: process.env.AI_INSPECT_LINKED_URLS === "true",
    aiMaxLinkedUrls: process.env.AI_MAX_LINKED_URLS
      ? parseInt(process.env.AI_MAX_LINKED_URLS, 10)
      : undefined,

    ocrEnable: process.env.OCR_ENABLE === "true",

    pinataJwt: process.env.PINATA_JWT,
    pinataGateway: process.env.PINATA_GATEWAY,

    farcasterPrivateKey: process.env.FARCASTER_PRIVATE_KEY,
    neynarApiKey: process.env.NEYNAR_API_KEY,

    polymarketApiKey: process.env.POLYMARKET_API_KEY,
    polymarketSecret: process.env.POLYMARKET_SECRET,
    polymarketPassphrase: process.env.POLYMARKET_PASSPHRASE,
    polymarketEnv: process.env.POLYMARKET_ENV,

    pollingIntervalSeconds: process.env.POLLING_INTERVAL_SECONDS
      ? parseInt(process.env.POLLING_INTERVAL_SECONDS, 10)
      : undefined,
    maxClaimsPerPoll: process.env.MAX_CLAIMS_PER_POLL
      ? parseInt(process.env.MAX_CLAIMS_PER_POLL, 10)
      : undefined,
    botTimeoutMinutes: process.env.BOT_TIMEOUT_MINUTES
      ? parseInt(process.env.BOT_TIMEOUT_MINUTES, 10)
      : undefined,
    dryRun: process.env.DRY_RUN === "true",

    logLevel: process.env.LOG_LEVEL,
    artifactsDir: process.env.ARTIFACTS_DIR,

    gasPriceMultiplier: process.env.GAS_PRICE_MULTIPLIER
      ? parseFloat(process.env.GAS_PRICE_MULTIPLIER)
      : undefined,
    gasLimit: process.env.GAS_LIMIT ? parseInt(process.env.GAS_LIMIT, 10) : undefined,
    retryAttempts: process.env.RETRY_ATTEMPTS
      ? parseInt(process.env.RETRY_ATTEMPTS, 10)
      : undefined,
    retryDelayMs: process.env.RETRY_DELAY_MS
      ? parseInt(process.env.RETRY_DELAY_MS, 10)
      : undefined,
  };

  const result = ConfigSchema.safeParse(env);

  if (!result.success) {
    console.error("Configuration validation errors:");
    result.error.issues.forEach((err: any) => {
      console.error(`  ${err.path.join(".")}: ${err.message}`);
    });
    process.exit(1);
  }

  return result.data;
}

export const config = parseEnv();

// ============================================================================
// Chain Configuration
// ============================================================================

export const CHAIN_CONFIG = {
  arbitrum: {
    name: "Arbitrum One",
    chainId: 42161,
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    poidhContract: "0x5555Fa783936C260f77385b4E153B9725feF1719",
    poidhBaseUrl: "https://poidh.xyz/arbitrum",
    poidhV2Offset: 180,
    explorer: "https://arbiscan.io",
    minBountyAmount: "0.001ether",
    minContribution: "0.00001ether",
  },
  base: {
    name: "Base",
    chainId: 8453,
    rpcUrl: "https://mainnet.base.org",
    poidhContract: "0x5555Fa783936C260f77385b4E153B9725feF1719",
    poidhBaseUrl: "https://poidh.xyz/base",
    poidhV2Offset: 986,
    explorer: "https://basescan.org",
    minBountyAmount: "0.001ether",
    minContribution: "0.00001ether",
  },
  degen: {
    name: "Degen Chain",
    chainId: 666666666,
    rpcUrl: "https://rpc.degen.tips",
    poidhContract: "0x18E5585ca7cE31b90Bc8BB7aAf84152857cE243f",
    poidhBaseUrl: "https://poidh.xyz/degen",
    poidhV2Offset: 1197,
    explorer: "https://explorer.degen.tips",
    minBountyAmount: "1000 DEGEN",
    minContribution: "10 DEGEN",
  },
} as const;

export const currentChainConfig = CHAIN_CONFIG[config.targetChain];

// ============================================================================
// Export Configuration
// ============================================================================

export default config;
