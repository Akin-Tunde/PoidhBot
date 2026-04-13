import { OHLCV } from './types';

export class TechnicalAnalysis {
  static calculateRSI(data: OHLCV[], period: number = 14): number {
    const closes = data.map(d => d.close);
    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      gains.push(Math.max(0, diff));
      losses.push(Math.max(0, -diff));
    }

    const avgGain = gains.slice(0, period).reduce((a, b) => a + b) / period;
    const avgLoss = losses.slice(0, period).reduce((a, b) => a + b) / period;

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
  }

  static calculateSMA(data: OHLCV[], period: number): number {
    const closes = data.slice(-period).map(d => d.close);
    const sum = closes.reduce((a, b) => a + b, 0);
    return sum / period;
  }

  static calculateMACD(data: OHLCV[]): { value: number; signal: number; histogram: number } {
    // Simplified MACD for Phase 3
    const ema12 = this.calculateSMA(data, 12);
    const ema26 = this.calculateSMA(data, 26);
    const macdValue = ema12 - ema26;
    const signal = this.calculateSMA(data, 9);
    const histogram = macdValue - signal;

    return {
      value: macdValue,
      signal,
      histogram
    };
  }
}
