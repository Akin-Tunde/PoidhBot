/**
 * URI resolution for IPFS, Arweave, and HTTP content
 */

import { getClaimTokenUri } from "./poidh.js";
import { ChainInteractionError } from "./types.js";
import type { ClaimEvidence, ContentType, ClaimTuple } from "./types.js";

// ============================================================================
// URI Normalization
// ============================================================================

function normalizeUri(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return uri.replace("ipfs://", "https://ipfs.io/ipfs/");
  }
  if (uri.startsWith("ar://")) {
    return uri.replace("ar://", "https://arweave.net/");
  }
  return uri;
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// ============================================================================
// Content Type Detection
// ============================================================================

function detectContentType(contentTypeHeader: string, uri: string): ContentType {
  const lower = contentTypeHeader.toLowerCase();

  if (lower.startsWith("image/")) return "image";
  if (lower.startsWith("video/")) return "video";
  if (lower.includes("json") || lower.includes("html") || lower.includes("text/")) return "web";
  if (lower.includes("pdf") || lower.includes("document")) return "document";

  // Fallback to URI extension
  if (uri.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return "image";
  if (uri.match(/\.(mp4|webm|mov|avi)$/i)) return "video";
  if (uri.match(/\.(pdf|doc|docx)$/i)) return "document";

  return "unknown";
}

// ============================================================================
// Metadata Resolution
// ============================================================================

interface ERC721Metadata {
  name?: string;
  description?: string;
  image?: string;
  animation_url?: string;
  [key: string]: unknown;
}

async function fetchMetadata(url: string): Promise<ERC721Metadata | null> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "poidh-sentinel/1.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("json")) return null;

    return (await response.json()) as ERC721Metadata;
  } catch {
    return null;
  }
}

async function resolveMetadataUrls(metadata: ERC721Metadata): Promise<{
  imageUrl?: string;
  animationUrl?: string;
}> {
  const result: { imageUrl?: string; animationUrl?: string } = {};

  // Prefer animation_url (video/interactive) over image
  if (metadata.animation_url) {
    result.animationUrl = normalizeUri(String(metadata.animation_url));
  }

  if (metadata.image) {
    result.imageUrl = normalizeUri(String(metadata.image));
  }

  return result;
}

// ============================================================================
// Content Fetching
// ============================================================================

async function fetchContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "poidh-sentinel/1.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return "";

    const contentType = response.headers.get("content-type") || "";

    // Handle HTML
    if (contentType.includes("html")) {
      const html = await response.text();
      return stripHtml(html);
    }

    // Handle JSON
    if (contentType.includes("json")) {
      const json = await response.json();
      return JSON.stringify(json);
    }

    // Handle text
    if (contentType.includes("text/")) {
      return await response.text();
    }

    return "";
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================================
// Main Resolution Function
// ============================================================================

export async function resolveClaimEvidence(
  claim: ClaimTuple
): Promise<ClaimEvidence> {
  try {
    // Step 1: Get token URI from NFT contract
    const tokenUri = await getClaimTokenUri(claim.id);
    const normalizedTokenUri = normalizeUri(tokenUri);

    // Step 2: Initialize evidence object
    const evidence: ClaimEvidence = {
      tokenUri: normalizedTokenUri,
      contentUri: normalizedTokenUri,
      contentType: "unknown",
      title: claim.name,
      text: claim.description,
    };

    // Step 3: Fetch and parse metadata if it's a URL
    if (isHttpUrl(normalizedTokenUri)) {
      const metadata = await fetchMetadata(normalizedTokenUri);

      if (metadata) {
        evidence.rawMetadata = metadata;

        // Extract image/animation URLs
        const { imageUrl, animationUrl } = await resolveMetadataUrls(metadata);
        if (imageUrl) evidence.imageUrl = imageUrl;
        if (animationUrl) evidence.animationUrl = animationUrl;

        // Detect content type from metadata
        const contentUrl = animationUrl || imageUrl || normalizedTokenUri;
        const contentResponse = await fetch(contentUrl, {
          method: "HEAD",
          headers: { "user-agent": "poidh-sentinel/1.0" },
          signal: AbortSignal.timeout(5000),
        }).catch(() => null);

        if (contentResponse) {
          const contentTypeHeader = contentResponse.headers.get("content-type") || "";
          evidence.contentType = detectContentType(contentTypeHeader, contentUrl);
          evidence.contentUri = contentUrl;
        }

        // Fetch text content if available
        if (metadata.description) {
          evidence.text = String(metadata.description);
        }
      } else {
        // Not JSON metadata, fetch as direct content
        const content = await fetchContent(normalizedTokenUri);
        evidence.text = content;
        evidence.contentType = detectContentType("", normalizedTokenUri);
      }
    } else {
      // Direct content URI (not a URL)
      evidence.contentType = detectContentType("", normalizedTokenUri);
    }

    return evidence;
  } catch (error) {
    throw new ChainInteractionError("Failed to resolve claim evidence", {
      claimId: claim.id.toString(),
      error: String(error),
    });
  }
}

// ============================================================================
// Batch Resolution
// ============================================================================

export async function resolveClaimsEvidence(
  claims: ClaimTuple[]
): Promise<ClaimEvidence[]> {
  const results: ClaimEvidence[] = [];

  for (const claim of claims) {
    try {
      const evidence = await resolveClaimEvidence(claim);
      results.push(evidence);
    } catch (error) {
      console.warn(`Failed to resolve evidence for claim ${claim.id}:`, error);
      // Continue with other claims
    }
  }

  return results;
}

// ============================================================================
// URL Extraction
// ============================================================================

export function extractUrls(text: string): string[] {
  const urlRegex = /\bhttps?:\/\/[^\s<>"')]+/gi;
  const matches = text.match(urlRegex) || [];
  return [...new Set(matches)]; // Deduplicate
}

export function uniqueNormalizedUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const url of urls) {
    const normalized_url = normalizeUri(url).trim();
    if (normalized_url && isHttpUrl(normalized_url) && !seen.has(normalized_url)) {
      seen.add(normalized_url);
      normalized.push(normalized_url);
    }
  }

  return normalized;
}
