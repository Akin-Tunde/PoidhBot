import { ethers } from 'ethers';
import { Logger, LogLevel } from '../logger/Logger';
import type { WalletBalance, TransactionOptions, TransactionResult, WalletConfig } from './types';

export class AutonomousWallet {
  private wallet: ethers.Wallet;
  private provider: ethers.Provider;
  private minBalance: bigint;
  private emergencyThreshold: bigint;
  private logger: Logger;
  private isMonitoring: boolean = false;

  constructor(config: WalletConfig, logLevel: LogLevel = LogLevel.INFO) {
    this.logger = new Logger('AutonomousWallet', logLevel);

    try {
      this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
      this.wallet = new ethers.Wallet(config.privateKey, this.provider);
      this.minBalance = ethers.parseEther(config.minBalance);
      this.emergencyThreshold = ethers.parseEther(config.emergencyThreshold);

      this.logger.info('Wallet initialized', {
        address: this.wallet.address,
        minBalance: config.minBalance,
        emergencyThreshold: config.emergencyThreshold,
      });
    } catch (error) {
      this.logger.error('Failed to initialize wallet', error);
      throw error;
    }
  }

  async getBalance(): Promise<WalletBalance> {
    try {
      const balance = await this.provider.getBalance(this.wallet.address);
      const formattedBalance = ethers.formatEther(balance);
      const isHealthy = balance >= this.minBalance;
      const isEmergency = balance < this.emergencyThreshold;

      return {
        address: this.wallet.address,
        balance,
        formattedBalance,
        isHealthy,
        isEmergency,
      };
    } catch (error) {
      this.logger.error('Failed to get balance', error);
      throw error;
    }
  }

  async isBalanceHealthy(): Promise<boolean> {
    const balance = await this.getBalance();
    return balance.isHealthy;
  }

  async isEmergency(): Promise<boolean> {
    const balance = await this.getBalance();
    return balance.isEmergency;
  }

  async sendTransaction(options: TransactionOptions): Promise<TransactionResult> {
    try {
      this.logger.info('Sending transaction', {
        to: options.to,
        value: ethers.formatEther(options.value),
      });

      const tx = await this.wallet.sendTransaction({
        to: options.to,
        value: options.value,
        data: options.data,
        gasLimit: options.gasLimit,
        gasPrice: options.gasPrice,
      });

      this.logger.info('Transaction sent', { hash: tx.hash });

      // Wait for confirmation
      const receipt = await tx.wait();

      const result: TransactionResult = {
        hash: tx.hash,
        from: tx.from!,
        to: tx.to!,
        value: tx.value,
        status: receipt?.status === 1 ? 'confirmed' : 'failed',
        blockNumber: receipt?.blockNumber,
      };

      this.logger.info('Transaction confirmed', result);
      return result;
    } catch (error) {
      this.logger.error('Transaction failed', error);
      throw error;
    }
  }

  async monitorBalance(intervalMs: number = 60000): Promise<void> {
    if (this.isMonitoring) {
      this.logger.warn('Balance monitoring already running');
      return;
    }

    this.isMonitoring = true;
    this.logger.info('Starting balance monitoring', { intervalMs });

    while (this.isMonitoring) {
      try {
        const balance = await this.getBalance();

        this.logger.info('Balance check', {
          balance: balance.formattedBalance,
          healthy: balance.isHealthy,
          emergency: balance.isEmergency,
        });

        if (balance.isEmergency) {
          this.logger.error('EMERGENCY: Balance below threshold!', {
            current: balance.formattedBalance,
            threshold: ethers.formatEther(this.emergencyThreshold),
          });
        }

        await new Promise(resolve => setTimeout(resolve, intervalMs));
      } catch (error) {
        this.logger.error('Balance monitoring error', error);
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    this.logger.info('Balance monitoring stopped');
  }

  getAddress(): string {
    return this.wallet.address;
  }

  getWallet(): ethers.Wallet {
    return this.wallet;
  }

  getProvider(): ethers.Provider {
    return this.provider;
  }

  getMinBalance(): bigint {
    return this.minBalance;
  }

  getEmergencyThreshold(): bigint {
    return this.emergencyThreshold;
  }
}
