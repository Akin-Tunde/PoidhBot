import { Logger, LogLevel } from '../core/logger/Logger';
import { AutonomousWallet } from '../core/wallet/AutonomousWallet';
import { BaseStrategy } from '../core/strategies/BaseStrategy';
import { StrategyOrchestrator } from '../core/orchestration/StrategyOrchestrator';
import { AllocationOptimizer, AllocationConfig } from '../core/orchestration/AllocationOptimizer';
import { PerformanceAnalyzer } from '../core/analytics/PerformanceAnalyzer';
import { Dashboard, DashboardData } from '../core/analytics/Dashboard';
import { EmergencyRevenueGenerator, EmergencyStrategy } from '../core/emergency/EmergencyRevenueGenerator';
import { RiskManager, RiskParameters } from '../core/risk/RiskManager';
import { SelfHealingMechanism } from '../core/healing/SelfHealingMechanism';
import { AdaptiveStrategySelector, MarketConditions } from '../core/ml/AdaptiveStrategySelector';
import { CrossChainOptimizer, ChainConfig } from '../core/crosschain/CrossChainOptimizer';
import { PolymarketBettingStrategy } from '../strategies/PolymarketBettingStrategy';
import type { AgentConfig } from '../config';

/**
 * Enhanced Agent Metrics V3 with Phase 6 data
 */
export interface AgentMetricsV3 {
  timestamp: Date;
  executionId: string;

  // Wallet & Emergency
  walletBalance: bigint;
  isHealthy: boolean;
  isEmergency: boolean;
  emergencyStatus: {
    isActive: boolean;
    strategiesCount: number;
  };

  // Risk Management
  portfolioRisk: 'low' | 'medium' | 'high';
  riskScore: number;
  maxDrawdown: number;
  volatility: number;

  // Orchestration & Performance
  totalRevenue: bigint;
  totalExpenses: bigint;
  totalProfit: bigint;
  totalROI: number;
  strategiesCount: number;
  enabledCount: number;
  successCount: number;
  failureCount: number;

  // Healing
  healthyStrategies: number;
  strategiesNeedingHealing: number;

  // Adaptive Selection
  recommendedStrategies: string[];
  modelAccuracy: number;

  // Cross-Chain
  crossChainBalance: bigint;
  chainsEnabled: number;
  opportunitiesFound: number;

  // Dashboard
  portfolioHealth: 'excellent' | 'good' | 'fair' | 'poor';
  dashboardData: DashboardData;
}

/**
 * AgentV3 - Advanced Autonomous AI Agent with Phase 6 Features
 *
 * Phase 6 Features:
 * - Emergency Revenue Generation for critical wallet conditions
 * - Advanced Risk Management with portfolio-level controls
 * - Self-Healing Mechanisms for operational resilience
 * - Adaptive Strategy Selection using ML
 * - Cross-Chain Optimization for multi-chain capital allocation
 */
export class AgentV3 {
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

  // Phase 6 Components
  private emergencyGenerator: EmergencyRevenueGenerator;
  private riskManager: RiskManager;
  private healingMechanism: SelfHealingMechanism;
  private adaptiveSelector: AdaptiveStrategySelector;
  private crossChainOptimizer: CrossChainOptimizer;

  // Configuration
  private allocationConfig: AllocationConfig = {
    strategy: 'performance-weighted',
    minAllocation: 10,
    maxAllocation: 60,
    rebalanceThreshold: 10,
    riskTolerance: 'medium',
  };

  private riskParameters: RiskParameters = {
    maxDrawdown: 20,
    maxVolatility: 30,
    maxConcentration: 50,
    minDiversification: 30,
    varThreshold: 15,
    cvarThreshold: 20,
    riskTolerance: 'medium',
  };

