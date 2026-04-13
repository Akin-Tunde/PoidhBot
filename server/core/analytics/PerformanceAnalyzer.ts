import { Logger } from '../logger/Logger';
import { BaseStrategy } from '../strategies/BaseStrategy';
import { StrategyMetrics } from '../strategies/types';

/**
 * Comprehensive performance metrics
 */
export interface PerformanceMetrics {
  totalRevenue: bigint;
  totalExpenses: bigint;
  totalProfit: bigint;
  roi: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  executionCount: number;
  successCount: number;
  failureCount: number;
  avgExecutionTime: number;
  momentumScore: number;
  volatility: number;
}

/**
 * Strategy comparison
 */
export interface StrategyComparison {
  strategies: Array<{
    name: string;
    metrics: PerformanceMetrics;
    rank: number;
  }>;
  topPerformer: string;
  worstPerformer: string;
  averageROI: number;
}

/**
 * Performance trend
 */
export interface Trend {
  timestamp: Date;
  value: number;
  type: 'revenue' | 'profit' | 'roi' | 'successRate';
}

/**
 * Performance report
 */
export interface PerformanceReport {
  timestamp: Date;
  period: 'day' | 'week' | 'month';
  strategies: Array<{
    name: string;
    metrics: PerformanceMetrics;
  }>;
  summary: {
    totalRevenue: bigint;
    totalProfit: bigint;
    averageROI: number;
    topPerformer: string;
    recommendations: string[];
  };
}

/**
 * PerformanceAnalyzer provides comprehensive analysis of strategy performance
 */
export class PerformanceAnalyzer {
  private logger: Logger;
  private performanceHistory: Map<string, PerformanceMetrics[]> = new Map();
  private maxHistorySize: number = 100;
  private riskFreeRate: number = 0.02;

  constructor(context: string = 'PerformanceAnalyzer') {
    this.logger = new Logger(context);
  }

  /**
   * Analyze a single strategy
   */
  analyzeStrategy(strategy: BaseStrategy): PerformanceMetrics {
    const metrics = strategy.getMetrics();

    this.logger.debug(`Analyzing strategy: ${metrics.name}`);

    const totalProfit = metrics.profit;
    const roi = metrics.roi;
    const sharpeRatio = this.calculateSharpeRatio(metrics);
    const sortinoRatio = this.calculateSortinoRatio(metrics);
    const maxDrawdown = this.calculateMaxDrawdown(metrics);
    const winRate = metrics.successRate;
    const profitFactor = this.calculateProfitFactor(metrics);
    const volatility = this.calculateVolatility(metrics);
    const momentumScore = this.calculateMomentumScore(metrics);

    const analysis: PerformanceMetrics = {
      totalRevenue: metrics.revenue,
      totalExpenses: metrics.expenses,
      totalProfit,
      roi,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      winRate,
      profitFactor,
      executionCount: metrics.executionCount,
      successCount: metrics.successCount,
      failureCount: metrics.executionCount - metrics.successCount,
      avgExecutionTime: 0,
      momentumScore,
      volatility,
    };

    this.storePerformanceHistory(metrics.name, analysis);

    return analysis;
  }

  /**
   * Compare multiple strategies
   */
  compareStrategies(strategies: BaseStrategy[]): StrategyComparison {
    this.logger.info(`Comparing ${strategies.length} strategies`);

    const analyses = strategies.map(s => ({
      name: s.getName(),
      metrics: this.analyzeStrategy(s),
    }));

    analyses.sort((a, b) => b.metrics.roi - a.metrics.roi);

    const ranked = analyses.map((a, index) => ({
      ...a,
      rank: index + 1,
    }));

    const avgROI = analyses.reduce((sum, a) => sum + a.metrics.roi, 0) / analyses.length;

    return {
      strategies: ranked,
      topPerformer: ranked[0]?.name || 'N/A',
      worstPerformer: ranked[ranked.length - 1]?.name || 'N/A',
      averageROI: avgROI,
    };
  }

  /**
   * Get performance trends
   */
  getTrends(
    strategyName: string,
    period: 'day' | 'week' | 'month'
  ): Trend[] {
    const history = this.performanceHistory.get(strategyName) || [];

    if (history.length === 0) {
      return [];
    }

    const trends: Trend[] = history.map((metrics, index) => ({
      timestamp: new Date(Date.now() - (history.length - index) * 60000),
      value: metrics.roi,
      type: 'roi',
    }));

    return trends;
  }

