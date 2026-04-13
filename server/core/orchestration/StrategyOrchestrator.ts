import { Logger } from '../logger/Logger';
import { BaseStrategy } from '../strategies/BaseStrategy';
import { StrategyResult } from '../strategies/types';

/**
 * Represents a single strategy execution within an orchestration cycle
 */
export interface StrategyExecution {
  strategyName: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  result: StrategyResult;
  status: 'success' | 'failed' | 'skipped';
  error?: Error;
}

/**
 * Aggregated result from orchestrating multiple strategies
 */
export interface OrchestrationResult {
  executionId: string;
  timestamp: Date;
  totalDuration: number;
  executions: StrategyExecution[];
  aggregatedResult: {
    totalRevenue: bigint;
    totalExpenses: bigint;
    totalProfit: bigint;
    successCount: number;
    failureCount: number;
    skippedCount: number;
  };
}

/**
 * Current status of the orchestrator
 */
export interface OrchestratorStatus {
  isRunning: boolean;
  strategiesCount: number;
  enabledCount: number;
  disabledCount: number;
  lastExecutionTime?: Date;
  lastExecutionDuration?: number;
  totalExecutions: number;
  totalSuccesses: number;
  totalFailures: number;
}

/**
 * StrategyOrchestrator manages multiple strategies with parallel execution
 */
export class StrategyOrchestrator {
  private strategies: Map<string, BaseStrategy> = new Map();
  private logger: Logger;
  private executionHistory: StrategyExecution[] = [];
  private maxHistorySize: number = 1000;
  private isRunning: boolean = false;
  private totalExecutions: number = 0;
  private totalSuccesses: number = 0;
  private totalFailures: number = 0;

  constructor(context: string = 'StrategyOrchestrator') {
    this.logger = new Logger(context);
  }

  /**
   * Register a strategy for orchestration
   */
  registerStrategy(strategy: BaseStrategy): void {
    if (!strategy) {
      this.logger.warn('Attempted to register null/undefined strategy');
      return;
    }

    const name = strategy.getName();
    if (this.strategies.has(name)) {
      this.logger.warn(`Strategy '${name}' already registered, overwriting`);
    }

    this.strategies.set(name, strategy);
    this.logger.info(`Registered strategy: ${name}`);
  }

  /**
   * Unregister a strategy
   */
  unregisterStrategy(name: string): void {
    if (this.strategies.delete(name)) {
      this.logger.info(`Unregistered strategy: ${name}`);
    }
  }

