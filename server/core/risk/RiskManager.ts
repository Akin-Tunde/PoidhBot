import { Logger, LogLevel } from '../logger/Logger';
import type { StrategyMetrics } from '../strategies/types';

/**
 * Risk parameters and constraints
 */
export interface RiskParameters {
  maxDrawdown: number; // Maximum acceptable drawdown (%)
  maxVolatility: number; // Maximum acceptable volatility (%)
  maxConcentration: number; // Maximum allocation to single strategy (%)
  minDiversification: number; // Minimum number of active strategies
  varThreshold: number; // Value at Risk threshold (%)
  cvarThreshold: number; // Conditional Value at Risk threshold (%)
  riskTolerance: 'low' | 'medium' | 'high';
}

/**
 * Risk assessment result
 */
export interface RiskAssessment {
  timestamp: Date;
  portfolioRisk: 'low' | 'medium' | 'high';
  valueAtRisk: number; // VaR (%)
  conditionalValueAtRisk: number; // CVaR (%)
  maxDrawdown: number; // Maximum drawdown (%)
  volatility: number; // Portfolio volatility (%)
  concentration: number; // Concentration risk (%)
  diversification: number; // Diversification score (0-100)
  riskScore: number; // Overall risk score (0-100)
  recommendations: string[];
  violations: string[];
}

/**
 * Risk alert
 */
export interface RiskAlert {
  timestamp: Date;
  severity: 'info' | 'warning' | 'critical';
  type: string;
  message: string;
  affectedStrategies?: string[];
  recommendedAction?: string;
}

/**
 * Risk Manager
 *
 * Implements portfolio-level risk controls and dynamic risk adjustments.
 * Monitors risk metrics and enforces constraints to maintain portfolio health.
 */
export class RiskManager {
  private logger: Logger;
  private riskParameters: RiskParameters;
  private riskHistory: RiskAssessment[] = [];
  private alerts: RiskAlert[] = [];
  private maxHistorySize: number = 500;
  private maxAlertsSize: number = 100;

  constructor(
    riskParameters: RiskParameters,
    logLevel: LogLevel = LogLevel.INFO
  ) {
    this.logger = new Logger('RiskManager', logLevel);
    this.riskParameters = riskParameters;

    this.logger.info('RiskManager initialized', {
      riskTolerance: riskParameters.riskTolerance,
      maxDrawdown: riskParameters.maxDrawdown,
      maxVolatility: riskParameters.maxVolatility,
    });
  }

  /**
   * Assess portfolio risk based on strategy metrics
   */
  assessPortfolioRisk(strategyMetrics: StrategyMetrics[]): RiskAssessment {
    const assessment: RiskAssessment = {
      timestamp: new Date(),
      portfolioRisk: 'medium',
      valueAtRisk: 0,
      conditionalValueAtRisk: 0,
      maxDrawdown: 0,
      volatility: 0,
      concentration: 0,
      diversification: 0,
      riskScore: 0,
      recommendations: [],
      violations: [],
    };

    if (strategyMetrics.length === 0) {
      assessment.portfolioRisk = 'low';
      assessment.recommendations.push('No active strategies. Consider activating strategies.');
      return assessment;
    }

    try {
      // Calculate metrics
      assessment.maxDrawdown = this.calculateMaxDrawdown(strategyMetrics);
      assessment.volatility = this.calculateVolatility(strategyMetrics);
      assessment.concentration = this.calculateConcentration(strategyMetrics);
      assessment.diversification = this.calculateDiversification(strategyMetrics);
      assessment.valueAtRisk = this.calculateVaR(strategyMetrics);
      assessment.conditionalValueAtRisk = this.calculateCVaR(strategyMetrics);

      // Calculate overall risk score
      assessment.riskScore = this.calculateRiskScore(assessment);

      // Determine portfolio risk level
      assessment.portfolioRisk = this.determineRiskLevel(assessment.riskScore);

      // Check for violations
      assessment.violations = this.checkViolations(assessment);

      // Generate recommendations
      assessment.recommendations = this.generateRecommendations(assessment);

      // Create alerts for violations
      this.createAlerts(assessment);

      // Store in history
      this.riskHistory.push(assessment);
      if (this.riskHistory.length > this.maxHistorySize) {
        this.riskHistory = this.riskHistory.slice(-this.maxHistorySize);
      }

      this.logger.info('Portfolio risk assessed', {
        riskLevel: assessment.portfolioRisk,
        riskScore: assessment.riskScore.toFixed(2),
        maxDrawdown: assessment.maxDrawdown.toFixed(2),
        volatility: assessment.volatility.toFixed(2),
        violations: assessment.violations.length,
      });
    } catch (error) {
      this.logger.error('Error assessing portfolio risk', error);
    }

    return assessment;
  }

