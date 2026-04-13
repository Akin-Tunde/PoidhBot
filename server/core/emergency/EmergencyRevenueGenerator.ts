import { Logger, LogLevel } from '../logger/Logger';
import { BaseStrategy } from '../strategies/BaseStrategy';
import type { StrategyMetrics } from '../strategies/types';

/**
 * Emergency strategy configuration
 */
export interface EmergencyStrategy {
  name: string;
  strategy: BaseStrategy;
  yieldRate: number; // Expected yield rate (%)
  riskLevel: 'low' | 'medium' | 'high'; // Risk level
  minCapital: bigint; // Minimum capital required
  maxCapital: bigint; // Maximum capital to allocate
  priority: number; // 1-10, higher = more priority
}

/**
 * Emergency revenue generation result
 */
export interface EmergencyResult {
  triggered: boolean;
  timestamp: Date;
  reason: string;
  strategiesActivated: string[];
  totalCapitalAllocated: bigint;
  estimatedRevenue: bigint;
  executionDuration: number; // milliseconds
  success: boolean;
  error?: string;
}

/**
 * Emergency Revenue Generator
 *
 * Detects critical wallet conditions and triggers high-yield emergency strategies
 * to restore wallet health and maintain agent autonomy.
 */
export class EmergencyRevenueGenerator {
  private logger: Logger;
  private emergencyStrategies: Map<string, EmergencyStrategy> = new Map();
  private emergencyThreshold: bigint;
  private criticalThreshold: bigint;
  private executionHistory: EmergencyResult[] = [];
  private maxHistorySize: number = 100;
  private isEmergencyActive: boolean = false;

  constructor(
    emergencyThreshold: bigint,
    criticalThreshold: bigint,
    logLevel: LogLevel = LogLevel.INFO
  ) {
    this.logger = new Logger('EmergencyRevenueGenerator', logLevel);
    this.emergencyThreshold = emergencyThreshold;
    this.criticalThreshold = criticalThreshold;

    this.logger.info('EmergencyRevenueGenerator initialized', {
      emergencyThreshold: emergencyThreshold.toString(),
      criticalThreshold: criticalThreshold.toString(),
    });
  }

  /**
   * Register an emergency strategy
   */
  registerEmergencyStrategy(strategy: EmergencyStrategy): void {
    if (this.emergencyStrategies.has(strategy.name)) {
      this.logger.warn(`Emergency strategy ${strategy.name} already registered`);
      return;
    }

    this.emergencyStrategies.set(strategy.name, strategy);
    this.logger.info(`Emergency strategy registered: ${strategy.name}`, {
      priority: strategy.priority,
      yieldRate: strategy.yieldRate,
      riskLevel: strategy.riskLevel,
    });
  }

  /**
   * Unregister an emergency strategy
   */
  unregisterEmergencyStrategy(name: string): void {
    this.emergencyStrategies.delete(name);
    this.logger.info(`Emergency strategy unregistered: ${name}`);
  }

  /**
   * Check if emergency conditions are met
   */
  isEmergencyCondition(currentBalance: bigint): boolean {
    return currentBalance <= this.emergencyThreshold;
  }

  /**
   * Check if critical conditions are met
   */
  isCriticalCondition(currentBalance: bigint): boolean {
    return currentBalance <= this.criticalThreshold;
  }

  /**
   * Get emergency severity level
   */
  getEmergencySeverity(currentBalance: bigint): 'none' | 'warning' | 'critical' {
    if (currentBalance > this.emergencyThreshold) {
      return 'none';
    }
    if (currentBalance <= this.criticalThreshold) {
      return 'critical';
    }
    return 'warning';
  }

