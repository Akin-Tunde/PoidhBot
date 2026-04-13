/**
 * PoidhV3 smart contract interaction
 * Handles bounty creation, claim monitoring, and payout execution
 */

import { ethers } from "ethers";
import { getSigner, getProvider, getPoidhContractAddress, retryAsync, sendTransaction, waitForTransaction } from "./chains.js";
import { ChainInteractionError } from "./types.js";
import type { BountyTuple, ClaimTuple } from "./types.js";

// ============================================================================
// PoidhV3 ABI (Essential Functions)
// ============================================================================

const POIDH_ABI = [
  // View functions
  "function getClaimsByBountyId(uint256 bountyId, uint256 offset) view returns (tuple(uint256 id, address issuer, uint256 bountyId, address bountyIssuer, string name, string description, uint256 createdAt, bool accepted)[])",
  "function getBountyById(uint256 bountyId) view returns (tuple(uint256 id, address issuer, string name, string description, uint256 amount, uint256 createdAt, uint256 claimCount, uint256 acceptedClaimId))",
  "function poidhNft() view returns (address)",
  "function MIN_BOUNTY_AMOUNT() view returns (uint256)",
  "function MIN_CONTRIBUTION() view returns (uint256)",

  // State-changing functions
  "function createSoloBounty(string memory name, string memory description) payable returns (uint256)",
  "function createOpenBounty(string memory name, string memory description) payable returns (uint256)",
  "function acceptClaim(uint256 bountyId, uint256 claimId) returns (bool)",
  "function submitClaimForVote(uint256 bountyId, uint256 claimId) returns (bool)",
  "function resolveVote(uint256 bountyId, uint256 claimId) returns (bool)",

  // Events
  "event BountyCreated(uint256 indexed bountyId, address indexed issuer, string name, uint256 amount)",
  "event ClaimSubmitted(uint256 indexed bountyId, uint256 indexed claimId, address indexed claimant)",
  "event ClaimAccepted(uint256 indexed bountyId, uint256 indexed claimId)",
];

// ============================================================================
// Contract Instance
// ============================================================================

function getPoidhContract(provider?: ethers.Provider): ethers.Contract {
  const contractProvider = provider || getProvider();
  const contractAddress = getPoidhContractAddress();
  return new ethers.Contract(contractAddress, POIDH_ABI, contractProvider);
}

function getPoidhContractWithSigner(): ethers.Contract {
  const signer = getSigner();
  const contractAddress = getPoidhContractAddress();
  return new ethers.Contract(contractAddress, POIDH_ABI, signer);
}

// ============================================================================
// Bounty Creation
// ============================================================================

export async function createSoloBounty(
  name: string,
  description: string,
  amount: bigint
): Promise<{ txHash: string; bountyId?: bigint }> {
  try {
    const contract = getPoidhContractWithSigner();

    // Create transaction
    const tx = await contract.createSoloBounty(name, description, {
      value: amount,
    });

    const txHash = tx.hash;
    console.log(`[createSoloBounty] Transaction sent: ${txHash}`);

    // Wait for receipt
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error("Transaction receipt not found");
    }

    // Extract bounty ID from logs
    const bountyId = extractBountyIdFromReceipt(receipt);

    return { txHash, bountyId };
  } catch (error) {
    throw new ChainInteractionError("Failed to create solo bounty", {
      name,
      description,
      amount: amount.toString(),
      error: String(error),
    });
  }
}

export async function createOpenBounty(
  name: string,
  description: string,
  amount: bigint
): Promise<{ txHash: string; bountyId?: bigint }> {
  try {
    const contract = getPoidhContractWithSigner();

    // Create transaction
    const tx = await contract.createOpenBounty(name, description, {
      value: amount,
    });

    const txHash = tx.hash;
    console.log(`[createOpenBounty] Transaction sent: ${txHash}`);

    // Wait for receipt
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error("Transaction receipt not found");
    }

    // Extract bounty ID from logs
    const bountyId = extractBountyIdFromReceipt(receipt);

    return { txHash, bountyId };
  } catch (error) {
    throw new ChainInteractionError("Failed to create open bounty", {
      name,
      description,
      amount: amount.toString(),
      error: String(error),
    });
  }
}

// ============================================================================
// Claim Monitoring
// ============================================================================

export async function getClaimsByBountyId(
  bountyId: bigint,
  offset: number = 0
): Promise<ClaimTuple[]> {
  try {
    return await retryAsync(async () => {
      const contract = getPoidhContract();
      const claims = await contract.getClaimsByBountyId(bountyId, offset);

      // Convert to typed array
      return claims.map((claim: unknown) => {
        const c = claim as any;
        return {
          id: BigInt(c.id),
          issuer: c.issuer,
          bountyId: BigInt(c.bountyId),
          bountyIssuer: c.bountyIssuer,
          name: c.name,
          description: c.description,
          createdAt: BigInt(c.createdAt),
          accepted: c.accepted,
        } as ClaimTuple;
      });
    });
  } catch (error) {
    throw new ChainInteractionError("Failed to get claims by bounty ID", {
      bountyId: bountyId.toString(),
      offset,
      error: String(error),
    });
  }
}

