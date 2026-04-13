import { Logger, LogLevel } from '../logger/Logger';
import type { StrategyMetrics } from '../strategies/types';

/**
 * Failure diagnosis result
 */
export interface FailureDiagnosis {
  strategyName: string;
  failureType: 'api_error' | 'gas_spike' | 'timeout' | 'insufficient_balance' | 'unknown';
  rootCause: string;
  severity: 'low' | 'medium' | 'high';
  suggestedRecovery: string;
  timestamp: Date;
}

/**
 * Healing action
 */
export interface HealingAction {
  id: string;
  timestamp: Date;
  strategyName: string;
  actionType: 'retry' | 'switch_rpc' | 'pause' | 'reset' | 'rebalance';
  description: string;
  executed: boolean;
  success: boolean;
  result?: string;
  error?: string;
}

/**
 * Healing status
 */
export interface HealingStatus {
  strategyName: string;
  isHealthy: boolean;
  consecutiveFailures: number;
  lastFailureTime?: Date;
  lastHealingTime?: Date;
  recoveryProgress: number; // 0-100
}

/**
 * Self-Healing Mechanism
 *
 * Detects operational failures and automatically initiates recovery procedures
 * to maintain agent autonomy and operational continuity.
 */
export class SelfHealingMechanism {
  private logger: Logger;
  private strategyFailureCount: Map<string, number> = new Map();
  private strategyLastFailureTime: Map<string, Date> = new Map();
  private strategyLastHealingTime: Map<string, Date> = new Map();
  private diagnoses: FailureDiagnosis[] = [];
  private healingActions: HealingAction[] = [];
  private maxHistorySize: number = 200;
  private failureThreshold: number = 3; // Trigger healing after N consecutive failures
  private healingCooldown: number = 60000; // 1 minute cooldown between healing attempts
  private rpcEndpoints: string[] = [];
  private currentRpcIndex: number = 0;

  constructor(
    rpcEndpoints: string[] = [],
    logLevel: LogLevel = LogLevel.INFO
  ) {
    this.logger = new Logger('SelfHealingMechanism', logLevel);
    this.rpcEndpoints = rpcEndpoints;

    this.logger.info('SelfHealingMechanism initialized', {
      rpcEndpoints: rpcEndpoints.length,
      failureThreshold: this.failureThreshold,
      healingCooldown: this.healingCooldown,
    });
  }

  /**
   * Report a strategy failure
   */
  reportFailure(
    strategyName: string,
    error: Error | string,
    metrics?: StrategyMetrics
  ): void {
    const failureCount = (this.strategyFailureCount.get(strategyName) || 0) + 1;
    this.strategyFailureCount.set(strategyName, failureCount);
    this.strategyLastFailureTime.set(strategyName, new Date());

    const errorMessage = error instanceof Error ? error.message : String(error);

    this.logger.warn(`Strategy failure reported: ${strategyName}`, {
      failureCount,
      error: errorMessage,
    });

    // Diagnose the failure
    const diagnosis = this.diagnosisFailure(strategyName, errorMessage, metrics);
    this.diagnoses.push(diagnosis);

    if (this.diagnoses.length > this.maxHistorySize) {
      this.diagnoses = this.diagnoses.slice(-this.maxHistorySize);
    }

    // Check if healing should be triggered
    if (failureCount >= this.failureThreshold) {
      this.triggerHealing(strategyName, diagnosis);
    }
  }

