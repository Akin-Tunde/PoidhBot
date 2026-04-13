import { Logger } from '../logger/Logger';
import { BaseStrategy } from '../strategies/BaseStrategy';
import { PerformanceAnalyzer, PerformanceMetrics } from './PerformanceAnalyzer';

/**
 * Strategy dashboard data
 */
export interface StrategyDashboard {
  name: string;
  status: 'active' | 'inactive' | 'error';
  allocation: number; // percentage
  revenue: bigint;
  expenses: bigint;
  profit: bigint;
  roi: number;
  lastExecution: Date;
  nextExecution: Date;
  health: 'healthy' | 'warning' | 'critical';
  successRate: number;
  executionCount: number;
}

/**
 * Alert
 */
export interface Alert {
  id: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  strategyName?: string;
}

/**
 * Recommendation
 */
export interface Recommendation {
  id: string;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  action?: string;
}

/**
 * Timeline entry
 */
export interface TimelineEntry {
  timestamp: Date;
  totalValue: bigint;
  totalProfit: bigint;
  totalROI: number;
  strategyCount: number;
  activeStrategies: number;
}

/**
 * Dashboard data
 */
export interface DashboardData {
  // Portfolio overview
  totalValue: bigint;
  totalProfit: bigint;
  totalROI: number;
  portfolioHealth: 'excellent' | 'good' | 'fair' | 'poor';
  
  // Strategy breakdown
  strategies: StrategyDashboard[];
  
  // Performance timeline
  timeline: TimelineEntry[];
  
  // Alerts
  alerts: Alert[];
  
  // Recommendations
  recommendations: Recommendation[];
  
  // Metadata
  lastUpdated: Date;
  updateFrequency: number; // milliseconds
}

/**
 * Dashboard provides real-time visualization of agent performance
 *
 * Key Features:
 * - Aggregate real-time metrics
 * - Track portfolio value over time
 * - Monitor strategy health
 * - Generate alerts for anomalies
 * - Provide recommendations
 */
export class Dashboard {
  private logger: Logger;
  private analyzer: PerformanceAnalyzer;
  private strategies: Map<string, BaseStrategy> = new Map();
  private timeline: TimelineEntry[] = [];
  private alerts: Alert[] = [];
  private recommendations: Recommendation[] = [];
  private maxTimelineSize: number = 1000;
  private maxAlertsSize: number = 100;
  private lastUpdated: Date = new Date();
  private updateFrequency: number = 60000; // 1 minute

  constructor(context: string = 'Dashboard') {
    this.logger = new Logger(context);
    this.analyzer = new PerformanceAnalyzer(`${context}:Analyzer`);
  }

  /**
   * Register strategies for dashboard monitoring
   */
  registerStrategies(strategies: Map<string, BaseStrategy>): void {
    this.strategies = new Map(strategies);
    this.logger.info(`Registered ${strategies.size} strategies for monitoring`);
  }

  /**
   * Update dashboard with current state
   */
  update(walletBalance?: bigint): void {
    try {
      const dashboardData = this.getDashboardData(walletBalance);
      
      // Store timeline entry
      this.storeTimelineEntry(dashboardData);
      
      // Check for alerts
      this.checkForAlerts();
      
      // Generate recommendations
      this.generateRecommendations();
      
      this.lastUpdated = new Date();
      
      this.logger.debug('Dashboard updated', {
        strategiesCount: this.strategies.size,
        totalProfit: dashboardData.totalProfit.toString(),
        portfolioHealth: dashboardData.portfolioHealth,
      });
    } catch (error) {
      this.logger.error('Failed to update dashboard', error);
    }
  }

