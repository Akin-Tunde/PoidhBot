import { Logger, LogLevel } from '../core/logger/Logger';
import { AutonomousWallet } from '../core/wallet/AutonomousWallet';
import { BaseStrategy } from '../core/strategies/BaseStrategy';
import type { AgentConfig } from '../config';

export interface AgentMetrics {
  timestamp: Date;
  strategies: any[];
  totalRevenue: bigint;
  totalExpenses: bigint;
  totalProfit: bigint;
  walletBalance: bigint;
  isHealthy: boolean;
  isEmergency: boolean;
}

export class Agent {
  private wallet: AutonomousWallet;
  private logger: Logger;
  private strategies: Map<string, BaseStrategy> = new Map();
  private config: AgentConfig;
  private isRunning: boolean = false;
  private executionInterval: number = 60000; // 1 minute
  private mainLoopTimeout?: NodeJS.Timeout;

  constructor(config: AgentConfig, logLevel: LogLevel = LogLevel.INFO) {
    this.config = config;
    this.logger = new Logger('Agent', logLevel);

    try {
      this.wallet = new AutonomousWallet(
        {
          privateKey: config.privateKey,
          rpcUrl: config.rpcUrl,
          minBalance: '0.1',
          emergencyThreshold: '0.01',
        },
        logLevel
      );

      this.logger.info('Agent initialized', {
        chain: config.targetChain,
        wallet: this.wallet.getAddress(),
      });
    } catch (error) {
      this.logger.error('Failed to initialize agent', error);
      throw error;
    }
  }

  registerStrategy(strategy: BaseStrategy): void {
    if (this.strategies.has(strategy.getName())) {
      this.logger.warn(`Strategy ${strategy.getName()} already registered`);
      return;
    }

    this.strategies.set(strategy.getName(), strategy);
    this.logger.info(`Strategy registered: ${strategy.getName()}`);
  }

  unregisterStrategy(name: string): void {
    this.strategies.delete(name);
    this.logger.info(`Strategy unregistered: ${name}`);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Agent is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Agent starting...');

    // Start wallet monitoring in background
    this.wallet.monitorBalance(30000); // Check every 30 seconds

    // Start main loop
    await this.mainLoop();
  }

  private async mainLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        this.logger.info('Executing strategies...');

        for (const [name, strategy] of this.strategies) {
          if (!strategy.isEnabled()) {
            this.logger.debug(`Skipping disabled strategy: ${name}`);
            continue;
          }

          try {
            const result = await strategy.execute();
            strategy.updateMetrics(result);

            this.logger.info(`Strategy ${name} completed`, {
              success: result.success,
              revenue: result.revenue.toString(),
              expenses: result.expenses.toString(),
            });
          } catch (error) {
            this.logger.error(`Strategy ${name} failed`, error);
          }
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

    this.logger.info('Agent stopped');
  }

  async getMetrics(): Promise<AgentMetrics> {
    const balance = await this.wallet.getBalance();
    const strategyMetrics = Array.from(this.strategies.values()).map(s => s.getMetrics());

    const totalRevenue = strategyMetrics.reduce((sum, m) => sum + m.revenue, 0n);
    const totalExpenses = strategyMetrics.reduce((sum, m) => sum + m.expenses, 0n);
    const totalProfit = totalRevenue - totalExpenses;

    return {
      timestamp: new Date(),
      strategies: strategyMetrics,
      totalRevenue,
      totalExpenses,
      totalProfit,
      walletBalance: balance.balance,
      isHealthy: balance.isHealthy,
      isEmergency: balance.isEmergency,
    };
  }

  getWallet(): AutonomousWallet {
    return this.wallet;
  }

  getStrategies(): Map<string, BaseStrategy> {
    return this.strategies;
  }

  isRunning_(): boolean {
    return this.isRunning;
  }

  setExecutionInterval(intervalMs: number): void {
    this.executionInterval = intervalMs;
    this.logger.info(`Execution interval set to ${intervalMs}ms`);
  }

  getExecutionInterval(): number {
    return this.executionInterval;
  }
}
