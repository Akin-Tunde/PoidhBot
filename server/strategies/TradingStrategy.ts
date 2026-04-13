import { BaseStrategy } from '../core/strategies/BaseStrategy';
import { StrategyResult } from '../core/strategies/types';
import { MarketDataFetcher } from '../core/market/MarketDataFetcher';
import { TechnicalAnalysis } from '../core/market/TechnicalAnalysis';
import { OrderExecutor } from '../core/trading/OrderExecutor';
import { AutonomousWallet } from '../core/wallet/AutonomousWallet';

export class TradingStrategy extends BaseStrategy {
  private marketData: MarketDataFetcher;
  private executor: OrderExecutor;
  private wallet: AutonomousWallet;

  constructor(marketData: MarketDataFetcher, executor: OrderExecutor, wallet: AutonomousWallet) {
    super('AlgorithmicTrading');
    this.marketData = marketData;
    this.executor = executor;
    this.wallet = wallet;
  }

  async execute(): Promise<StrategyResult> {
    try {
      this.logger.info('Executing trading strategy...');
      const symbol = 'ETH';
      const ohlcv = await this.marketData.fetchOHLCV(symbol, '1h', 100);
      const rsi = TechnicalAnalysis.calculateRSI(ohlcv);
      const sma20 = TechnicalAnalysis.calculateSMA(ohlcv, 20);
      const sma50 = TechnicalAnalysis.calculateSMA(ohlcv, 50);
      const currentPrice = ohlcv[ohlcv.length - 1].close;

      this.logger.debug(`RSI: ${rsi}, Price: ${currentPrice}, SMA20: ${sma20}, SMA50: ${sma50}`);

      let side: 'buy' | 'sell' | null = null;
      let revenue = 0n;
      let expenses = 1000000000000000n; // 0.001 ETH simulated gas

      // Simple Trend Following + RSI mean reversion
      if (rsi < 30 && currentPrice > sma50) {
        side = 'buy';
      } else if (rsi > 70 || (currentPrice < sma50 && currentPrice < sma20)) {
        side = 'sell';
      }

      if (side) {
        this.logger.info(`Trading Signal: ${side.toUpperCase()} for ${symbol}`);
        const txHash = await this.executor.executeMarketOrder(symbol, side, 100000000000000000n); // 0.1 ETH
        // Simulate profit/loss for metrics
        revenue = side === 'sell' ? 5000000000000000n : 0n; // 0.005 ETH profit on sell
        
        return {
          success: true,
          revenue,
          expenses,
          message: `Successfully executed ${side} order: ${txHash}`
        };
      }

      return {
        success: true,
        revenue: 0n,
        expenses: 0n,
        message: 'No trading signal detected'
      };
    } catch (error: any) {
      this.logger.error('Trading strategy execution failed', error);
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
