import { NFTCollectionContract } from '@/config';
import {
  contractUriToHttp,
  getContractMetadataCandidateUrls,
  ipfsUriToHttp,
  normalizeContractURI,
} from '@/lib/utils/ipfs';
import type { Address, PublicClient } from 'viem';

export type CollectionDisplayMetadata = {
  image?: string;
  description?: string;
};

const METADATA_FETCH_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), METADATA_FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function toBrowserImageUri(raw: string): string {
  return ipfsUriToHttp(raw.trim());
}

function resolveMetadataImageUri(imageUri: string, metadataUri: string): string {
  const normalized = imageUri.trim();
  if (!normalized) return '';

  if (
    normalized.startsWith('ipfs://') ||
    normalized.startsWith('http://') ||
    normalized.startsWith('https://')
  ) {
    return ipfsUriToHttp(normalized);
  }

  const metadataHttpUri = contractUriToHttp(metadataUri);
  if (!metadataHttpUri) return ipfsUriToHttp(normalized);

  let metadataBase = metadataHttpUri;
  try {
    const url = new URL(metadataHttpUri);
    const pathname = url.pathname;
    const lastSegment = pathname.split('/').filter(Boolean).pop() ?? '';
    const looksLikeFile = /\.[a-z0-9]+$/i.test(lastSegment);
    if (!pathname.endsWith('/') && !looksLikeFile) {
      url.pathname = `${pathname}/`;
    }
    metadataBase = url.toString();
  } catch {
    if (!metadataBase.endsWith('/')) metadataBase = `${metadataBase}/`;
  }

  try {
    return new URL(normalized, metadataBase).toString();
  } catch {
    return ipfsUriToHttp(normalized);
  }
}

function getTokenMetadataCandidateUrls(rawTokenUri: string): string[] {
  const base = ipfsUriToHttp(rawTokenUri).trim();
  if (!base) return [];

  const candidates = [base];

  try {
    const url = new URL(base);
    const lastSegment = url.pathname.split('/').filter(Boolean).pop() ?? '';
    const hasExtension = /\.[a-z0-9]+$/i.test(lastSegment);
    if (!hasExtension) {
      candidates.push(`${base}.json`);
    }
  } catch {
    const lastSegment = base.split('/').filter(Boolean).pop() ?? '';
    const hasExtension = /\.[a-z0-9]+$/i.test(lastSegment);
    if (!hasExtension) {
      candidates.push(`${base}.json`);
    }
  }

  return Array.from(new Set(candidates));
}

async function fetchImageOrMetadata(
  candidates: string[],
): Promise<CollectionDisplayMetadata | null> {
  for (const [index, url] of candidates.entries()) {
    try {
      const response = await fetchWithTimeout(url);
      if (!response.ok) continue;

      const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
      if (contentType.startsWith('image/')) {
        return { image: toBrowserImageUri(response.url || url) };
      }

      const text = await response.text();
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {
        const mayBeDirectImage =
          index === 0 &&
          (contentType.includes('application/octet-stream') ||
            contentType.includes('binary') ||
            contentType.length === 0);
        if (mayBeDirectImage) {
          return { image: toBrowserImageUri(response.url || url) };
        }
        continue;
      }

      const image =
        typeof parsed.image === 'string' && parsed.image.trim().length > 0
          ? resolveMetadataImageUri(parsed.image, response.url || url)
          : undefined;
      const description =
        typeof parsed.description === 'string' && parsed.description.trim().length > 0
          ? parsed.description.trim()
          : undefined;

      if (image || description) {
        return { image, description };
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function fetchCollectionContractMetadata(
  rawContractUri: string,
): Promise<CollectionDisplayMetadata | null> {
  const metadataUri = normalizeContractURI(rawContractUri.trim());
  if (!metadataUri) return null;

  return fetchImageOrMetadata(getContractMetadataCandidateUrls(metadataUri));
}

export async function fetchTokenDisplayImage(
  rawTokenUri: string,
): Promise<string | undefined> {
  const metadata = await fetchImageOrMetadata(getTokenMetadataCandidateUrls(rawTokenUri));
  return metadata?.image;
}

export async function resolveCollectionDisplayMetadata(options: {
  contractUri?: string;
  collectionAddress?: Address;
  totalMinted?: bigint;
  publicClient?: PublicClient;
}): Promise<CollectionDisplayMetadata | null> {
  const {
    contractUri = '',
    collectionAddress,
    totalMinted = 0n,
    publicClient,
  } = options;

  const contractMetadata = await fetchCollectionContractMetadata(contractUri);
  if (contractMetadata?.image) {
    return contractMetadata;
  }

  if (!publicClient || !collectionAddress || totalMinted <= 0n) {
    return contractMetadata;
  }

  for (const tokenId of [1n, 0n]) {
    try {
      const tokenUri = await publicClient.readContract({
        abi: NFTCollectionContract,
        address: collectionAddress,
        functionName: 'tokenURI',
        args: [tokenId],
      });

      if (typeof tokenUri !== 'string' || !tokenUri.trim()) {
        continue;
      }

      const image = await fetchTokenDisplayImage(tokenUri);
      if (image) {
        return {
          ...contractMetadata,
          image,
        };
      }
    } catch {
      continue;
    }
  }

  return contractMetadata;
}
