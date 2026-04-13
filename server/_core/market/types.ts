export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketMetrics {
  price: number;
  change24h: number;
  volume24h: number;
  rsi: number;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  sma20: number;
  sma50: number;
}

export interface PolymarketMarket {
  id: string;
  question: string;
  slug: string;
  state: 'OPEN' | 'CLOSED' | 'RESOLVED';
  outcomeType: 'BINARY' | 'CATEGORICAL' | 'SCALAR';
  outcomes: {
    id: string;
    title: string;
    price: number;
    probability: number;
  }[];
  endTime: number;
  // Add other relevant fields as needed
}

export interface PolymarketOrder {
  marketId: string;
  outcomeId: string;
  side: 'buy' | 'sell';
  price: number;
  size: number; // In USDC
  orderType: 'limit' | 'market';
  // Add other relevant fields as needed
}

export interface PolymarketOutcome {
  marketId: string;
  outcomeId: string;
  price: number;
  probability: number;
}