  constructor(config: AgentConfig, logLevel: LogLevel = LogLevel.INFO) {
    this.config = config;
    this.logger = new Logger('AgentV3', logLevel);

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

      // Register Polymarket Betting Strategy
      this.registerStrategy(new PolymarketBettingStrategy(this.wallet));

      // Initialize Phase 6 components
      this.emergencyGenerator = new EmergencyRevenueGenerator(
        BigInt('1000000000000000000'), // 1 ETH emergency threshold
        BigInt('100000000000000000'), // 0.1 ETH critical threshold
        logLevel
      );

      this.riskManager = new RiskManager(this.riskParameters, logLevel);

      this.healingMechanism = new SelfHealingMechanism(
        [config.rpcUrl], // Primary RPC
        logLevel
      );

      this.adaptiveSelector = new AdaptiveStrategySelector(logLevel);

      this.crossChainOptimizer = new CrossChainOptimizer(logLevel);

      this.logger.info('AgentV3 initialized', {
        chain: config.targetChain,
        wallet: this.wallet.getAddress(),
        components: [
          'Orchestrator',
          'Allocator',
          'Analyzer',
          'Dashboard',
          'EmergencyGenerator',
          'RiskManager',
          'HealingMechanism',
          'AdaptiveSelector',
          'CrossChainOptimizer',
        ],
      });
    } catch (error) {
      this.logger.error('Failed to initialize AgentV3', error);
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
   * Register an emergency strategy
   */
  registerEmergencyStrategy(strategy: EmergencyStrategy): void {
    this.emergencyGenerator.registerEmergencyStrategy(strategy);
    this.logger.info(`Emergency strategy registered: ${strategy.name}`);
  }

  /**
   * Register a blockchain for cross-chain operations
   */
  registerChain(config: ChainConfig): void {
    this.crossChainOptimizer.registerChain(config);
    this.logger.info(`Chain registered: ${config.name}`);
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
    this.logger.info('AgentV3 starting...');

    // Start wallet monitoring
    this.wallet.monitorBalance(30000);

    // Register strategies with dashboard
    this.dashboard.registerStrategies(this.strategies);

    // Start main loop
    await this.mainLoop();
  }

  /**
   * Enhanced main loop with Phase 6 features
   */
  private async mainLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        const startTime = Date.now();

        // 1. Check wallet health and emergency conditions
        const walletBalance = await this.wallet.getBalance();

        if (walletBalance.isEmergency) {
          this.logger.warn('EMERGENCY: Wallet below critical threshold', {
            balance: walletBalance.formattedBalance,
          });

          // Trigger emergency revenue generation
          const emergencyResult = await this.emergencyGenerator.executeEmergency(
            walletBalance.balance,
            walletBalance.balance / 2n // Use half of remaining balance
          );

          this.logger.info('Emergency revenue generation executed', {
            triggered: emergencyResult.triggered,
            success: emergencyResult.success,
            strategiesActivated: emergencyResult.strategiesActivated.length,
            estimatedRevenue: emergencyResult.estimatedRevenue.toString(),
          });
        }

        // 2. Assess portfolio risk
        const strategyMetrics = Array.from(this.strategies.values()).map(s => s.getMetrics());
        const riskAssessment = this.riskManager.assessPortfolioRisk(strategyMetrics);

        this.logger.info('Portfolio risk assessed', {
          riskLevel: riskAssessment.portfolioRisk,
          riskScore: riskAssessment.riskScore.toFixed(2),
          violations: riskAssessment.violations.length,
        });

        // 3. Get adaptive strategy recommendations
        const marketConditions: MarketConditions = {
          timestamp: new Date(),
          volatility: riskAssessment.volatility,
          trend: this.determineTrend(strategyMetrics),
          momentum: this.calculateMomentum(strategyMetrics),
          liquidityScore: 75, // Placeholder
        };

        this.adaptiveSelector.recordMarketConditions(marketConditions);

        const recommendations = this.adaptiveSelector.getRecommendations(
          Array.from(this.strategies.keys()),
          marketConditions
        );

        this.logger.info('Strategy recommendations generated', {
          count: recommendations.length,
          topStrategy: recommendations[0]?.strategyName,
          topScore: recommendations[0]?.score.toFixed(2),
        });

        // 4. Adjust allocation based on risk
        const adjustedLimits = this.riskManager.getAdjustedAllocationLimits(
          this.allocationConfig.minAllocation,
          this.allocationConfig.maxAllocation
        );

        const adjustedConfig = {
          ...this.allocationConfig,
          minAllocation: adjustedLimits.minAllocation,
          maxAllocation: adjustedLimits.maxAllocation,
        };

        // 5. Optimize capital allocation
        const allocationResult = await this.allocator.calculateAllocation(
          Array.from(this.strategies.values()),
          walletBalance.balance,
          adjustedConfig
        );

        this.logger.info('Capital allocation optimized', {
          strategyCount: allocationResult.allocations.size,
          confidence: allocationResult.confidence,
        });

        // 6. Execute strategies in parallel
        const orchestrationResult = await this.orchestrator.executeAll();

        // Record strategy performance for adaptive selector
        for (const strategy of this.strategies.values()) {
          const metrics = strategy.getMetrics();
          this.adaptiveSelector.recordStrategyPerformance(strategy.getName(), metrics);
        }

        this.logger.info('Orchestration cycle complete', {
          executionId: orchestrationResult.executionId,
          duration: orchestrationResult.totalDuration,
          successCount: orchestrationResult.aggregatedResult.successCount,
          failureCount: orchestrationResult.aggregatedResult.failureCount,
        });

        // 7. Handle failures with self-healing
        if (orchestrationResult.aggregatedResult.failureCount > 0) {
          for (const strategy of this.strategies.values()) {
            const metrics = strategy.getMetrics();
            if (metrics.lastError) {
              this.healingMechanism.reportFailure(
                strategy.getName(),
                metrics.lastError,
                metrics
              );
            }
          }
        }

        // 8. Identify cross-chain opportunities
        const xchainOpportunities = this.crossChainOptimizer.identifyOpportunities(
          new Map()
        );

        this.logger.info('Cross-chain opportunities identified', {
          count: xchainOpportunities.length,
          topReturn: xchainOpportunities[0]?.expectedReturn.toFixed(2),
        });

        // 9. Update dashboard with all metrics
        this.dashboard.update(walletBalance.balance);

        // 10. Check for rebalancing
        const shouldRebalance = this.allocator.shouldRebalance(
          allocationResult.allocations,
          strategyMetrics,
          this.allocationConfig.rebalanceThreshold
        );

        if (shouldRebalance) {
          this.logger.info('Rebalancing triggered');
        }

        const cycleDuration = Date.now() - startTime;
        this.logger.debug(`Main loop cycle completed in ${cycleDuration}ms`);

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
   * Determine market trend
   */
  private determineTrend(
    metrics: any[]
  ): 'bullish' | 'bearish' | 'neutral' {
    if (metrics.length === 0) return 'neutral';

    const avgROI = metrics.reduce((sum, m) => sum + m.roi, 0) / metrics.length;

    if (avgROI > 5) return 'bullish';
    if (avgROI < -5) return 'bearish';
    return 'neutral';
  }

  /**
   * Calculate market momentum
   */
  private calculateMomentum(metrics: any[]): number {
    if (metrics.length === 0) return 0;

    const avgROI = metrics.reduce((sum, m) => sum + m.roi, 0) / metrics.length;
    return Math.max(-100, Math.min(100, avgROI * 10));
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

    this.logger.info('AgentV3 stopped');
  }

  /**
   * Get enhanced metrics V3
   */
  async getMetrics(): Promise<AgentMetricsV3> {
    const balance = await this.wallet.getBalance();
    const orchestratorStatus = this.orchestrator.getStatus();
    const dashboardData = this.dashboard.getDashboardData(balance.balance);
    const riskAssessment = this.riskManager.getCurrentRiskAssessment();
    const emergencyStatus = this.emergencyGenerator.getEmergencyStatus();
    const healingStatuses = this.healingMechanism.getAllHealingStatuses(
      Array.from(this.strategies.keys())
    );
    const modelPerformance = this.adaptiveSelector.getCurrentModelPerformance();
    const xchainStats = this.crossChainOptimizer.getStatistics();

    const strategyMetrics = Array.from(this.strategies.values()).map(s => s.getMetrics());
    const totalRevenue = strategyMetrics.reduce((sum, m) => sum + m.revenue, 0n);
    const totalExpenses = strategyMetrics.reduce((sum, m) => sum + m.expenses, 0n);
    const totalProfit = totalRevenue - totalExpenses;
    const totalROI = totalRevenue > 0n ? Number((totalProfit * 100n) / totalRevenue) : 0;

    const healthyCount = healingStatuses.filter(h => h.isHealthy).length;
    const recommendedStrategies = this.adaptiveSelector
      .getRecommendations(Array.from(this.strategies.keys()), {
        timestamp: new Date(),
        volatility: riskAssessment?.volatility || 0,
        trend: 'neutral',
        momentum: 0,
        liquidityScore: 75,
      })
      .slice(0, 3)
      .map(r => r.strategyName);

    return {
      timestamp: new Date(),
      executionId: `metrics_${Date.now()}`,
      walletBalance: balance.balance,
      isHealthy: balance.isHealthy,
      isEmergency: balance.isEmergency,
      emergencyStatus: {
        isActive: emergencyStatus.isActive,
        strategiesCount: emergencyStatus.strategiesCount,
      },
      portfolioRisk: riskAssessment?.portfolioRisk || 'medium',
      riskScore: riskAssessment?.riskScore || 0,
      maxDrawdown: riskAssessment?.maxDrawdown || 0,
      volatility: riskAssessment?.volatility || 0,
      totalRevenue,
      totalExpenses,
      totalProfit,
      totalROI,
      strategiesCount: this.strategies.size,
      enabledCount: orchestratorStatus.enabledCount,
      successCount: orchestratorStatus.totalSuccesses,
      failureCount: orchestratorStatus.totalFailures,
      healthyStrategies: healthyCount,
      strategiesNeedingHealing: healingStatuses.length - healthyCount,
      recommendedStrategies,
      modelAccuracy: modelPerformance?.accuracy || 0,
      crossChainBalance: xchainStats.totalBalance,
      chainsEnabled: xchainStats.chainsEnabled,
      opportunitiesFound: xchainStats.opportunitiesFound,
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
   * Update allocation configuration
   */
  setAllocationConfig(config: Partial<AllocationConfig>): void {
    this.allocationConfig = { ...this.allocationConfig, ...config };
    this.logger.info('Allocation configuration updated', this.allocationConfig);
  }

  /**
   * Update risk parameters
   */
  setRiskParameters(params: Partial<RiskParameters>): void {
    this.riskParameters = { ...this.riskParameters, ...params };
    this.riskManager.updateRiskParameters(params);
    this.logger.info('Risk parameters updated', this.riskParameters);
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
   * Get Phase 6 components
   */
  getPhase6Components() {
    return {
      emergencyGenerator: this.emergencyGenerator,
      riskManager: this.riskManager,
      healingMechanism: this.healingMechanism,
      adaptiveSelector: this.adaptiveSelector,
      crossChainOptimizer: this.crossChainOptimizer,
    };
  }
}