  /**
   * Get current dashboard state
   */
  getDashboardData(walletBalance?: bigint): DashboardData {
    let totalRevenue = 0n;
    let totalExpenses = 0n;
    let totalValue = walletBalance || 0n;
    let activeStrategies = 0;

    const strategiesList: StrategyDashboard[] = [];

    for (const [name, strategy] of this.strategies) {
      const metrics = strategy.getMetrics();
      const analysis = this.analyzer.analyzeStrategy(strategy);

      totalRevenue += metrics.revenue;
      totalExpenses += metrics.expenses;
      totalValue += metrics.revenue; // Add revenue to portfolio value

      if (metrics.enabled) {
        activeStrategies++;
      }

      const health = this.calculateStrategyHealth(analysis);

      strategiesList.push({
        name,
        status: metrics.enabled ? 'active' : 'inactive',
        allocation: 0, // Would be set by allocator
        revenue: metrics.revenue,
        expenses: metrics.expenses,
        profit: metrics.profit,
        roi: metrics.roi,
        lastExecution: metrics.lastExecuted,
        nextExecution: metrics.nextExecution,
        health,
        successRate: metrics.successRate,
        executionCount: metrics.executionCount,
      });
    }

    const totalProfit = totalRevenue - totalExpenses;
    const totalROI = totalRevenue > 0n ? Number((totalProfit * 100n) / totalRevenue) : 0;
    const portfolioHealth = this.calculatePortfolioHealth(totalROI, activeStrategies);

    return {
      totalValue,
      totalProfit,
      totalROI,
      portfolioHealth,
      strategies: strategiesList,
      timeline: this.getTimeline(),
      alerts: this.getAlerts(),
      recommendations: this.getRecommendations(),
      lastUpdated: this.lastUpdated,
      updateFrequency: this.updateFrequency,
    };
  }

  /**
   * Get portfolio timeline
   */
  getTimeline(period?: 'hour' | 'day' | 'week' | 'month'): TimelineEntry[] {
    if (!period) {
      return [...this.timeline];
    }

    // Filter by period
    const now = new Date();
    const periodMs = {
      hour: 3600000,
      day: 86400000,
      week: 604800000,
      month: 2592000000,
    }[period];

    return this.timeline.filter(entry =>
      now.getTime() - entry.timestamp.getTime() <= periodMs
    );
  }

  /**
   * Get strategy details
   */
  getStrategyDetails(strategyName: string): StrategyDashboard | null {
    const strategy = this.strategies.get(strategyName);
    if (!strategy) {
      return null;
    }

    const metrics = strategy.getMetrics();
    const analysis = this.analyzer.analyzeStrategy(strategy);
    const health = this.calculateStrategyHealth(analysis);

    return {
      name: strategyName,
      status: metrics.enabled ? 'active' : 'inactive',
      allocation: 0,
      revenue: metrics.revenue,
      expenses: metrics.expenses,
      profit: metrics.profit,
      roi: metrics.roi,
      lastExecution: metrics.lastExecuted,
      nextExecution: metrics.nextExecution,
      health,
      successRate: metrics.successRate,
      executionCount: metrics.executionCount,
    };
  }

  /**
   * Get alerts
   */
  getAlerts(severity?: 'info' | 'warning' | 'critical'): Alert[] {
    if (!severity) {
      return [...this.alerts];
    }
    return this.alerts.filter(a => a.severity === severity);
  }

  /**
   * Get recommendations
   */
  getRecommendations(priority?: 'low' | 'medium' | 'high'): Recommendation[] {
    if (!priority) {
      return [...this.recommendations];
    }
    return this.recommendations.filter(r => r.priority === priority);
  }

  /**
   * Export dashboard as JSON
   */
  export(): DashboardData {
    return this.getDashboardData();
  }

  /**
   * Clear historical data
   */
  clearHistory(): void {
    this.timeline = [];
    this.alerts = [];
    this.recommendations = [];
    this.logger.info('Dashboard history cleared');
  }

  // ============ Private Methods ============

  /**
   * Calculate strategy health
   */
  private calculateStrategyHealth(
    analysis: PerformanceMetrics
  ): 'healthy' | 'warning' | 'critical' {
    // Healthy: ROI > 5% and win rate > 60%
    if (analysis.roi > 5 && analysis.winRate > 60) {
      return 'healthy';
    }

    // Warning: ROI between 0-5% or win rate between 40-60%
    if (analysis.roi > 0 && analysis.winRate > 40) {
      return 'warning';
    }

    // Critical: Negative ROI or low win rate
    return 'critical';
  }

  /**
   * Calculate portfolio health
   */
  private calculatePortfolioHealth(
    totalROI: number,
    activeStrategies: number
  ): 'excellent' | 'good' | 'fair' | 'poor' {
    if (totalROI > 20 && activeStrategies > 2) {
      return 'excellent';
    }

    if (totalROI > 10 && activeStrategies > 1) {
      return 'good';
    }

    if (totalROI > 0) {
      return 'fair';
    }

    return 'poor';
  }

