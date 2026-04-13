import { Logger } from '../logger/Logger';
import { OHLCV, MarketMetrics } from './types';

export class MarketDataFetcher {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('MarketDataFetcher');
  }

  async fetchOHLCV(symbol: string, timeframe: string = '1h', limit: number = 100): Promise<OHLCV[]> {
    this.logger.debug(`Fetching OHLCV for ${symbol} on ${timeframe} timeframe`);
    // In a real implementation, this would call a DEX aggregator or CEX API
    // For now, we simulate data for the agent's autonomous operation
    return this.generateSimulatedOHLCV(limit);
  }

  async getLatestPrice(symbol: string): Promise<number> {
    const data = await this.fetchOHLCV(symbol, '1m', 1);
    return data[0].close;
  }

  private generateSimulatedOHLCV(limit: number): OHLCV[] {
    const data: OHLCV[] = [];
    let lastClose = 3500; // Starting ETH price
    const now = Date.now();

    for (let i = 0; i < limit; i++) {
      const change = (Math.random() - 0.5) * 50;
      const open = lastClose;
      const close = open + change;
      const high = Math.max(open, close) + Math.random() * 10;
      const low = Math.min(open, close) - Math.random() * 10;
      
      data.push({
        timestamp: now - (limit - i) * 3600000,
        open,
        high,
        low,
        close,
        volume: Math.random() * 1000
      });
      lastClose = close;
    }
    return data;
  }
}
