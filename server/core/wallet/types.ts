export interface WalletConfig {
  privateKey: string;
  rpcUrl: string;
  minBalance: string;
  emergencyThreshold: string;
}

export interface WalletBalance {
  address: string;
  balance: bigint;
  formattedBalance: string;
  isHealthy: boolean;
  isEmergency: boolean;
}

export interface TransactionOptions {
  to: string;
  value: bigint;
  data?: string;
  gasLimit?: bigint;
  gasPrice?: bigint;
}

export interface TransactionResult {
  hash: string;
  from: string;
  to: string;
  value: bigint;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  error?: Error;
}
