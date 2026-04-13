import { z } from 'zod';

export const AgentConfigSchema = z.object({
  // Blockchain Configuration
  chain: z.enum(['arbitrum', 'base', 'degen']).default('arbitrum'),
  rpcUrl: z.string().url('Invalid RPC URL'),
  privateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid private key format'),

  // Wallet Configuration
  minBalance: z.string().default('0.1'),
  emergencyThreshold: z.string().default('0.01'),

  // Strategy Configuration
  strategies: z.object({
    yieldFarming: z.object({
      enabled: z.boolean().default(true),
      minAPY: z.number().default(5),
      protocols: z.array(z.string()).default(['aave', 'compound']),
    }).optional(),
    trading: z.object({
      enabled: z.boolean().default(false),
      maxPositionSize: z.string().default('1'),
      stopLossPercent: z.number().default(5),
    }).optional(),
    farcaster: z.object({
      enabled: z.boolean().default(false),
      apiKey: z.string().optional(),
    }).optional(),
  }).optional(),

  // API Configuration
  apis: z.object({
    openRouter: z.string().optional(),
    neynar: z.string().optional(),
    pinata: z.string().optional(),
  }).optional(),

  // Logging
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Environment
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