  /**
   * Generate performance report
   */
  generateReport(strategies: BaseStrategy[]): PerformanceReport {
    this.logger.info('Generating performance report');

    const comparison = this.compareStrategies(strategies);

    let totalRevenue = 0n;
    let totalProfit = 0n;

    const strategiesAnalysis = strategies.map(s => {
      const metrics = this.analyzeStrategy(s);
      totalRevenue += metrics.totalRevenue;
      totalProfit += metrics.totalProfit;
      return {
        name: s.getName(),
        metrics,
      };
    });

    const avgROI = comparison.averageROI;
    const recommendations = this.generateRecommendations(comparison, strategies);

    return {
      timestamp: new Date(),
      period: 'day',
      strategies: strategiesAnalysis,
      summary: {
        totalRevenue,
        totalProfit,
        averageROI: avgROI,
        topPerformer: comparison.topPerformer,
        recommendations,
      },
    };
  }

  /**
   * Identify underperforming strategies
   */
  getUnderperformers(strategies: BaseStrategy[], threshold: number = 5): BaseStrategy[] {
    const comparison = this.compareStrategies(strategies);

    return strategies.filter(s => {
      const analysis = this.analyzeStrategy(s);
      return analysis.roi < comparison.averageROI - threshold;
    });
  }

  /**
   * Get performance rankings
   */
  getRankings(strategies: BaseStrategy[]): Array<{
    rank: number;
    name: string;
    roi: number;
    winRate: number;
    sharpeRatio: number;
  }> {
    const comparison = this.compareStrategies(strategies);

    return comparison.strategies.map(s => ({
      rank: s.rank,
      name: s.name,
      roi: s.metrics.roi,
      winRate: s.metrics.winRate,
      sharpeRatio: s.metrics.sharpeRatio,
    }));
  }

  /**
   * Clear performance history
   */
  clearHistory(): void {
    this.performanceHistory.clear();
    this.logger.info('Performance history cleared');
  }

  // ============ Private Methods ============

  private calculateSharpeRatio(metrics: StrategyMetrics): number {
    if (metrics.revenue === 0n) {
      return 0;
    }

    const returnRate = metrics.roi / 100;
    const volatility = Math.max(0.01, this.calculateVolatility(metrics));

    return (returnRate - this.riskFreeRate) / volatility;
  }

  private calculateSortinoRatio(metrics: StrategyMetrics): number {
    if (metrics.revenue === 0n) {
      return 0;
    }

    const returnRate = metrics.roi / 100;
    const downside = Math.max(0.01, this.calculateVolatility(metrics) * 0.7);

    return (returnRate - this.riskFreeRate) / downside;
  }

  private calculateMaxDrawdown(metrics: StrategyMetrics): number {
    if (metrics.revenue === 0n) {
      return 0;
    }

    const failureRate = (1 - metrics.successRate / 100) * 100;
    return Math.min(100, failureRate * 2);
  }

  private calculateProfitFactor(metrics: StrategyMetrics): number {
    if (metrics.expenses === 0n) {
      return metrics.revenue > 0n ? 100 : 0;
    }

    return Number(metrics.revenue) / Number(metrics.expenses);
  }

  private calculateVolatility(metrics: StrategyMetrics): number {
    if (metrics.executionCount < 2) {
      return 0;
    }

    const successRate = metrics.successRate / 100;
    const variance = successRate * (1 - successRate);
    return Math.sqrt(variance);
  }

  private calculateMomentumScore(metrics: StrategyMetrics): number {
    if (metrics.executionCount < 2) {
      return 0;
    }

    const roiTrend = metrics.roi > 0 ? 50 : -50;
    const successTrend = metrics.successRate > 50 ? 30 : -30;

    return Math.max(-100, Math.min(100, roiTrend + successTrend));
  }

  private generateRecommendations(
    comparison: StrategyComparison,
    strategies: BaseStrategy[]
  ): string[] {
    const recommendations: string[] = [];

    recommendations.push(
      `Focus on ${comparison.topPerformer} strategy (highest ROI: ${comparison.strategies[0]?.metrics.roi.toFixed(2)}%)`
    );

    if (comparison.strategies.length > 1) {
      const worst = comparison.strategies[comparison.strategies.length - 1];
      if (worst.metrics.roi < 0) {
        recommendations.push(`Review or disable ${worst.name} (negative ROI: ${worst.metrics.roi.toFixed(2)}%)`);
      }
    }

    if (comparison.strategies.length > 1) {
      recommendations.push(`Maintain diversification across ${comparison.strategies.length} strategies`);
    }

    return recommendations;
  }

  private storePerformanceHistory(strategyName: string, metrics: PerformanceMetrics): void {
    if (!this.performanceHistory.has(strategyName)) {
      this.performanceHistory.set(strategyName, []);
    }

    const history = this.performanceHistory.get(strategyName)!;
    history.push(metrics);

    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }
}
