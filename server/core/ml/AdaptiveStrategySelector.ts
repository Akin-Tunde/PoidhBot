import { Logger, LogLevel } from '../logger/Logger';
import type { StrategyMetrics } from '../strategies/types';

/**
 * Market conditions
 */
export interface MarketConditions {
  timestamp: Date;
  volatility: number; // 0-100
  trend: 'bullish' | 'bearish' | 'neutral';
  momentum: number; // -100 to 100
  liquidityScore: number; // 0-100
  fearGreedIndex?: number; // 0-100
}

/**
 * Strategy recommendation
 */
export interface StrategyRecommendation {
  strategyName: string;
  score: number; // 0-100
  confidence: number; // 0-100
  reasoning: string;
  expectedROI: number; // %
  riskLevel: 'low' | 'medium' | 'high';
  allocatedCapital?: bigint;
}

/**
 * Model performance
 */
export interface ModelPerformance {
  timestamp: Date;
  accuracy: number; // 0-100
  precision: number; // 0-100
  recall: number; // 0-100
  f1Score: number; // 0-100
  totalPredictions: number;
  correctPredictions: number;
}

/**
 * Adaptive Strategy Selector
 *
 * Uses machine learning to dynamically select and optimize strategies
 * based on market conditions and historical performance.
 */
export class AdaptiveStrategySelector {
  private logger: Logger;
  private marketHistory: MarketConditions[] = [];
  private strategyPerformanceHistory: Map<string, StrategyMetrics[]> = new Map();
  private modelPerformance: ModelPerformance[] = [];
  private strategyWeights: Map<string, number> = new Map();
  private maxHistorySize: number = 1000;
  private minHistoryForTraining: number = 50;
  private modelUpdateInterval: number = 3600000; // 1 hour
  private lastModelUpdate: Date = new Date();

  constructor(logLevel: LogLevel = LogLevel.INFO) {
    this.logger = new Logger('AdaptiveStrategySelector', logLevel);
    this.logger.info('AdaptiveStrategySelector initialized');
  }

  /**
   * Record market conditions
   */
  recordMarketConditions(conditions: MarketConditions): void {
    this.marketHistory.push(conditions);

    if (this.marketHistory.length > this.maxHistorySize) {
      this.marketHistory = this.marketHistory.slice(-this.maxHistorySize);
    }

    // Check if model needs updating
    const timeSinceUpdate = Date.now() - this.lastModelUpdate.getTime();
    if (timeSinceUpdate > this.modelUpdateInterval) {
      this.updateModel();
    }
  }

  /**
   * Record strategy performance
   */
  recordStrategyPerformance(
    strategyName: string,
    metrics: StrategyMetrics
  ): void {
    if (!this.strategyPerformanceHistory.has(strategyName)) {
      this.strategyPerformanceHistory.set(strategyName, []);
    }

    const history = this.strategyPerformanceHistory.get(strategyName)!;
    history.push(metrics);

    if (history.length > this.maxHistorySize) {
      this.strategyPerformanceHistory.set(
        strategyName,
        history.slice(-this.maxHistorySize)
      );
    }
  }

  /**
   * Get strategy recommendations based on current market conditions
   */
  getRecommendations(
    strategyNames: string[],
    currentConditions: MarketConditions
  ): StrategyRecommendation[] {
    const recommendations: StrategyRecommendation[] = [];

    for (const strategyName of strategyNames) {
      try {
        const recommendation = this.scoreStrategy(
          strategyName,
          currentConditions
        );
        recommendations.push(recommendation);
      } catch (error) {
        this.logger.warn(`Error scoring strategy ${strategyName}`, error);
      }
    }

    // Sort by score (highest first)
    recommendations.sort((a, b) => b.score - a.score);

    this.logger.info('Strategy recommendations generated', {
      count: recommendations.length,
      topStrategy: recommendations[0]?.strategyName,
      topScore: recommendations[0]?.score.toFixed(2),
    });

    return recommendations;
  }

