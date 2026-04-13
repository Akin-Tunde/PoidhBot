import { Logger, LogLevel } from '../core/logger/Logger';
import { AutonomousWallet } from '../core/wallet/AutonomousWallet';
import { BaseStrategy } from '../core/strategies/BaseStrategy';
import { StrategyOrchestrator, OrchestrationResult } from '../core/orchestration/StrategyOrchestrator';
import { AllocationOptimizer, AllocationConfig } from '../core/orchestration/AllocationOptimizer';
import { PerformanceAnalyzer } from '../core/analytics/PerformanceAnalyzer';
import { Dashboard, DashboardData } from '../core/analytics/Dashboard';
import type { AgentConfig } from '../config';

/**
 * Enhanced Agent Metrics with orchestration data
 */
export interface AgentMetricsV2 {
  timestamp: Date;
  executionId: string;
  
  // Wallet
  walletBalance: bigint;
  isHealthy: boolean;
  isEmergency: boolean;
  
  // Aggregated results
  totalRevenue: bigint;
  totalExpenses: bigint;
  totalProfit: bigint;
  totalROI: number;
  
  // Orchestration
  strategiesCount: number;
  enabledCount: number;
  successCount: number;
  failureCount: number;
  executionDuration: number; // milliseconds
  
  // Dashboard
  portfolioHealth: 'excellent' | 'good' | 'fair' | 'poor';
  dashboardData: DashboardData;
}

/**
 * AgentV2 - Enhanced Agent with Multi-Strategy Orchestration
 *
 * Phase 5 Features:
 * - Parallel strategy execution via StrategyOrchestrator
 * - Intelligent capital allocation via AllocationOptimizer
 * - Comprehensive performance analytics via PerformanceAnalyzer
 * - Real-time dashboard monitoring via Dashboard
 */
export class AgentV2 {
  private wallet: AutonomousWallet;
  private logger: Logger;
  private strategies: Map<string, BaseStrategy> = new Map();
  private config: AgentConfig;
  private isRunning: boolean = false;
  private executionInterval: number = 60000; // 1 minute
  private mainLoopTimeout?: NodeJS.Timeout;

  // Phase 5 Components
  private orchestrator: StrategyOrchestrator;
  private allocator: AllocationOptimizer;
  private analyzer: PerformanceAnalyzer;
  private dashboard: Dashboard;

  // Configuration
  private allocationConfig: AllocationConfig = {
    strategy: 'performance-weighted',
    minAllocation: 10,
    maxAllocation: 60,
    rebalanceThreshold: 10,
    riskTolerance: 'medium',
  };

  constructor(config: AgentConfig, logLevel: LogLevel = LogLevel.INFO) {
    this.config = config;
    this.logger = new Logger('AgentV2', logLevel);

    try {
      // Initialize wallet
      this.wallet = new AutonomousWallet(
        {
          privateKey: config.privateKey,
          rpcUrl: config.rpcUrl,
          minBalance: '0.1',
          emergencyThreshold: '0.01',
        },
        logLevel
      );

      // Initialize Phase 5 components
      this.orchestrator = new StrategyOrchestrator('Agent:Orchestrator');
      this.allocator = new AllocationOptimizer('Agent:Allocator');
      this.analyzer = new PerformanceAnalyzer('Agent:Analyzer');
      this.dashboard = new Dashboard('Agent:Dashboard');

      this.logger.info('AgentV2 initialized', {
        chain: config.targetChain,
        wallet: this.wallet.getAddress(),
        components: ['Orchestrator', 'Allocator', 'Analyzer', 'Dashboard'],
      });
    } catch (error) {
      this.logger.error('Failed to initialize AgentV2', error);
      throw error;
    }
  }

  /**
   * Register a strategy
   */
  registerStrategy(strategy: BaseStrategy): void {
    if (this.strategies.has(strategy.getName())) {
      this.logger.warn(`Strategy ${strategy.getName()} already registered`);
      return;
    }

    this.strategies.set(strategy.getName(), strategy);
    this.orchestrator.registerStrategy(strategy);
    this.logger.info(`Strategy registered: ${strategy.getName()}`);
  }

  /**
   * Unregister a strategy
   */
  unregisterStrategy(name: string): void {
    this.strategies.delete(name);
    this.orchestrator.unregisterStrategy(name);
    this.logger.info(`Strategy unregistered: ${name}`);
  }

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Agent is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('AgentV2 starting...');

    // Start wallet monitoring in background
    this.wallet.monitorBalance(30000); // Check every 30 seconds

    // Register strategies with dashboard
    this.dashboard.registerStrategies(this.strategies);

