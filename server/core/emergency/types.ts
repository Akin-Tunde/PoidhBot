/**
 * Emergency Revenue Generator Types
 */

export interface EmergencyConfig {
  emergencyThreshold: bigint;
  criticalThreshold: bigint;
  maxEmergencyDuration: number; // milliseconds
  enableAutoRecovery: boolean;
}

export interface EmergencyMetrics {
  triggeredCount: number;
  successCount: number;
  failureCount: number;
  totalRevenueGenerated: bigint;
  averageRecoveryTime: number; // milliseconds
  lastTriggeredAt?: Date;
}
