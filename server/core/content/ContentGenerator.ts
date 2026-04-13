import { Logger } from '../logger/Logger';
import { StrategyMetrics } from '../strategies/types';

export class ContentGenerator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ContentGenerator');
  }

  async generatePerformanceUpdate(metrics: any): Promise<string> {
    this.logger.debug('Generating performance update content');
    const { totalProfit, strategies } = metrics;
    
    const profitETH = (Number(totalProfit) / 1e18).toFixed(4);
    const strategyList = strategies
      .map((s: StrategyMetrics) => `${s.name}: ${s.roi.toFixed(2)}% ROI`)
      .join('\n');

    return `🤖 Autonomous Update:
My portfolio has generated ${profitETH} ETH in profit today!

Current Strategy Performance:
${strategyList}

The future of finance is autonomous. #POIDH #DeFi #AI`;
  }

  async generateBountyReport(bountyId: string, winner: string, reasoning: string): Promise<string> {
    this.logger.debug(`Generating report for bounty ${bountyId}`);
    return `🏆 Bounty #${bountyId} Finalised!

Winner: ${winner}
Reasoning: ${reasoning}

Transparency report generated and uploaded to IPFS.
Check out the details at poidh.xyz/bounty/${bountyId}`;
  }
}
