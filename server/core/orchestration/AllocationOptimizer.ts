import { Logger } from '../logger/Logger';
import { BaseStrategy } from '../strategies/BaseStrategy';
import { StrategyMetrics } from '../strategies/types';

/**
 * Allocation configuration options
 */
export interface AllocationConfig {
  strategy: 'equal' | 'performance-weighted' | 'risk-adjusted' | 'dynamic';
  minAllocation: number;
  maxAllocation: number;
  rebalanceThreshold: number;
  riskTolerance: 'low' | 'medium' | 'high';
}

/**
 * Allocation result
 */
export interface AllocationResult {
  allocations: Map<string, bigint>;
  totalAllocated: bigint;
  rationale: string;
  confidence: number;
  timestamp: Date;
}

/**
 * Strategy allocation info
 */
export interface StrategyAllocation {
  strategyName: string;
  currentAllocation: bigint;
  recommendedAllocation: bigint;
  weight: number;
  roi: number;
  riskScore: number;
}

/**
 * AllocationOptimizer intelligently allocates capital between strategies
 */
export class AllocationOptimizer {
  private logger: Logger;
  private allocationHistory: AllocationResult[] = [];
  private maxHistorySize: number = 100;

  constructor(context: string = 'AllocationOptimizer') {
    this.logger = new Logger(context);
  }

