export interface ProtocolMetrics {
  apy: number;
  tvl: bigint;
  risk: 'low' | 'medium' | 'high';
  utilization: number;
  name?: string;
  lastUpdated?: Date;
}

export interface DeFiPosition {
  protocol: string;
  asset: string;
  amount: bigint;
  apy: number;
  earned: bigint;
}

export interface DeFiTransactionResult {
  hash: string;
  protocol: string;
  action: 'deposit' | 'withdraw' | 'claim';
  amount: bigint;
  status: 'pending' | 'confirmed' | 'failed';
  error?: Error;
}

export interface DepositResult {
  hash?: string;
  txHash?: string;
  amount: bigint;
  shares?: bigint;
  status?: 'pending' | 'confirmed' | 'failed';
  success?: boolean;
  message?: string;
}

export interface WithdrawResult {
  hash?: string;
  txHash?: string;
  amount: bigint;
  status?: 'pending' | 'confirmed' | 'failed';
  success?: boolean;
  message?: string;
}

export interface ProtocolBalance {
  protocol: string;
  balance: bigint;
  earned?: bigint;
  apy: number;
  shares?: bigint;
  value?: bigint;
}