  /**
   * Calculate maximum drawdown
   */
  private calculateMaxDrawdown(strategyMetrics: StrategyMetrics[]): number {
    if (strategyMetrics.length === 0) return 0;

    const drawdowns = strategyMetrics
      .map(m => {
        // Estimate drawdown from volatility and ROI
        const roi = m.roi || 0;
        const volatility = m.volatility || 0;
        return Math.abs(roi - volatility * 2); // Simplified calculation
      });

    return Math.max(...drawdowns, 0);
  }

  /**
   * Calculate portfolio volatility
   */
  private calculateVolatility(strategyMetrics: StrategyMetrics[]): number {
    if (strategyMetrics.length === 0) return 0;

    const volatilities = strategyMetrics.map(m => m.volatility || 0);
    const avgVolatility = volatilities.reduce((a, b) => a + b, 0) / volatilities.length;

    // Add correlation adjustment
    const correlationFactor = 1 - (0.1 * Math.min(strategyMetrics.length - 1, 5));
    return avgVolatility * correlationFactor;
  }

  /**
   * Calculate concentration risk
   */
  private calculateConcentration(strategyMetrics: StrategyMetrics[]): number {
    if (strategyMetrics.length === 0) return 0;

    // Calculate Herfindahl index for concentration
    const totalRevenue = strategyMetrics.reduce((sum, m) => sum + m.revenue, 0n);
    if (totalRevenue === 0n) return 0;

    let herfindahl = 0;
    for (const metric of strategyMetrics) {
      const share = Number(metric.revenue) / Number(totalRevenue);
      herfindahl += share * share;
    }

    // Convert to concentration percentage (0-100)
    return (herfindahl * 100) / strategyMetrics.length;
  }

  /**
   * Calculate diversification score
   */
  private calculateDiversification(strategyMetrics: StrategyMetrics[]): number {
    if (strategyMetrics.length === 0) return 0;

    // Diversification score based on number of active strategies and their balance
    const strategyCount = strategyMetrics.length;
    const concentration = this.calculateConcentration(strategyMetrics);

    // Score: higher count and lower concentration = higher diversification
    const countScore = Math.min(strategyCount / 5, 1) * 50; // Max 50 points for 5+ strategies
    const balanceScore = (100 - concentration) * 0.5; // Max 50 points for balanced allocation

    return Math.min(countScore + balanceScore, 100);
  }

  /**
   * Calculate Value at Risk (VaR)
   */
  private calculateVaR(strategyMetrics: StrategyMetrics[]): number {
    if (strategyMetrics.length === 0) return 0;

    // Simplified VaR calculation using volatility
    const avgVolatility = strategyMetrics.reduce((sum, m) => sum + (m.volatility || 0), 0) /
      strategyMetrics.length;

    // VaR at 95% confidence level (approximately 1.65 * volatility)
    return avgVolatility * 1.65;
  }

  /**
   * Calculate Conditional Value at Risk (CVaR)
   */
  private calculateCVaR(strategyMetrics: StrategyMetrics[]): number {
    if (strategyMetrics.length === 0) return 0;

    // Simplified CVaR calculation (approximately 1.25 * VaR)
    return this.calculateVaR(strategyMetrics) * 1.25;
  }

  /**
   * Calculate overall risk score (0-100)
   */
  private calculateRiskScore(assessment: RiskAssessment): number {
    let score = 0;

    // Drawdown component (0-25 points)
    score += Math.min(assessment.maxDrawdown / 4, 25);

    // Volatility component (0-25 points)
    score += Math.min(assessment.volatility / 4, 25);

    // Concentration component (0-25 points)
    score += Math.min(assessment.concentration / 4, 25);

    // Diversification component (0-25 points, inverted)
    score += (100 - assessment.diversification) / 4;

    return Math.min(score, 100);
  }

  /**
   * Determine risk level based on score
   */
  private determineRiskLevel(
    riskScore: number
  ): 'low' | 'medium' | 'high' {
    if (riskScore < 33) return 'low';
    if (riskScore < 67) return 'medium';
    return 'high';
  }

  /**
   * Check for risk violations
   */
  private checkViolations(assessment: RiskAssessment): string[] {
    const violations: string[] = [];

    if (assessment.maxDrawdown > this.riskParameters.maxDrawdown) {
      violations.push(
        `Max drawdown (${assessment.maxDrawdown.toFixed(2)}%) exceeds limit (${this.riskParameters.maxDrawdown}%)`
      );
    }

    if (assessment.volatility > this.riskParameters.maxVolatility) {
      violations.push(
        `Volatility (${assessment.volatility.toFixed(2)}%) exceeds limit (${this.riskParameters.maxVolatility}%)`
      );
    }

    if (assessment.concentration > this.riskParameters.maxConcentration) {
      violations.push(
        `Concentration (${assessment.concentration.toFixed(2)}%) exceeds limit (${this.riskParameters.maxConcentration}%)`
      );
    }

    if (assessment.diversification < this.riskParameters.minDiversification) {
      violations.push(
        `Diversification score (${assessment.diversification.toFixed(2)}) below minimum (${this.riskParameters.minDiversification})`
      );
    }

    if (assessment.valueAtRisk > this.riskParameters.varThreshold) {
      violations.push(
        `Value at Risk (${assessment.valueAtRisk.toFixed(2)}%) exceeds threshold (${this.riskParameters.varThreshold}%)`
      );
    }

    return violations;
  }