  /**
   * Check for alerts
   */
  private checkForAlerts(): void {
    const dashboardData = this.getDashboardData();

    // Alert 1: Portfolio health degradation
    if (dashboardData.portfolioHealth === 'poor') {
      this.addAlert({
        severity: 'critical',
        title: 'Portfolio Health Critical',
        message: 'Overall portfolio ROI is negative. Review strategy allocations.',
      });
    }

    // Alert 2: Strategy failures
    for (const strategy of dashboardData.strategies) {
      if (strategy.health === 'critical') {
        this.addAlert({
          severity: 'warning',
          title: `Strategy ${strategy.name} Underperforming`,
          message: `${strategy.name} has negative ROI. Consider disabling or rebalancing.`,
          strategyName: strategy.name,
        });
      }
    }

    // Alert 3: Low active strategies
    if (dashboardData.strategies.filter(s => s.status === 'active').length === 0) {
      this.addAlert({
        severity: 'critical',
        title: 'No Active Strategies',
        message: 'All strategies are disabled. Enable at least one strategy.',
      });
    }
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(): void {
    const dashboardData = this.getDashboardData();

    // Clear old recommendations
    this.recommendations = [];

    // Recommendation 1: Increase allocation to top performer
    const topStrategy = dashboardData.strategies.reduce((prev, current) =>
      prev.roi > current.roi ? prev : current
    );

    if (topStrategy && topStrategy.roi > 10) {
      this.addRecommendation({
        priority: 'high',
        title: `Increase ${topStrategy.name} Allocation`,
        description: `${topStrategy.name} is performing well (${topStrategy.roi.toFixed(2)}% ROI). Consider increasing allocation.`,
        action: `increase_allocation:${topStrategy.name}`,
      });
    }

    // Recommendation 2: Rebalance portfolio
    if (dashboardData.strategies.length > 1) {
      const variance = this.calculateAllocationVariance(dashboardData.strategies);
      if (variance > 0.3) {
        this.addRecommendation({
          priority: 'medium',
          title: 'Rebalance Portfolio',
          description: 'Portfolio allocations are unbalanced. Consider rebalancing for better diversification.',
          action: 'rebalance_portfolio',
        });
      }
    }

    // Recommendation 3: Enable more strategies
    const activeCount = dashboardData.strategies.filter(s => s.status === 'active').length;
    if (activeCount < dashboardData.strategies.length && activeCount < 3) {
      this.addRecommendation({
        priority: 'low',
        title: 'Enable Additional Strategies',
        description: `Currently using ${activeCount} of ${dashboardData.strategies.length} strategies. Enable more for diversification.`,
        action: 'enable_strategies',
      });
    }
  }

  /**
   * Store timeline entry
   */
  private storeTimelineEntry(dashboardData: DashboardData): void {
    const entry: TimelineEntry = {
      timestamp: new Date(),
      totalValue: dashboardData.totalValue,
      totalProfit: dashboardData.totalProfit,
      totalROI: dashboardData.totalROI,
      strategyCount: dashboardData.strategies.length,
      activeStrategies: dashboardData.strategies.filter(s => s.status === 'active').length,
    };

    this.timeline.push(entry);

    if (this.timeline.length > this.maxTimelineSize) {
      this.timeline.shift();
    }
  }

  /**
   * Add alert
   */
  private addAlert(alert: Omit<Alert, 'id' | 'timestamp'>): void {
    const newAlert: Alert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    this.alerts.push(newAlert);

    if (this.alerts.length > this.maxAlertsSize) {
      this.alerts.shift();
    }

    this.logger.warn(`Alert: ${newAlert.title}`, { severity: newAlert.severity });
  }

  /**
   * Add recommendation
   */
  private addRecommendation(rec: Omit<Recommendation, 'id' | 'timestamp'>): void {
    const newRec: Recommendation = {
      ...rec,
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    this.recommendations.push(newRec);

    this.logger.info(`Recommendation: ${newRec.title}`, { priority: newRec.priority });
  }

  /**
   * Calculate allocation variance
   */
  private calculateAllocationVariance(strategies: StrategyDashboard[]): number {
    if (strategies.length === 0) {
      return 0;
    }

    const avgAllocation = 100 / strategies.length;
    const variance = strategies.reduce((sum, s) => {
      const diff = s.allocation - avgAllocation;
      return sum + diff * diff;
    }, 0) / strategies.length;

    return Math.sqrt(variance) / avgAllocation;
  }
}