  /**
   * Score a strategy based on market conditions and historical performance
   */
  private scoreStrategy(
    strategyName: string,
    conditions: MarketConditions
  ): StrategyRecommendation {
    let score = 50; // Base score
    let confidence = 50;
    let reasoning = '';
    let expectedROI = 0;
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';

    // Get historical performance
    const history = this.strategyPerformanceHistory.get(strategyName) || [];
    const hasHistory = history.length > 0;

    if (hasHistory) {
      const recentMetrics = history.slice(-10); // Last 10 executions
      const avgROI = recentMetrics.reduce((sum, m) => sum + m.roi, 0) / recentMetrics.length;
      const avgVolatility = recentMetrics.reduce((sum, m) => sum + (m.volatility || 0), 0) /
        recentMetrics.length;

      expectedROI = avgROI;

      // Adjust score based on historical performance
      score += Math.min(avgROI / 2, 25); // Max +25 points for ROI

      // Determine risk level
      if (avgVolatility < 10) {
        riskLevel = 'low';
        score += 10;
      } else if (avgVolatility < 30) {
        riskLevel = 'medium';
      } else {
        riskLevel = 'high';
        score -= 10;
      }

      confidence = Math.min(history.length * 2, 95); // Increase confidence with more history
    }

    // Adjust score based on market conditions
    const conditionAdjustment = this.getConditionAdjustment(
      strategyName,
      conditions
    );
    score += conditionAdjustment;

    // Apply strategy-specific weights
    const weight = this.strategyWeights.get(strategyName) || 1;
    score *= weight;

    // Ensure score is within 0-100
    score = Math.max(0, Math.min(100, score));

    // Generate reasoning
    reasoning = this.generateReasoning(strategyName, conditions, score, hasHistory);

    return {
      strategyName,
      score,
      confidence,
      reasoning,
      expectedROI,
      riskLevel,
    };
  }

  /**
   * Get market condition adjustment for a strategy
   */
  private getConditionAdjustment(
    strategyName: string,
    conditions: MarketConditions
  ): number {
    let adjustment = 0;

    // Analyze strategy name to determine market preference
    const nameLower = strategyName.toLowerCase();

    if (nameLower.includes('trading')) {
      // Trading strategies perform better in volatile markets
      if (conditions.volatility > 60) {
        adjustment += 15;
      } else if (conditions.volatility < 20) {
        adjustment -= 10;
      }

      // Trading strategies perform better with bullish trend
      if (conditions.trend === 'bullish') {
        adjustment += 10;
      } else if (conditions.trend === 'bearish') {
        adjustment -= 15;
      }
    } else if (nameLower.includes('defi') || nameLower.includes('yield')) {
      // DeFi strategies perform better in stable markets
      if (conditions.volatility < 40) {
        adjustment += 10;
      }

      // DeFi strategies work in all trends
      if (conditions.trend !== 'bearish') {
        adjustment += 5;
      }
    } else if (nameLower.includes('farcaster') || nameLower.includes('social')) {
      // Social strategies are less affected by market conditions
      adjustment += 5;
    }

    // Apply liquidity adjustment
    if (conditions.liquidityScore > 70) {
      adjustment += 5;
    } else if (conditions.liquidityScore < 30) {
      adjustment -= 10;
    }

    return adjustment;
  }

  /**
   * Generate reasoning for recommendation
   */
  private generateReasoning(
    strategyName: string,
    conditions: MarketConditions,
    score: number,
    hasHistory: boolean
  ): string {
    const parts: string[] = [];

    if (score > 75) {
      parts.push('Highly recommended');
    } else if (score > 50) {
      parts.push('Recommended');
    } else {
      parts.push('Not recommended');
    }

    parts.push(`for current market conditions`);

    if (conditions.trend === 'bullish') {
      parts.push('(bullish trend)');
    } else if (conditions.trend === 'bearish') {
      parts.push('(bearish trend)');
    }

    if (conditions.volatility > 60) {
      parts.push('with high volatility');
    } else if (conditions.volatility < 20) {
      parts.push('in stable market');
    }

    if (hasHistory) {
      parts.push('. Based on historical performance.');
    } else {
      parts.push('. Limited historical data.');
    }

    return parts.join(' ');
  }

  /**
   * Update the ML model
   */
  private updateModel(): void {
    if (this.marketHistory.length < this.minHistoryForTraining) {
      this.logger.debug('Insufficient history for model training');
      return;
    }

    this.logger.info('Updating adaptive strategy model');

    try {
      // Simplified model training
      // In a real implementation, this would use actual ML algorithms

      // Calculate strategy weights based on performance
      for (const [strategyName, history] of this.strategyPerformanceHistory) {
        if (history.length > 0) {
          const avgROI = history.reduce((sum, m) => sum + m.roi, 0) / history.length;
          const weight = 0.5 + (avgROI / 100); // Weight between 0.5 and 1.5
          this.strategyWeights.set(strategyName, Math.max(0.1, Math.min(2, weight)));
        }
      }

      // Calculate model performance metrics
      const performance = this.calculateModelPerformance();
      this.modelPerformance.push(performance);

      if (this.modelPerformance.length > 100) {
        this.modelPerformance = this.modelPerformance.slice(-100);
      }

      this.lastModelUpdate = new Date();

      this.logger.info('Model updated successfully', {
        accuracy: performance.accuracy.toFixed(2),
        strategies: this.strategyWeights.size,
      });
    } catch (error) {
      this.logger.error('Error updating model', error);
    }
  }