  /**
   * Calculate optimal capital allocation
   */
  async calculateAllocation(
    strategies: BaseStrategy[],
    totalCapital: bigint,
    config: AllocationConfig
  ): Promise<AllocationResult> {
    this.logger.info('Calculating optimal allocation', {
      strategiesCount: strategies.length,
      totalCapital: totalCapital.toString(),
      strategy: config.strategy,
    });

    try {
      const metrics = strategies.map(s => s.getMetrics());

      let weights: Map<string, number>;

      switch (config.strategy) {
        case 'equal':
          weights = this.calculateEqualWeights(metrics);
          break;
        case 'performance-weighted':
          weights = this.calculatePerformanceWeights(metrics);
          break;
        case 'risk-adjusted':
          weights = this.calculateRiskAdjustedWeights(metrics, config.riskTolerance);
          break;
        case 'dynamic':
          weights = this.calculateDynamicWeights(metrics, config.riskTolerance);
          break;
        default:
          weights = this.calculateEqualWeights(metrics);
      }

      const constrainedWeights = this.applyConstraints(weights, config);
      const allocations = this.weightsToAllocations(constrainedWeights, totalCapital);
      const confidence = this.calculateConfidence(metrics, allocations);
      const rationale = this.generateRationale(config.strategy, metrics, allocations);

      const result: AllocationResult = {
        allocations,
        totalAllocated: this.sumAllocations(allocations),
        rationale,
        confidence,
        timestamp: new Date(),
      };

      this.storeAllocationHistory(result);

      this.logger.info('Allocation calculated', {
        confidence,
        rationale,
        allocationsCount: allocations.size,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to calculate allocation', error);
      throw error;
    }
  }

  /**
   * Check if rebalancing is needed
   */
  shouldRebalance(
    currentAllocation: Map<string, bigint>,
    newMetrics: StrategyMetrics[],
    threshold: number = 10
  ): boolean {
    if (currentAllocation.size === 0) {
      return true;
    }

    const totalAllocated = this.sumAllocations(currentAllocation);
    if (totalAllocated === 0n) {
      return true;
    }

    const weights = this.calculatePerformanceWeights(newMetrics);
    const recommendedAllocations = this.weightsToAllocations(weights, totalAllocated);

    for (const [strategyName, currentAmount] of currentAllocation) {
      const recommendedAmount = recommendedAllocations.get(strategyName) || 0n;
      const currentPercent = Number((currentAmount * 100n) / totalAllocated);
      const recommendedPercent = Number((recommendedAmount * 100n) / totalAllocated);
      const percentChange = Math.abs(currentPercent - recommendedPercent);

      if (percentChange > threshold) {
        this.logger.info(`Rebalancing needed for ${strategyName}`, {
          currentPercent,
          recommendedPercent,
          percentChange,
        });
        return true;
      }
    }

    return false;
  }

  /**
   * Get allocation history
   */
  getAllocationHistory(limit?: number): AllocationResult[] {
    if (limit === undefined) {
      return [...this.allocationHistory];
    }
    return this.allocationHistory.slice(-limit);
  }

  /**
   * Clear allocation history
   */
  clearHistory(): void {
    this.allocationHistory = [];
    this.logger.info('Allocation history cleared');
  }

  // ============ Private Methods ============

  private calculateEqualWeights(metrics: StrategyMetrics[]): Map<string, number> {
    const weights = new Map<string, number>();
    const weight = 1 / metrics.length;

    for (const metric of metrics) {
      weights.set(metric.name, weight);
    }

    return weights;
  }

  private calculatePerformanceWeights(metrics: StrategyMetrics[]): Map<string, number> {
    const weights = new Map<string, number>();

    let totalWeight = 0;
    const roiWeights: Map<string, number> = new Map();

    for (const metric of metrics) {
      const weight = Math.max(0, metric.roi + 100);
      roiWeights.set(metric.name, weight);
      totalWeight += weight;
    }

    if (totalWeight === 0) {
      return this.calculateEqualWeights(metrics);
    }

    for (const [name, weight] of roiWeights) {
      weights.set(name, weight / totalWeight);
    }

    return weights;
  }

  private calculateRiskAdjustedWeights(
    metrics: StrategyMetrics[],
    riskTolerance: 'low' | 'medium' | 'high'
  ): Map<string, number> {
    const weights = new Map<string, number>();

    const riskMultipliers = {
      low: 0.5,
      medium: 1.0,
      high: 1.5,
    };

    const multiplier = riskMultipliers[riskTolerance];

    let totalScore = 0;
    const scores: Map<string, number> = new Map();

    for (const metric of metrics) {
      const successRate = Math.max(0.01, metric.successRate / 100);
      const score = (metric.roi / successRate) * multiplier;
      scores.set(metric.name, Math.max(0, score));
      totalScore += Math.max(0, score);
    }

    if (totalScore === 0) {
      return this.calculateEqualWeights(metrics);
    }

    for (const [name, score] of scores) {
      weights.set(name, score / totalScore);
    }

    return weights;
  }

  private calculateDynamicWeights(
    metrics: StrategyMetrics[],
    riskTolerance: 'low' | 'medium' | 'high'
  ): Map<string, number> {
    return this.calculateRiskAdjustedWeights(metrics, riskTolerance);
  }

  private applyConstraints(
    weights: Map<string, number>,
    config: AllocationConfig
  ): Map<string, number> {
    const constrained = new Map<string, number>();
    const minWeight = config.minAllocation / 100;
    const maxWeight = config.maxAllocation / 100;

    let totalWeight = 0;

    for (const [name, weight] of weights) {
      const constrainedWeight = Math.max(minWeight, Math.min(maxWeight, weight));
      constrained.set(name, constrainedWeight);
      totalWeight += constrainedWeight;
    }

    if (totalWeight > 0) {
      for (const [name, weight] of constrained) {
        constrained.set(name, weight / totalWeight);
      }
    }

    return constrained;
  }

  private weightsToAllocations(
    weights: Map<string, number>,
    totalCapital: bigint
  ): Map<string, bigint> {
    const allocations = new Map<string, bigint>();

    for (const [name, weight] of weights) {
      const allocation = BigInt(Math.floor(Number(totalCapital) * weight));
      allocations.set(name, allocation);
    }

    return allocations;
  }

  private calculateConfidence(
    metrics: StrategyMetrics[],
    allocations: Map<string, bigint>
  ): number {
    let confidence = 50;

    const successRates = metrics.map(m => m.successRate);
    const avgSuccessRate = successRates.reduce((a, b) => a + b, 0) / successRates.length;

    if (avgSuccessRate > 80) {
      confidence += 30;
    } else if (avgSuccessRate > 60) {
      confidence += 15;
    }

    const allocationsArray = Array.from(allocations.values());
    const avgAllocation = allocationsArray.reduce((a, b) => a + b, 0n) / BigInt(allocationsArray.length);
    const variance = allocationsArray.reduce((sum, a) => {
      const diff = Number(a - avgAllocation);
      return sum + diff * diff;
    }, 0) / allocationsArray.length;

    if (variance < Number(avgAllocation) * 0.5) {
      confidence += 10;
    }

    return Math.min(100, confidence);
  }

  private generateRationale(
    strategy: string,
    metrics: StrategyMetrics[],
    allocations: Map<string, bigint>
  ): string {
    const topStrategy = metrics.reduce((prev, current) =>
      prev.roi > current.roi ? prev : current
    );

    const rationale = `Using ${strategy} allocation strategy. ` +
      `Top performer: ${topStrategy.name} (${topStrategy.roi.toFixed(2)}% ROI). ` +
      `Allocated to ${allocations.size} strategies for diversification.`;

    return rationale;
  }

  private sumAllocations(allocations: Map<string, bigint>): bigint {
    let sum = 0n;
    for (const amount of allocations.values()) {
      sum += amount;
    }
    return sum;
  }

  private storeAllocationHistory(result: AllocationResult): void {
    this.allocationHistory.push(result);

    if (this.allocationHistory.length > this.maxHistorySize) {
      const removeCount = this.allocationHistory.length - this.maxHistorySize;
      this.allocationHistory.splice(0, removeCount);
    }
  }
}