  /**
   * Execute emergency revenue generation
   */
  async executeEmergency(
    currentBalance: bigint,
    availableCapital: bigint
  ): Promise<EmergencyResult> {
    const startTime = Date.now();
    const result: EmergencyResult = {
      triggered: false,
      timestamp: new Date(),
      reason: '',
      strategiesActivated: [],
      totalCapitalAllocated: 0n,
      estimatedRevenue: 0n,
      executionDuration: 0,
      success: false,
    };

    try {
      // Check if emergency conditions are met
      const severity = this.getEmergencySeverity(currentBalance);
      if (severity === 'none') {
        result.reason = 'No emergency condition detected';
        this.executionHistory.push(result);
        return result;
      }

      result.triggered = true;
      result.reason = `Emergency triggered: ${severity} condition (balance: ${currentBalance.toString()})`;

      this.logger.warn('EMERGENCY REVENUE GENERATION ACTIVATED', {
        severity,
        balance: currentBalance.toString(),
        availableCapital: availableCapital.toString(),
      });

      this.isEmergencyActive = true;

      // Sort emergency strategies by priority and yield rate
      const sortedStrategies = Array.from(this.emergencyStrategies.values())
        .sort((a, b) => {
          // Higher priority first
          if (b.priority !== a.priority) {
            return b.priority - a.priority;
          }
          // Higher yield rate second
          return b.yieldRate - a.yieldRate;
        });

      let totalAllocated = 0n;
      let totalEstimatedRevenue = 0n;

      // Execute emergency strategies
      for (const emergencyStrat of sortedStrategies) {
        if (totalAllocated >= availableCapital) {
          break;
        }

        try {
          // Calculate capital to allocate
          const remainingCapital = availableCapital - totalAllocated;
          const capitalToAllocate = this.calculateEmergencyAllocation(
            remainingCapital,
            emergencyStrat
          );

          if (capitalToAllocate < emergencyStrat.minCapital) {
            this.logger.debug(
              `Insufficient capital for ${emergencyStrat.name}`,
              {
                required: emergencyStrat.minCapital.toString(),
                available: capitalToAllocate.toString(),
              }
            );
            continue;
          }

          // Execute the emergency strategy
          const strategyResult = await emergencyStrat.strategy.execute(
            capitalToAllocate
          );

          if (strategyResult.success) {
            result.strategiesActivated.push(emergencyStrat.name);
            totalAllocated += capitalToAllocate;

            // Estimate revenue based on yield rate
            const estimatedRevenue = (capitalToAllocate * BigInt(emergencyStrat.yieldRate)) / 100n;
            totalEstimatedRevenue += estimatedRevenue;

            this.logger.info(
              `Emergency strategy executed: ${emergencyStrat.name}`,
              {
                allocated: capitalToAllocate.toString(),
                estimatedRevenue: estimatedRevenue.toString(),
                profit: strategyResult.profit.toString(),
              }
            );
          } else {
            this.logger.warn(
              `Emergency strategy failed: ${emergencyStrat.name}`,
              {
                error: strategyResult.error,
              }
            );
          }
        } catch (error) {
          this.logger.error(
            `Error executing emergency strategy ${emergencyStrat.name}`,
            error
          );
        }
      }

      result.totalCapitalAllocated = totalAllocated;
      result.estimatedRevenue = totalEstimatedRevenue;
      result.success = result.strategiesActivated.length > 0;

      this.logger.info('Emergency revenue generation completed', {
        strategiesActivated: result.strategiesActivated.length,
        totalAllocated: totalAllocated.toString(),
        estimatedRevenue: totalEstimatedRevenue.toString(),
      });

      this.isEmergencyActive = false;
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : String(error);
      this.logger.error('Emergency revenue generation failed', error);
      this.isEmergencyActive = false;
    }

    result.executionDuration = Date.now() - startTime;
    this.executionHistory.push(result);

    // Maintain history size
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
    }

    return result;
  }

  /**
   * Calculate capital to allocate for emergency strategy
   */
  private calculateEmergencyAllocation(
    availableCapital: bigint,
    emergencyStrat: EmergencyStrategy
  ): bigint {
    const allocation = availableCapital > emergencyStrat.maxCapital
      ? emergencyStrat.maxCapital
      : availableCapital;

    return allocation;
  }

  /**
   * Get emergency status
   */
  getEmergencyStatus(): {
    isActive: boolean;
    strategiesCount: number;
    executionCount: number;
    successCount: number;
  } {
    const successCount = this.executionHistory.filter(r => r.success).length;

    return {
      isActive: this.isEmergencyActive,
      strategiesCount: this.emergencyStrategies.size,
      executionCount: this.executionHistory.length,
      successCount,
    };
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit?: number): EmergencyResult[] {
    if (limit) {
      return this.executionHistory.slice(-limit);
    }
    return [...this.executionHistory];
  }

  /**
   * Clear execution history
   */
  clearExecutionHistory(): void {
    this.executionHistory = [];
    this.logger.info('Emergency execution history cleared');
  }

  /**
   * Get registered emergency strategies
   */
  getEmergencyStrategies(): EmergencyStrategy[] {
    return Array.from(this.emergencyStrategies.values());
  }

  /**
   * Update emergency thresholds
   */
  updateThresholds(emergencyThreshold: bigint, criticalThreshold: bigint): void {
    this.emergencyThreshold = emergencyThreshold;
    this.criticalThreshold = criticalThreshold;
    this.logger.info('Emergency thresholds updated', {
      emergencyThreshold: emergencyThreshold.toString(),
      criticalThreshold: criticalThreshold.toString(),
    });
  }

  /**
   * Get recommended emergency strategy for current conditions
   */
  getRecommendedStrategy(severity: 'warning' | 'critical'): EmergencyStrategy | null {
    const strategies = Array.from(this.emergencyStrategies.values())
      .filter(s => {
        if (severity === 'critical') {
          return s.riskLevel !== 'high'; // Avoid high-risk strategies in critical
        }
        return true; // All strategies available for warning
      })
      .sort((a, b) => b.priority - a.priority);

    return strategies.length > 0 ? strategies[0] : null;
  }
}