    // Start main loop
    await this.mainLoop();
  }

  /**
   * Enhanced main loop with orchestration
   */
  private async mainLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        // 1. Check wallet health
        const walletBalance = await this.wallet.getBalance();
        
        if (walletBalance.isEmergency) {
          this.logger.warn('EMERGENCY: Wallet below emergency threshold', {
            balance: walletBalance.formattedBalance,
          });
          // TODO: Trigger emergency revenue generation (Phase 6)
        }

        // 2. Optimize capital allocation
        const allocationResult = await this.allocator.calculateAllocation(
          Array.from(this.strategies.values()),
          walletBalance.balance,
          this.allocationConfig
        );

        this.logger.info('Capital allocation optimized', {
          strategyCount: allocationResult.allocations.size,
          confidence: allocationResult.confidence,
          rationale: allocationResult.rationale,
        });

        // 3. Execute all strategies in parallel via orchestrator
        const orchestrationResult = await this.orchestrator.executeAll();

        this.logger.info('Orchestration cycle complete', {
          executionId: orchestrationResult.executionId,
          duration: orchestrationResult.totalDuration,
          successCount: orchestrationResult.aggregatedResult.successCount,
          failureCount: orchestrationResult.aggregatedResult.failureCount,
          totalProfit: orchestrationResult.aggregatedResult.totalProfit.toString(),
        });

        // 4. Update analytics and dashboard
        this.dashboard.update(walletBalance.balance);

        // 5. Check for rebalancing needs
        const shouldRebalance = this.allocator.shouldRebalance(
          allocationResult.allocations,
          Array.from(this.strategies.values()).map(s => s.getMetrics()),
          this.allocationConfig.rebalanceThreshold
        );

        if (shouldRebalance) {
          this.logger.info('Rebalancing triggered', {
            threshold: this.allocationConfig.rebalanceThreshold,
          });
          // TODO: Execute rebalancing (Phase 5 continuation)
        }

        // Wait before next execution
        await new Promise(resolve => {
          this.mainLoopTimeout = setTimeout(resolve, this.executionInterval);
        });
      } catch (error) {
        this.logger.error('Main loop error', error);
        await new Promise(resolve => {
          this.mainLoopTimeout = setTimeout(resolve, this.executionInterval);
        });
      }
    }
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Agent is not running');
      return;
    }

    this.isRunning = false;
    this.wallet.stopMonitoring();

    if (this.mainLoopTimeout) {
      clearTimeout(this.mainLoopTimeout);
    }

    this.logger.info('AgentV2 stopped');
  }

  /**
   * Get enhanced metrics
   */
  async getMetrics(): Promise<AgentMetricsV2> {
    const balance = await this.wallet.getBalance();
    const orchestratorStatus = this.orchestrator.getStatus();
    const dashboardData = this.dashboard.getDashboardData(balance.balance);

    const strategyMetrics = Array.from(this.strategies.values()).map(s => s.getMetrics());
    const totalRevenue = strategyMetrics.reduce((sum, m) => sum + m.revenue, 0n);
    const totalExpenses = strategyMetrics.reduce((sum, m) => sum + m.expenses, 0n);
    const totalProfit = totalRevenue - totalExpenses;
    const totalROI = totalRevenue > 0n ? Number((totalProfit * 100n) / totalRevenue) : 0;

    return {
      timestamp: new Date(),
      executionId: `metrics_${Date.now()}`,
      walletBalance: balance.balance,
      isHealthy: balance.isHealthy,
      isEmergency: balance.isEmergency,
      totalRevenue,
      totalExpenses,
      totalProfit,
      totalROI,
      strategiesCount: this.strategies.size,
      enabledCount: orchestratorStatus.enabledCount,
      successCount: orchestratorStatus.totalSuccesses,
      failureCount: orchestratorStatus.totalFailures,
      executionDuration: orchestratorStatus.lastExecutionDuration || 0,
      portfolioHealth: dashboardData.portfolioHealth,
      dashboardData,
    };
  }

  /**
   * Get dashboard data
   */
  getDashboard(): DashboardData {
    return this.dashboard.export();
  }

  /**
   * Get orchestrator status
   */
  getOrchestratorStatus() {
    return this.orchestrator.getStatus();
  }

  /**
   * Get allocation history
   */
  getAllocationHistory(limit?: number) {
    return this.allocator.getAllocationHistory(limit);
  }

  /**
   * Get performance rankings
   */
  getPerformanceRankings() {
    return this.analyzer.getRankings(Array.from(this.strategies.values()));
  }

  /**
   * Update allocation configuration
   */
  setAllocationConfig(config: Partial<AllocationConfig>): void {
    this.allocationConfig = { ...this.allocationConfig, ...config };
    this.logger.info('Allocation configuration updated', this.allocationConfig);
  }

  /**
   * Get wallet
   */
  getWallet(): AutonomousWallet {
    return this.wallet;
  }

  /**
   * Get strategies
   */
  getStrategies(): Map<string, BaseStrategy> {
    return this.strategies;
  }

  /**
   * Check if agent is running
   */
  isRunning_(): boolean {
    return this.isRunning;
  }

  /**
   * Set execution interval
   */
  setExecutionInterval(intervalMs: number): void {
    this.executionInterval = intervalMs;
    this.logger.info(`Execution interval set to ${intervalMs}ms`);
  }

  /**
   * Get execution interval
   */
  getExecutionInterval(): number {
    return this.executionInterval;
  }

  /**
   * Enable a strategy
   */
  enableStrategy(name: string): void {
    this.orchestrator.enableStrategy(name);
    this.logger.info(`Strategy enabled: ${name}`);
  }

  /**
   * Disable a strategy
   */
  disableStrategy(name: string): void {
    this.orchestrator.disableStrategy(name);
    this.logger.info(`Strategy disabled: ${name}`);
  }
}
