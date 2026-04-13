/**
 * Orchestration-related types
 */

export interface OrchestrationConfig {
  executionInterval: number; // milliseconds
  parallelExecutionEnabled: boolean;
  errorHandling: 'fail-fast' | 'continue-on-error';
  maxConcurrentStrategies: number;
  timeoutMs: number;
}

export interface ExecutionContext {
  executionId: string;
  timestamp: Date;
  walletBalance: bigint;
  isEmergency: boolean;
  strategiesEnabled: number;
  strategiesDisabled: number;
}