  /**
   * Generate recommendations based on risk assessment
   */
  private generateRecommendations(assessment: RiskAssessment): string[] {
    const recommendations: string[] = [];

    if (assessment.portfolioRisk === 'high') {
      recommendations.push('Portfolio risk is high. Consider reducing strategy allocation or enabling more conservative strategies.');
    }

    if (assessment.maxDrawdown > this.riskParameters.maxDrawdown * 0.8) {
      recommendations.push('Drawdown is approaching limit. Consider implementing stop-loss orders.');
    }

    if (assessment.volatility > this.riskParameters.maxVolatility * 0.8) {
      recommendations.push('Volatility is elevated. Consider diversifying into less volatile strategies.');
    }

    if (assessment.concentration > this.riskParameters.maxConcentration * 0.8) {
      recommendations.push('Portfolio is becoming concentrated. Rebalance to reduce concentration risk.');
    }

    if (assessment.diversification < this.riskParameters.minDiversification * 1.5) {
      recommendations.push('Portfolio lacks diversification. Enable additional strategies.');
    }

    return recommendations;
  }

  /**
   * Create alerts for violations
   */
  private createAlerts(assessment: RiskAssessment): void {
    for (const violation of assessment.violations) {
      const alert: RiskAlert = {
        timestamp: new Date(),
        severity: assessment.portfolioRisk === 'high' ? 'critical' : 'warning',
        type: 'risk_violation',
        message: violation,
        recommendedAction: assessment.recommendations[0],
      };

      this.alerts.push(alert);
      if (this.alerts.length > this.maxAlertsSize) {
        this.alerts = this.alerts.slice(-this.maxAlertsSize);
      }

      this.logger.warn(`Risk alert: ${violation}`, {
        severity: alert.severity,
      });
    }
  }

  /**
   * Get current risk assessment
   */
  getCurrentRiskAssessment(): RiskAssessment | null {
    return this.riskHistory.length > 0 ? this.riskHistory[this.riskHistory.length - 1] : null;
  }

  /**
   * Get risk history
   */
  getRiskHistory(limit?: number): RiskAssessment[] {
    if (limit) {
      return this.riskHistory.slice(-limit);
    }
    return [...this.riskHistory];
  }

  /**
   * Get recent alerts
   */
  getAlerts(severity?: 'info' | 'warning' | 'critical', limit?: number): RiskAlert[] {
    let filtered = this.alerts;

    if (severity) {
      filtered = filtered.filter(a => a.severity === severity);
    }

    if (limit) {
      return filtered.slice(-limit);
    }

    return [...filtered];
  }

  /**
   * Update risk parameters
   */
  updateRiskParameters(parameters: Partial<RiskParameters>): void {
    this.riskParameters = { ...this.riskParameters, ...parameters };
    this.logger.info('Risk parameters updated', this.riskParameters);
  }

  /**
   * Get risk parameters
   */
  getRiskParameters(): RiskParameters {
    return { ...this.riskParameters };
  }

  /**
   * Adjust allocation based on risk
   */
  getAdjustedAllocationLimits(
    baseMinAllocation: number,
    baseMaxAllocation: number
  ): { minAllocation: number; maxAllocation: number } {
    const currentAssessment = this.getCurrentRiskAssessment();

    if (!currentAssessment) {
      return {
        minAllocation: baseMinAllocation,
        maxAllocation: baseMaxAllocation,
      };
    }

    // Adjust based on portfolio risk
    let minAllocation = baseMinAllocation;
    let maxAllocation = baseMaxAllocation;

    if (currentAssessment.portfolioRisk === 'high') {
      // Reduce max allocation in high-risk scenarios
      maxAllocation = Math.max(baseMaxAllocation * 0.5, baseMinAllocation);
    } else if (currentAssessment.portfolioRisk === 'low') {
      // Increase max allocation in low-risk scenarios
      maxAllocation = Math.min(baseMaxAllocation * 1.2, 100);
    }

    return { minAllocation, maxAllocation };
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.riskHistory = [];
    this.alerts = [];
    this.logger.info('Risk history and alerts cleared');
  }
}
