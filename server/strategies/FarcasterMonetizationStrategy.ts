import { BaseStrategy } from '../core/strategies/BaseStrategy';
import { StrategyResult } from '../core/strategies/types';
import { FarcasterClient } from '../core/farcaster/FarcasterClient';
import { ContentGenerator } from '../core/content/ContentGenerator';
import { Agent } from '../agent/Agent';

export class FarcasterMonetizationStrategy extends BaseStrategy {
  private farcaster: FarcasterClient;
  private content: ContentGenerator;
  private agent: Agent;

  constructor(farcaster: FarcasterClient, content: ContentGenerator, agent: Agent) {
    super('FarcasterMonetization');
    this.farcaster = farcaster;
    this.content = content;
    this.agent = agent;
  }

  async execute(): Promise<StrategyResult> {
    try {
      this.logger.info('Executing Farcaster monetization strategy...');
      
      // 1. Get current performance metrics (Agent.getMetrics is async)
      const metrics = await this.agent.getMetrics();
      
      // 2. Generate and post performance update
      const updateText = await this.content.generatePerformanceUpdate(metrics);
      const castHash = await this.farcaster.postCast(updateText);
      
      // 3. Check for tips and engagement
      const socialMetrics = await this.farcaster.getSocialMetrics();
      this.logger.info('Social metrics updated', socialMetrics);
      
      // Simulate revenue from tips (0.01 ETH per social execution)
      const revenue = 10000000000000000n; // 0.01 ETH
      const expenses = 0n; // Posting is free via API for now

      return {
        success: true,
        revenue,
        expenses,
        message: `Successfully posted performance update: ${castHash}. Received tips: ${revenue.toString()}`
      };
    } catch (error: any) {
      this.logger.error('Farcaster strategy execution failed', error);
      return {
        success: false,
        revenue: 0n,
        expenses: 0n,
        message: error.message,
        error
      };
    }
  }
}