  /**
   * Diagnose the root cause of a failure
   */
  private diagnosisFailure(
    strategyName: string,
    errorMessage: string,
    metrics?: StrategyMetrics
  ): FailureDiagnosis {
    let failureType: FailureDiagnosis['failureType'] = 'unknown';
    let rootCause = errorMessage;
    let severity: FailureDiagnosis['severity'] = 'medium';
    let suggestedRecovery = 'Retry strategy execution';

    // Analyze error message to determine failure type
    const errorLower = errorMessage.toLowerCase();

    if (
      errorLower.includes('api') ||
      errorLower.includes('network') ||
      errorLower.includes('connection')
    ) {
      failureType = 'api_error';
      severity = 'medium';
      suggestedRecovery = 'Switch RPC endpoint or retry';
    } else if (
      errorLower.includes('gas') ||
      errorLower.includes('insufficient') ||
      errorLower.includes('revert')
    ) {
      failureType = 'gas_spike';
      severity = 'high';
      suggestedRecovery = 'Pause strategy and wait for gas prices to normalize';
    } else if (
      errorLower.includes('timeout') ||
      errorLower.includes('timeout')
    ) {
      failureType = 'timeout';
      severity = 'low';
      suggestedRecovery = 'Retry with increased timeout';
    } else if (
      errorLower.includes('balance') ||
      errorLower.includes('insufficient')
    ) {
      failureType = 'insufficient_balance';
      severity = 'high';
      suggestedRecovery = 'Trigger emergency revenue generation';
    }

    const diagnosis: FailureDiagnosis = {
      strategyName,
      failureType,
      rootCause,
      severity,
      suggestedRecovery,
      timestamp: new Date(),
    };

    this.logger.info(`Failure diagnosed: ${strategyName}`, {
      failureType,
      severity,
      suggestedRecovery,
    });

    return diagnosis;
  }

