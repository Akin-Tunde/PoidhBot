import { Logger, LogLevel } from '../logger/Logger';
import type { StrategyMetrics, StrategyResult } from './types';

export abstract class BaseStrategy {
  protected name: string;
  protected logger: Logger;
  protected metrics: StrategyMetrics;

  constructor(name: string, logLevel: LogLevel = LogLevel.INFO) {
    this.name = name;
    this.logger = new Logger(`Strategy:${name}`, logLevel);
    this.metrics = {
      name,
      enabled: true,
      revenue: 0n,
      expenses: 0n,
      profit: 0n,
      roi: 0,
      successRate: 0,
      lastExecuted: new Date(),
      nextExecution: new Date(),
      executionCount: 0,
      successCount: 0,
    };

    this.logger.info('Strategy initialized');
  }

  abstract execute(): Promise<StrategyResult>;

  getMetrics(): StrategyMetrics {
    return { ...this.metrics };
  }

  updateMetrics(result: StrategyResult): void {
    this.metrics.executionCount++;

    if (result.success) {
      this.metrics.successCount++;
      this.metrics.revenue += result.revenue;
      this.metrics.expenses += result.expenses;
      this.metrics.profit = this.metrics.revenue - this.metrics.expenses;

      if (this.metrics.revenue > 0n) {
        this.metrics.roi = Number((this.metrics.profit * 100n) / this.metrics.revenue);
      }
    }

    this.metrics.successRate = (this.metrics.successCount / this.metrics.executionCount) * 100;
    this.metrics.lastExecuted = new Date();

    this.logger.info('Metrics updated', {
      revenue: this.metrics.revenue.toString(),
      expenses: this.metrics.expenses.toString(),
      profit: this.metrics.profit.toString(),
      roi: this.metrics.roi.toFixed(2) + '%',
      successRate: this.metrics.successRate.toFixed(2) + '%',
    });
  }

  getName(): string {
    return this.name;
  }

  enable(): void {
    this.metrics.enabled = true;
    this.logger.info('Strategy enabled');
  }

  disable(): void {
    this.metrics.enabled = false;
    this.logger.info('Strategy disabled');
  }

  isEnabled(): boolean {
    return this.metrics.enabled;
  }

  reset(): void {
    this.metrics = {
      name: this.name,
      enabled: true,
      revenue: 0n,
      expenses: 0n,
      profit: 0n,
      roi: 0,
      successRate: 0,
      lastExecuted: new Date(),
      nextExecution: new Date(),
      executionCount: 0,
      successCount: 0,
    };
    this.logger.info('Metrics reset');
  }
}
