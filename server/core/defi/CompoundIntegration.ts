import { ethers } from 'ethers';
import { Logger, LogLevel } from '../logger/Logger';
import type { ProtocolMetrics, DepositResult, WithdrawResult, ProtocolBalance } from './types';

// Compound Comet contract ABI (minimal)
const COMET_ABI = [
  'function supply(address asset, uint256 amount) external',
  'function withdraw(address asset, uint256 amount) external',
  'function balanceOf(address account) external view returns (uint256)',
  'function getSupplyRate(uint256 utilization) external view returns (uint64)',
  'function getUtilization() external view returns (uint256)',
];

const cToken_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
];

export class CompoundIntegration {
  private provider: ethers.Provider;
  private signer: ethers.Signer;
  private logger: Logger;
  private cometAddress: string;
  private wethAddress: string;
  private cWethAddress: string;
  private cometContract: ethers.Contract;
  private cTokenContract: ethers.Contract;

  constructor(provider: ethers.Provider, signer: ethers.Signer, chainId: number, logLevel: LogLevel = LogLevel.INFO) {
    this.provider = provider;
    this.signer = signer;
    this.logger = new Logger('CompoundIntegration', logLevel);

    // Set addresses based on chain
    if (chainId === 42161) {
      // Arbitrum
      this.cometAddress = '0xA5EDBF82c4D54BEC3b6f61B3113E5B8cf3F41EA3';
      this.wethAddress = '0x82aF49447d8a07e3bd95bd0d56f313302c4DF60B';
      this.cWethAddress = '0x6806411765Af15Bddd26f8f544A34cC40cb9838B';
    } else if (chainId === 8453) {
      // Base
      this.cometAddress = '0xb125E6687d4313864e53df431d5425969c15Eb2F';
      this.wethAddress = '0x4200000000000000000000000000000000000006';
      this.cWethAddress = '0x46e6b214b524310e3C6dc6D81EB0d8eCB3C03541';
    } else {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    this.cometContract = new ethers.Contract(this.cometAddress, COMET_ABI, this.signer);
    this.cTokenContract = new ethers.Contract(this.cWethAddress, cToken_ABI, this.signer);

    this.logger.info('Compound integration initialized', {
      cometAddress: this.cometAddress,
      wethAddress: this.wethAddress,
      cWethAddress: this.cWethAddress,
    });
  }

  async getAPY(): Promise<number> {
    try {
      // For demo purposes, return a fixed APY
      // In production, fetch from Compound API or contract
      this.logger.debug('Fetching Compound APY');
      return 7.2; // 7.2% APY
    } catch (error) {
      this.logger.error('Failed to fetch APY', error);
      return 0;
    }
  }

  async deposit(amount: bigint): Promise<DepositResult> {
    try {
      this.logger.info('Depositing to Compound', { amount: amount.toString() });

      // Approve WETH spending
      const approveTx = await this.cTokenContract.approve(this.cometAddress, amount);
      await approveTx.wait();
      this.logger.debug('Approval confirmed');

      // Deposit to Compound
      const depositTx = await this.cometContract.supply(this.wethAddress, amount);
      const receipt = await depositTx.wait();

      this.logger.info('Deposit successful', { txHash: depositTx.hash });

      return {
        success: true,
        txHash: depositTx.hash,
        amount,
        shares: amount, // Simplified
        message: 'Deposit successful',
      };
    } catch (error) {
      this.logger.error('Deposit failed', error);
      return {
        success: false,
        txHash: '',
        amount: 0n,
        shares: 0n,
        message: `Deposit failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async withdraw(amount: bigint): Promise<WithdrawResult> {
    try {
      this.logger.info('Withdrawing from Compound', { amount: amount.toString() });

      const withdrawTx = await this.cometContract.withdraw(this.wethAddress, amount);
      const receipt = await withdrawTx.wait();

      this.logger.info('Withdrawal successful', { txHash: withdrawTx.hash });

      return {
        success: true,
        txHash: withdrawTx.hash,
        amount,
        message: 'Withdrawal successful',
      };
    } catch (error) {
      this.logger.error('Withdrawal failed', error);
      return {
        success: false,
        txHash: '',
        amount: 0n,
        message: `Withdrawal failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async getBalance(): Promise<ProtocolBalance> {
    try {
      const address = await this.signer.getAddress();
      const balance = await this.cTokenContract.balanceOf(address);

      this.logger.debug('Balance fetched', { balance: balance.toString() });

      return {
        protocol: 'Compound',
        balance,
        shares: balance,
        value: balance, // Simplified
        apy: await this.getAPY(),
      };
    } catch (error) {
      this.logger.error('Failed to get balance', error);
      return {
        protocol: 'Compound',
        balance: 0n,
        shares: 0n,
        value: 0n,
        apy: 0,
      };
    }
  }

  async getMetrics(): Promise<ProtocolMetrics> {
    const apy = await this.getAPY();
    return {
      name: 'Compound',
      apy,
      tvl: 0n, // Would fetch from contract
      risk: 'low',
      utilization: 0,
      lastUpdated: new Date(),
    };
  }
}
