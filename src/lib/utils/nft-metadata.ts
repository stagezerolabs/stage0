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

export type TokenMetadataAttribute = {
  traitType: string;
  value: string;
  displayType?: string;
};

export type TokenDisplayMetadata = CollectionDisplayMetadata & {
  name?: string;
  attributes?: TokenMetadataAttribute[];
};

export type TokenMetadataResolveOptions = {
  baseUri?: string;
  tokenId?: bigint | number | string;
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

function normalizeMetadataValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
}

function extractTokenAttributes(parsed: Record<string, unknown>): TokenMetadataAttribute[] | undefined {
  const rawAttributes = Array.isArray(parsed.attributes)
    ? parsed.attributes
    : Array.isArray(parsed.traits)
      ? parsed.traits
      : undefined;
  if (!Array.isArray(rawAttributes)) return undefined;

  const attributes = rawAttributes
    .map<TokenMetadataAttribute | null>((entry) => {
      if (!entry || typeof entry !== 'object') return null;

      const traitType =
        normalizeMetadataValue((entry as Record<string, unknown>).trait_type) ??
        normalizeMetadataValue((entry as Record<string, unknown>).traitType) ??
        normalizeMetadataValue((entry as Record<string, unknown>).name);
      const value = normalizeMetadataValue((entry as Record<string, unknown>).value);
      const displayType = normalizeMetadataValue((entry as Record<string, unknown>).display_type);

      if (!traitType || !value) return null;
      return displayType ? { traitType, value, displayType } : { traitType, value };
    })
    .filter((attribute): attribute is TokenMetadataAttribute => attribute !== null);

  return attributes.length > 0 ? attributes : undefined;
}

function extractMetadataImage(parsed: Record<string, unknown>): string | undefined {
  return (
    normalizeMetadataValue(parsed.image) ??
    normalizeMetadataValue(parsed.image_url) ??
    normalizeMetadataValue(parsed.imageUrl) ??
    normalizeMetadataValue(parsed.thumbnail) ??
    normalizeMetadataValue(parsed.thumbnail_url)
  );
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

function addJsonFallback(candidates: string[], url: string) {
  const normalized = url.trim();
  if (!normalized) return;
  candidates.push(normalized);

  try {
    const parsed = new URL(normalized);
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
    const hasExtension = /\.[a-z0-9]+$/i.test(lastSegment);
    if (!hasExtension) {
      candidates.push(`${normalized}.json`);
    }
  } catch {
    const lastSegment = normalized.split('/').filter(Boolean).pop() ?? '';
    const hasExtension = /\.[a-z0-9]+$/i.test(lastSegment);
    if (!hasExtension) {
      candidates.push(`${normalized}.json`);
    }
  }
}

function getBaseUriTokenCandidates(rawBaseUri: string, tokenId: bigint | number | string | undefined): string[] {
  const id = tokenId === undefined ? '' : String(tokenId).trim();
  if (!id) return [];

  const base = ipfsUriToHttp(rawBaseUri).trim();
  if (!base) return [];

  const candidates: string[] = [];
  const trimmedBase = base.replace(/\/+$/, '');
  addJsonFallback(candidates, `${trimmedBase}/${id}`);

  if (base.endsWith('/')) {
    addJsonFallback(candidates, `${base}${id}`);
  } else {
    // Keep this candidate for contracts already returning concatenated tokenURI-style bases.
    addJsonFallback(candidates, `${base}${id}`);
  }

  return candidates;
}

function getTokenMetadataCandidateUrls(
  rawTokenUri: string,
  options: TokenMetadataResolveOptions = {},
): string[] {
  const candidates: string[] = [];
  const base = ipfsUriToHttp(rawTokenUri).trim();

  if (base) {
    addJsonFallback(candidates, base);
  }

  candidates.push(...getBaseUriTokenCandidates(options.baseUri ?? '', options.tokenId));

  return Array.from(new Set(candidates));
}

async function fetchImageOrMetadata(
  candidates: string[],
): Promise<TokenDisplayMetadata | null> {
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

      const imageValue = extractMetadataImage(parsed);
      const image = imageValue ? resolveMetadataImageUri(imageValue, response.url || url) : undefined;
      const description = normalizeMetadataValue(parsed.description);
      const name = normalizeMetadataValue(parsed.name);
      const attributes = extractTokenAttributes(parsed);

      if (image || description || name || attributes?.length) {
        return { image, description, name, attributes };
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

  const metadata = await fetchImageOrMetadata(getContractMetadataCandidateUrls(metadataUri));
  if (!metadata) return null;
  return {
    image: metadata.image,
    description: metadata.description,
  };
}

export async function fetchTokenDisplayMetadata(
  rawTokenUri: string,
  options: TokenMetadataResolveOptions = {},
): Promise<TokenDisplayMetadata | null> {
  return fetchImageOrMetadata(getTokenMetadataCandidateUrls(rawTokenUri, options));
}

export async function fetchTokenDisplayImage(
  rawTokenUri: string,
  options: TokenMetadataResolveOptions = {},
): Promise<string | undefined> {
  const metadata = await fetchTokenDisplayMetadata(rawTokenUri, options);
  return metadata?.image;
}

export async function resolveCollectionDisplayMetadata(options: {
  contractUri?: string;
  baseUri?: string;
  collectionAddress?: Address;
  totalMinted?: bigint;
  publicClient?: PublicClient;
}): Promise<CollectionDisplayMetadata | null> {
  const {
    contractUri = '',
    baseUri = '',
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

  let resolvedBaseUri = baseUri;
  if (!resolvedBaseUri.trim()) {
    try {
      const onchainBaseUri = await publicClient.readContract({
        abi: NFTCollectionContract,
        address: collectionAddress,
        functionName: 'baseURI',
      });
      resolvedBaseUri = typeof onchainBaseUri === 'string' ? onchainBaseUri : '';
    } catch {
      resolvedBaseUri = '';
    }
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

      const tokenMetadata = await fetchTokenDisplayMetadata(tokenUri, {
        baseUri: resolvedBaseUri,
        tokenId,
      });
      const image = tokenMetadata?.image;
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