export async function getBountyById(bountyId: bigint): Promise<BountyTuple> {
  try {
    return await retryAsync(async () => {
      const contract = getPoidhContract();
      const bounty = await contract.getBountyById(bountyId);

      return {
        id: BigInt(bounty.id),
        issuer: bounty.issuer,
        name: bounty.name,
        description: bounty.description,
        amount: BigInt(bounty.amount),
        createdAt: BigInt(bounty.createdAt),
        claimCount: BigInt(bounty.claimCount),
        acceptedClaimId: bounty.acceptedClaimId ? BigInt(bounty.acceptedClaimId) : null,
      } as BountyTuple;
    });
  } catch (error) {
    throw new ChainInteractionError("Failed to get bounty by ID", {
      bountyId: bountyId.toString(),
      error: String(error),
    });
  }
}

// ============================================================================
// Claim Acceptance (Solo Bounty)
// ============================================================================

export async function acceptClaim(bountyId: bigint, claimId: bigint): Promise<string> {
  try {
    const contract = getPoidhContractWithSigner();

    // Create transaction
    const tx = await contract.acceptClaim(bountyId, claimId);

    const txHash = tx.hash;
    console.log(`[acceptClaim] Transaction sent: ${txHash}`);

    // Wait for receipt
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error("Transaction receipt not found");
    }

    return txHash;
  } catch (error) {
    throw new ChainInteractionError("Failed to accept claim", {
      bountyId: bountyId.toString(),
      claimId: claimId.toString(),
      error: String(error),
    });
  }
}

// ============================================================================
// Claim Voting (Open Bounty)
// ============================================================================

export async function submitClaimForVote(bountyId: bigint, claimId: bigint): Promise<string> {
  try {
    const contract = getPoidhContractWithSigner();

    // Create transaction
    const tx = await contract.submitClaimForVote(bountyId, claimId);

    const txHash = tx.hash;
    console.log(`[submitClaimForVote] Transaction sent: ${txHash}`);

    // Wait for receipt
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error("Transaction receipt not found");
    }

    return txHash;
  } catch (error) {
    throw new ChainInteractionError("Failed to submit claim for vote", {
      bountyId: bountyId.toString(),
      claimId: claimId.toString(),
      error: String(error),
    });
  }
}

export async function resolveVote(bountyId: bigint, claimId: bigint): Promise<string> {
  try {
    const contract = getPoidhContractWithSigner();

    // Create transaction
    const tx = await contract.resolveVote(bountyId, claimId);

    const txHash = tx.hash;
    console.log(`[resolveVote] Transaction sent: ${txHash}`);

    // Wait for receipt
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error("Transaction receipt not found");
    }

    return txHash;
  } catch (error) {
    throw new ChainInteractionError("Failed to resolve vote", {
      bountyId: bountyId.toString(),
      claimId: claimId.toString(),
      error: String(error),
    });
  }
}

// ============================================================================
// NFT Contract Access
// ============================================================================

export async function getNftContractAddress(): Promise<string> {
  try {
    return await retryAsync(async () => {
      const contract = getPoidhContract();
      return await contract.poidhNft();
    });
  } catch (error) {
    throw new ChainInteractionError("Failed to get NFT contract address", {
      error: String(error),
    });
  }
}

export async function getClaimTokenUri(claimId: bigint): Promise<string> {
  try {
    return await retryAsync(async () => {
      const nftAddress = await getNftContractAddress();
      const nftAbi = ["function tokenURI(uint256 tokenId) view returns (string)"];
      const nftContract = new ethers.Contract(nftAddress, nftAbi, getProvider());

      return await nftContract.tokenURI(claimId);
    });
  } catch (error) {
    throw new ChainInteractionError("Failed to get claim token URI", {
      claimId: claimId.toString(),
      error: String(error),
    });
  }
}

// ============================================================================
// Minimum Amounts
// ============================================================================

export async function getMinBountyAmount(): Promise<bigint> {
  try {
    return await retryAsync(async () => {
      const contract = getPoidhContract();
      return BigInt(await contract.MIN_BOUNTY_AMOUNT());
    });
  } catch (error) {
    throw new ChainInteractionError("Failed to get minimum bounty amount", {
      error: String(error),
    });
  }
}

export async function getMinContribution(): Promise<bigint> {
  try {
    return await retryAsync(async () => {
      const contract = getPoidhContract();
      return BigInt(await contract.MIN_CONTRIBUTION());
    });
  } catch (error) {
    throw new ChainInteractionError("Failed to get minimum contribution", {
      error: String(error),
    });
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function extractBountyIdFromReceipt(receipt: ethers.TransactionReceipt): bigint | undefined {
  try {
    const iface = new ethers.Interface(POIDH_ABI);

    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === "BountyCreated") {
          return BigInt(parsed.args[0]);
        }
      } catch {
        // Skip logs that don't match the interface
      }
    }

    return undefined;
  } catch (error) {
    console.warn("Failed to extract bounty ID from receipt:", error);
    return undefined;
  }
}

export async function validateBountyAmount(amount: bigint): Promise<boolean> {
  try {
    const minAmount = await getMinBountyAmount();
    return amount >= minAmount;
  } catch (error) {
    console.error("Failed to validate bounty amount:", error);
    return false;
  }
}