  /**
   * Execute all registered strategies in parallel
   */
  async executeAll(): Promise<OrchestrationResult> {
    const executionId = this.generateExecutionId();
    const startTime = new Date();
    this.isRunning = true;

    this.logger.info(`Starting orchestration cycle ${executionId}`, {
      strategiesCount: this.strategies.size,
    });

    try {
      const executionPromises = Array.from(this.strategies.entries())
        .filter(([_, strategy]) => strategy.isEnabled())
        .map(([name, strategy]) => this.executeStrategy(name, strategy));

      const executions = await Promise.all(executionPromises);

      const skippedStrategies = Array.from(this.strategies.entries())
        .filter(([_, strategy]) => !strategy.isEnabled())
        .map(([name, _]) => this.createSkippedExecution(name));

      const allExecutions = [...executions, ...skippedStrategies];

      const aggregatedResult = this.aggregateResults(allExecutions);

      const endTime = new Date();
      const totalDuration = endTime.getTime() - startTime.getTime();

      const result: OrchestrationResult = {
        executionId,
        timestamp: startTime,
        totalDuration,
        executions: allExecutions,
        aggregatedResult,
      };

      this.totalExecutions++;
      this.totalSuccesses += aggregatedResult.successCount;
      this.totalFailures += aggregatedResult.failureCount;

      this.storeExecutionHistory(allExecutions);

      this.logger.info(`Orchestration cycle ${executionId} complete`, {
        totalDuration,
        successCount: aggregatedResult.successCount,
        failureCount: aggregatedResult.failureCount,
        totalProfit: aggregatedResult.totalProfit.toString(),
      });

      return result;
    } catch (error) {
      this.logger.error(`Orchestration cycle ${executionId} failed`, error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Execute specific strategies by name
   */
  async executeStrategies(names: string[]): Promise<OrchestrationResult> {
    const executionId = this.generateExecutionId();
    const startTime = new Date();
    this.isRunning = true;

    this.logger.info(`Starting selective orchestration ${executionId}`, {
      strategyNames: names,
    });

    try {
      const executionPromises = names
        .map(name => this.strategies.get(name))
        .filter((strategy): strategy is BaseStrategy => strategy !== undefined)
        .map((strategy) => this.executeStrategy(strategy.getName(), strategy));

      const executions = await Promise.all(executionPromises);

      const aggregatedResult = this.aggregateResults(executions);

      const endTime = new Date();
      const totalDuration = endTime.getTime() - startTime.getTime();

      const result: OrchestrationResult = {
        executionId,
        timestamp: startTime,
        totalDuration,
        executions,
        aggregatedResult,
      };

      this.totalExecutions++;
      this.totalSuccesses += aggregatedResult.successCount;
      this.totalFailures += aggregatedResult.failureCount;

      this.storeExecutionHistory(executions);

      this.logger.info(`Selective orchestration ${executionId} complete`, {
        totalDuration,
        successCount: aggregatedResult.successCount,
        failureCount: aggregatedResult.failureCount,
      });

      return result;
    } catch (error) {
      this.logger.error(`Selective orchestration ${executionId} failed`, error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Enable a strategy
   */
  enableStrategy(name: string): void {
    const strategy = this.strategies.get(name);
    if (strategy) {
      strategy.enable();
      this.logger.info(`Enabled strategy: ${name}`);
    } else {
      this.logger.warn(`Strategy '${name}' not found`);
    }
  }

  /**
   * Disable a strategy
   */
  disableStrategy(name: string): void {
    const strategy = this.strategies.get(name);
    if (strategy) {
      strategy.disable();
      this.logger.info(`Disabled strategy: ${name}`);
    } else {
      this.logger.warn(`Strategy '${name}' not found`);
    }
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit?: number): StrategyExecution[] {
    if (limit === undefined) {
      return [...this.executionHistory];
    }
    return this.executionHistory.slice(-limit);
  }

  /**
   * Get current status
   */
  getStatus(): OrchestratorStatus {
    const enabledCount = Array.from(this.strategies.values()).filter(s =>
      s.isEnabled()
    ).length;

    return {
      isRunning: this.isRunning,
      strategiesCount: this.strategies.size,
      enabledCount,
      disabledCount: this.strategies.size - enabledCount,
      lastExecutionTime: this.executionHistory[this.executionHistory.length - 1]
        ?.startTime,
      lastExecutionDuration: this.executionHistory[this.executionHistory.length - 1]
        ?.duration,
      totalExecutions: this.totalExecutions,
      totalSuccesses: this.totalSuccesses,
      totalFailures: this.totalFailures,
    };
  }

  /**
   * Get all registered strategies
   */
  getStrategies(): Map<string, BaseStrategy> {
    return new Map(this.strategies);
  }

  /**
   * Get a specific strategy
   */
  getStrategy(name: string): BaseStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
    this.logger.info('Execution history cleared');
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.totalExecutions = 0;
    this.totalSuccesses = 0;
    this.totalFailures = 0;
    this.logger.info('Statistics reset');
  }

  // ============ Private Methods ============

  private async executeStrategy(
    name: string,
    strategy: BaseStrategy
  ): Promise<StrategyExecution> {
    const startTime = new Date();

    try {
      this.logger.debug(`Executing strategy: ${name}`);

      const result = await strategy.execute();

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const execution: StrategyExecution = {
        strategyName: name,
        startTime,
        endTime,
        duration,
        result,
        status: result.success ? 'success' : 'failed',
      };

      strategy.updateMetrics(result);

      this.logger.debug(`Strategy ${name} execution complete`, {
        duration,
        success: result.success,
        revenue: result.revenue.toString(),
      });

      return execution;
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.logger.error(`Strategy ${name} execution failed`, error);

      const execution: StrategyExecution = {
        strategyName: name,
        startTime,
        endTime,
        duration,
        result: {
          success: false,
          revenue: 0n,
          expenses: 0n,
          message: `Strategy execution failed: ${error instanceof Error ? error.message : String(error)}`,
          error: error instanceof Error ? error : new Error(String(error)),
        },
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      };

      return execution;
    }
  }

  private createSkippedExecution(name: string): StrategyExecution {
    const now = new Date();
    return {
      strategyName: name,
      startTime: now,
      endTime: now,
      duration: 0,
      result: {
        success: false,
        revenue: 0n,
        expenses: 0n,
        message: 'Strategy is disabled',
      },
      status: 'skipped',
    };
  }

  private aggregateResults(executions: StrategyExecution[]): OrchestrationResult['aggregatedResult'] {
    let totalRevenue = 0n;
    let totalExpenses = 0n;
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    for (const execution of executions) {
      if (execution.status === 'skipped') {
        skippedCount++;
      } else if (execution.status === 'success') {
        successCount++;
        totalRevenue += execution.result.revenue;
        totalExpenses += execution.result.expenses;
      } else {
        failureCount++;
        totalExpenses += execution.result.expenses;
      }
    }

    const totalProfit = totalRevenue - totalExpenses;

    return {
      totalRevenue,
      totalExpenses,
      totalProfit,
      successCount,
      failureCount,
      skippedCount,
    };
  }

  private storeExecutionHistory(executions: StrategyExecution[]): void {
    this.executionHistory.push(...executions);

    if (this.executionHistory.length > this.maxHistorySize) {
      const removeCount = this.executionHistory.length - this.maxHistorySize;
      this.executionHistory.splice(0, removeCount);
    }
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
