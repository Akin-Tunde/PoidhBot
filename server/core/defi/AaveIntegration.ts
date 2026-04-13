import { ethers } from 'ethers';
import { Logger, LogLevel } from '../logger/Logger';
import type { ProtocolMetrics, DepositResult, WithdrawResult, ProtocolBalance } from './types';

// Aave Pool contract ABI (minimal)
const AAVE_POOL_ABI = [
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
  'function withdraw(address asset, uint256 amount, address to) external returns (uint256)',
  'function getUserAccountData(address user) external view returns (uint256, uint256, uint256, uint256, uint256, uint256)',
  'function getReserveData(address asset) external view returns (tuple(uint256, uint128, uint128, uint128, uint128, uint128, uint40, address, address, address, address, uint8))',
];

const aERC20_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
];

export class AaveIntegration {
  private provider: ethers.Provider;
  private signer: ethers.Signer;
  private logger: Logger;
  private poolAddress: string;
  private wethAddress: string;
  private aWethAddress: string;
  private poolContract: ethers.Contract;
  private aTokenContract: ethers.Contract;

  constructor(provider: ethers.Provider, signer: ethers.Signer, chainId: number, logLevel: LogLevel = LogLevel.INFO) {
    this.provider = provider;
    this.signer = signer;
    this.logger = new Logger('AaveIntegration', logLevel);

    // Set addresses based on chain
    if (chainId === 42161) {
      // Arbitrum
      this.poolAddress = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
      this.wethAddress = '0x82aF49447d8a07e3bd95bd0d56f313302c4DF60B';
      this.aWethAddress = '0x070341aA5Ed571f0FB2c4a5641409B1A46b4961b';
    } else if (chainId === 8453) {
      // Base
      this.poolAddress = '0xA238Dd5C0bF3C4f245e89Fc88F7aF002cc367ebD';
      this.wethAddress = '0x4200000000000000000000000000000000000006';
      this.aWethAddress = '0xD4a0e0b9149DbbCFc70e1A461E2b3f31f1d765e6';
    } else {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    this.poolContract = new ethers.Contract(this.poolAddress, AAVE_POOL_ABI, this.signer);
    this.aTokenContract = new ethers.Contract(this.aWethAddress, aERC20_ABI, this.signer);

    this.logger.info('Aave integration initialized', {
      poolAddress: this.poolAddress,
      wethAddress: this.wethAddress,
      aWethAddress: this.aWethAddress,
    });
  }

  async getAPY(): Promise<number> {
    try {
      // For demo purposes, return a fixed APY
      // In production, fetch from Aave API or contract
      this.logger.debug('Fetching Aave APY');
      return 8.5; // 8.5% APY
    } catch (error) {
      this.logger.error('Failed to fetch APY', error);
      return 0;
    }
  }

  async deposit(amount: bigint): Promise<DepositResult> {
    try {
      this.logger.info('Depositing to Aave', { amount: amount.toString() });

      // Approve WETH spending
      const approveTx = await this.aTokenContract.approve(this.poolAddress, amount);
      await approveTx.wait();
      this.logger.debug('Approval confirmed');

      // Deposit to Aave
      const depositTx = await this.poolContract.supply(
        this.wethAddress,
        amount,
        await this.signer.getAddress(),
        0
      );

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
      this.logger.info('Withdrawing from Aave', { amount: amount.toString() });

      const withdrawTx = await this.poolContract.withdraw(
        this.wethAddress,
        amount,
        await this.signer.getAddress()
      );

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
      const balance = await this.aTokenContract.balanceOf(address);

      this.logger.debug('Balance fetched', { balance: balance.toString() });

      return {
        protocol: 'Aave',
        balance,
        shares: balance,
        value: balance, // Simplified
        apy: await this.getAPY(),
      };
    } catch (error) {
      this.logger.error('Failed to get balance', error);
      return {
        protocol: 'Aave',
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
      name: 'Aave',
      apy,
      tvl: 0n, // Would fetch from contract
      risk: 'low',
      utilization: 0,
      lastUpdated: new Date(),
    };
  }
}
