/**
 * Chain configuration and utilities
 */

import { ethers } from "ethers";
import { config, CHAIN_CONFIG, currentChainConfig } from "../config.js";
import { ChainInteractionError } from "./types.js";

// ============================================================================
// Provider & Signer Setup
// ============================================================================

export function getProvider(): ethers.JsonRpcProvider {
  try {
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    return provider;
  } catch (error) {
    throw new ChainInteractionError("Failed to initialize provider", {
      rpcUrl: config.rpcUrl,
      error: String(error),
    });
  }
}

export function getSigner(): ethers.Wallet {
  try {
    const provider = getProvider();
    const wallet = new ethers.Wallet(config.privateKey, provider);
    return wallet;
  } catch (error) {
    throw new ChainInteractionError("Failed to initialize signer", {
      error: String(error),
    });
  }
}

// ============================================================================
// Contract Addresses
// ============================================================================

export function getPoidhContractAddress(): string {
  return currentChainConfig.poidhContract;
}

export function getNftContractAddress(): string {
  // NFT contract is typically at a derived address or stored in the main contract
  // For now, we'll assume it's queried from the main contract
  return currentChainConfig.poidhContract;
}

// ============================================================================
// Chain Information
// ============================================================================

export function getChainName(): string {
  return currentChainConfig.name;
}

export function getChainId(): number {
  return currentChainConfig.chainId;
}

export function getExplorerUrl(txHash: string): string {
  return `${currentChainConfig.explorer}/tx/${txHash}`;
}

export function getPoidhBountyUrl(bountyId: bigint): string {
  const frontendId = Number(bountyId) + currentChainConfig.poidhV2Offset;
  return `${currentChainConfig.poidhBaseUrl}/bounty/${frontendId}`;
}

// ============================================================================
// Gas Utilities
// ============================================================================

export async function estimateGas(
  tx: ethers.TransactionRequest
): Promise<bigint> {
  try {
    const provider = getProvider();
    const gasEstimate = await provider.estimateGas(tx);
    return gasEstimate;
  } catch (error) {
    throw new ChainInteractionError("Failed to estimate gas", {
      error: String(error),
    });
  }
}

export async function getGasPrice(): Promise<bigint> {
  try {
    const provider = getProvider();
    const feeData = await provider.getFeeData();

    if (!feeData.gasPrice) {
      throw new Error("Unable to fetch gas price");
    }

    // Apply multiplier from config
    const multipliedPrice = (feeData.gasPrice * BigInt(Math.floor(config.gasPriceMultiplier * 100))) / BigInt(100);
    return multipliedPrice;
  } catch (error) {
    throw new ChainInteractionError("Failed to get gas price", {
      error: String(error),
    });
  }
}

// ============================================================================
// Balance Utilities
// ============================================================================

export async function getWalletBalance(): Promise<bigint> {
  try {
    const signer = getSigner();
    const provider = getProvider();
    const balance = await provider.getBalance(signer.address);
    return balance;
  } catch (error) {
    throw new ChainInteractionError("Failed to get wallet balance", {
      error: String(error),
    });
  }
}

export async function checkSufficientBalance(requiredAmount: bigint): Promise<boolean> {
  try {
    const balance = await getWalletBalance();
    return balance >= requiredAmount;
  } catch (error) {
    throw new ChainInteractionError("Failed to check balance", {
      error: String(error),
    });
  }
}

// ============================================================================
// Transaction Utilities
// ============================================================================

export async function waitForTransaction(txHash: string, confirmations: number = 1): Promise<ethers.TransactionReceipt | null> {
  try {
    const provider = getProvider();
    const receipt = await provider.waitForTransaction(txHash, confirmations);
    return receipt;
  } catch (error) {
    throw new ChainInteractionError("Failed to wait for transaction", {
      txHash,
      error: String(error),
    });
  }
}

export async function sendTransaction(tx: ethers.TransactionRequest): Promise<string> {
  try {
    const signer = getSigner();
    const response = await signer.sendTransaction(tx);
    return response.hash;
  } catch (error) {
    throw new ChainInteractionError("Failed to send transaction", {
      error: String(error),
    });
  }
}

// ============================================================================
// Contract Interaction Utilities
// ============================================================================

export function getContractInterface(abi: ethers.Interface | string[]): ethers.Interface {
  if (typeof abi === "string") {
    return new ethers.Interface(JSON.parse(abi));
  }
  return abi instanceof ethers.Interface ? abi : new ethers.Interface(abi);
}

export async function callContract(
  contractAddress: string,
  abi: ethers.Interface | string[],
  functionName: string,
  args: unknown[] = []
): Promise<unknown> {
  try {
    const provider = getProvider();
    const iface = getContractInterface(abi);
    const contract = new ethers.Contract(contractAddress, iface, provider);
    const result = await contract[functionName](...args);
    return result;
  } catch (error) {
    throw new ChainInteractionError(`Failed to call contract function: ${functionName}`, {
      contractAddress,
      functionName,
      error: String(error),
    });
  }
}

// ============================================================================
// Retry Utilities
// ============================================================================

export async function retryAsync<T>(
  fn: () => Promise<T>,
  maxAttempts: number = config.retryAttempts,
  delayMs: number = config.retryDelayMs
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new ChainInteractionError("Max retry attempts exceeded", {
    maxAttempts,
    lastError: lastError?.message,
  });
}