  /**
   * Calculate model performance metrics
   */
  private calculateModelPerformance(): ModelPerformance {
    let correctPredictions = 0;
    let totalPredictions = 0;

    // Simplified calculation: compare recommendations with actual outcomes
    for (const [strategyName, history] of this.strategyPerformanceHistory) {
      if (history.length > 0) {
        const recentMetrics = history.slice(-5);
        for (const metrics of recentMetrics) {
          totalPredictions++;
          if (metrics.roi > 0) {
            correctPredictions++;
          }
        }
      }
    }

    const accuracy = totalPredictions > 0
      ? (correctPredictions / totalPredictions) * 100
      : 0;

    return {
      timestamp: new Date(),
      accuracy,
      precision: accuracy * 0.95, // Simplified
      recall: accuracy * 0.90, // Simplified
      f1Score: accuracy * 0.92, // Simplified
      totalPredictions,
      correctPredictions,
    };
  }

  /**
   * Get current market conditions
   */
  getCurrentMarketConditions(): MarketConditions | null {
    return this.marketHistory.length > 0
      ? this.marketHistory[this.marketHistory.length - 1]
      : null;
  }

  /**
   * Get market history
   */
  getMarketHistory(limit?: number): MarketConditions[] {
    if (limit) {
      return this.marketHistory.slice(-limit);
    }
    return [...this.marketHistory];
  }

  /**
   * Get strategy performance history
   */
  getStrategyPerformanceHistory(
    strategyName: string,
    limit?: number
  ): StrategyMetrics[] {
    const history = this.strategyPerformanceHistory.get(strategyName) || [];
    if (limit) {
      return history.slice(-limit);
    }
    return [...history];
  }

  /**
   * Get model performance history
   */
  getModelPerformanceHistory(limit?: number): ModelPerformance[] {
    if (limit) {
      return this.modelPerformance.slice(-limit);
    }
    return [...this.modelPerformance];
  }

  /**
   * Get current model performance
   */
  getCurrentModelPerformance(): ModelPerformance | null {
    return this.modelPerformance.length > 0
      ? this.modelPerformance[this.modelPerformance.length - 1]
      : null;
  }

  /**
   * Get strategy weights
   */
  getStrategyWeights(): Map<string, number> {
    return new Map(this.strategyWeights);
  }

  /**
   * Set strategy weight manually
   */
  setStrategyWeight(strategyName: string, weight: number): void {
    this.strategyWeights.set(strategyName, Math.max(0.1, Math.min(2, weight)));
    this.logger.info(`Strategy weight updated: ${strategyName} = ${weight}`);
  }

  /**
   * Get strategy statistics
   */
  getStrategyStatistics(strategyName: string): {
    executionCount: number;
    averageROI: number;
    averageVolatility: number;
    winRate: number;
    weight: number;
  } {
    const history = this.strategyPerformanceHistory.get(strategyName) || [];

    if (history.length === 0) {
      return {
        executionCount: 0,
        averageROI: 0,
        averageVolatility: 0,
        winRate: 0,
        weight: this.strategyWeights.get(strategyName) || 1,
      };
    }

    const averageROI = history.reduce((sum, m) => sum + m.roi, 0) / history.length;
    const averageVolatility = history.reduce((sum, m) => sum + (m.volatility || 0), 0) /
      history.length;
    const winCount = history.filter(m => m.roi > 0).length;
    const winRate = (winCount / history.length) * 100;

    return {
      executionCount: history.length,
      averageROI,
      averageVolatility,
      winRate,
      weight: this.strategyWeights.get(strategyName) || 1,
    };
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.marketHistory = [];
    this.strategyPerformanceHistory.clear();
    this.modelPerformance = [];
    this.logger.info('Adaptive strategy selector history cleared');
  }

  /**
   * Get selector statistics
   */
  getSelectorStatistics(): {
    marketDataPoints: number;
    strategiesTracked: number;
    modelUpdates: number;
    averageModelAccuracy: number;
  } {
    const averageModelAccuracy = this.modelPerformance.length > 0
      ? this.modelPerformance.reduce((sum, m) => sum + m.accuracy, 0) /
        this.modelPerformance.length
      : 0;

    return {
      marketDataPoints: this.marketHistory.length,
      strategiesTracked: this.strategyPerformanceHistory.size,
      modelUpdates: this.modelPerformance.length,
      averageModelAccuracy,
    };
  }
}