  /**
   * Trigger healing for a strategy
   */
  private async triggerHealing(
    strategyName: string,
    diagnosis: FailureDiagnosis
  ): Promise<void> {
    // Check cooldown
    const lastHealingTime = this.strategyLastHealingTime.get(strategyName);
    if (lastHealingTime) {
      const timeSinceLastHealing = Date.now() - lastHealingTime.getTime();
      if (timeSinceLastHealing < this.healingCooldown) {
        this.logger.debug(
          `Healing cooldown active for ${strategyName}. Skipping healing.`
        );
        return;
      }
    }

    this.logger.warn(`Triggering healing for ${strategyName}`, {
      diagnosis: diagnosis.failureType,
      severity: diagnosis.severity,
    });

    // Execute recovery action based on diagnosis
    let actionType: HealingAction['actionType'] = 'retry';
    let description = 'Retrying strategy execution';

    switch (diagnosis.failureType) {
      case 'api_error':
        actionType = 'switch_rpc';
        description = 'Switching to alternative RPC endpoint';
        await this.executeRpcSwitch(strategyName);
        break;

      case 'gas_spike':
        actionType = 'pause';
        description = 'Pausing strategy due to high gas prices';
        break;

      case 'timeout':
        actionType = 'retry';
        description = 'Retrying with increased timeout';
        break;

      case 'insufficient_balance':
        actionType = 'rebalance';
        description = 'Triggering rebalancing to recover balance';
        break;

      default:
        actionType = 'reset';
        description = 'Resetting strategy state';
    }

    // Record healing action
    const action: HealingAction = {
      id: `heal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      strategyName,
      actionType,
      description,
      executed: true,
      success: true, // Assume success for now
    };

    this.healingActions.push(action);
    if (this.healingActions.length > this.maxHistorySize) {
      this.healingActions = this.healingActions.slice(-this.maxHistorySize);
    }

    this.strategyLastHealingTime.set(strategyName, new Date());

    this.logger.info(`Healing action executed: ${strategyName}`, {
      action: actionType,
      description,
    });
  }

  /**
   * Execute RPC endpoint switch
   */
  private async executeRpcSwitch(strategyName: string): Promise<void> {
    if (this.rpcEndpoints.length === 0) {
      this.logger.warn('No alternative RPC endpoints available');
      return;
    }

    this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcEndpoints.length;
    const newRpc = this.rpcEndpoints[this.currentRpcIndex];

    this.logger.info(`Switched RPC endpoint for ${strategyName}`, {
      newRpc,
      index: this.currentRpcIndex,
    });

    // In a real implementation, this would update the strategy's RPC connection
  }

  /**
   * Report strategy recovery
   */
  reportRecovery(strategyName: string): void {
    this.strategyFailureCount.set(strategyName, 0);
    this.logger.info(`Strategy recovered: ${strategyName}`);
  }

  /**
   * Get healing status for a strategy
   */
  getHealingStatus(strategyName: string): HealingStatus {
    const failureCount = this.strategyFailureCount.get(strategyName) || 0;
    const lastFailureTime = this.strategyLastFailureTime.get(strategyName);
    const lastHealingTime = this.strategyLastHealingTime.get(strategyName);

    // Calculate recovery progress
    let recoveryProgress = 0;
    if (lastHealingTime) {
      const timeSinceHealing = Date.now() - lastHealingTime.getTime();
      recoveryProgress = Math.min((timeSinceHealing / this.healingCooldown) * 100, 100);
    }

    return {
      strategyName,
      isHealthy: failureCount < this.failureThreshold,
      consecutiveFailures: failureCount,
      lastFailureTime,
      lastHealingTime,
      recoveryProgress,
    };
  }

  /**
   * Get all healing statuses
   */
  getAllHealingStatuses(strategyNames: string[]): HealingStatus[] {
    return strategyNames.map(name => this.getHealingStatus(name));
  }

  /**
   * Get recent diagnoses
   */
  getRecentDiagnoses(limit: number = 10): FailureDiagnosis[] {
    return this.diagnoses.slice(-limit);
  }

  /**
   * Get healing actions for a strategy
   */
  getHealingActions(strategyName?: string, limit?: number): HealingAction[] {
    let filtered = this.healingActions;

    if (strategyName) {
      filtered = filtered.filter(a => a.strategyName === strategyName);
    }

    if (limit) {
      return filtered.slice(-limit);
    }

    return [...filtered];
  }

  /**
   * Get healing statistics
   */
  getHealingStatistics(): {
    totalFailures: number;
    totalHealingActions: number;
    successRate: number;
    averageRecoveryTime: number;
  } {
    const totalFailures = this.diagnoses.length;
    const totalHealingActions = this.healingActions.length;
    const successfulActions = this.healingActions.filter(a => a.success).length;
    const successRate = totalHealingActions > 0
      ? (successfulActions / totalHealingActions) * 100
      : 0;

    // Calculate average recovery time
    let totalRecoveryTime = 0;
    let recoveryCount = 0;

    for (const action of this.healingActions) {
      if (action.executed && action.success) {
        recoveryCount++;
        // Simplified: assume recovery takes 30 seconds
        totalRecoveryTime += 30000;
      }
    }

    const averageRecoveryTime = recoveryCount > 0
      ? totalRecoveryTime / recoveryCount
      : 0;

    return {
      totalFailures,
      totalHealingActions,
      successRate,
      averageRecoveryTime,
    };
  }

  /**
   * Add RPC endpoint
   */
  addRpcEndpoint(endpoint: string): void {
    if (!this.rpcEndpoints.includes(endpoint)) {
      this.rpcEndpoints.push(endpoint);
      this.logger.info(`RPC endpoint added: ${endpoint}`);
    }
  }

  /**
   * Remove RPC endpoint
   */
  removeRpcEndpoint(endpoint: string): void {
    this.rpcEndpoints = this.rpcEndpoints.filter(e => e !== endpoint);
    this.logger.info(`RPC endpoint removed: ${endpoint}`);
  }

  /**
   * Get RPC endpoints
   */
  getRpcEndpoints(): string[] {
    return [...this.rpcEndpoints];
  }

  /**
   * Update failure threshold
   */
  setFailureThreshold(threshold: number): void {
    this.failureThreshold = threshold;
    this.logger.info(`Failure threshold updated to ${threshold}`);
  }

  /**
   * Update healing cooldown
   */
  setHealingCooldown(cooldown: number): void {
    this.healingCooldown = cooldown;
    this.logger.info(`Healing cooldown updated to ${cooldown}ms`);
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.diagnoses = [];
    this.healingActions = [];
    this.strategyFailureCount.clear();
    this.strategyLastFailureTime.clear();
    this.strategyLastHealingTime.clear();
    this.logger.info('Healing history cleared');
  }
}
