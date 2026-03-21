import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { getAddress, type Address } from 'viem';
import { NFTFactoryLens } from '@/config';
import { useChainContracts } from '@/lib/hooks/useChainContracts';
import {
  contractUriToHttp,
  getContractMetadataCandidateUrls,
  ipfsUriToHttp,
  normalizeContractURI,
} from '@/lib/utils/ipfs';
import {
  getNFTSalePhase,
  getNFTSaleStatus,
  type NFTSalePhase,
  type NFTSaleStatus,
} from '@/lib/utils/nft-sales';
import {
  fetchIndexedNftCollections,
  isGoldskyIndexerConfigured,
  type IndexedNftCollection,
} from '@/lib/indexer/goldsky';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const AUTO_REFRESH_INTERVAL = 20000;
const QUERY_STALE_TIME = 15000;
const QUERY_GC_TIME = 5 * 60 * 1000;

type NFTContractMetadata = {
  image?: string;
  description?: string;
};

const deploymentMetadataCache = new Map<string, NFTContractMetadata | null>();

export interface NFTDeploymentWithMetadata {
  address: Address;
  creator: Address;
  owner: Address;
  payoutWallet: Address;
  feeRecipient?: Address;
  proceedsFeeBps?: bigint;
  is721A: boolean;
  name: string;
  symbol: string;
  contractURI: string;
  maxSupply: bigint;
  totalMinted: bigint;
  remaining: bigint;
  mintPrice: bigint;
  walletLimit: number;
  saleStart: bigint;
  saleEnd: bigint;
  whitelistEnabled: boolean;
  whitelistStart: bigint;
  whitelistPrice: bigint;
  salePhase: NFTSalePhase;
  status: NFTSaleStatus;
  metadataImage?: string;
  metadataDescription?: string;
}

type UseNFTDeploymentsOptions = {
  creator?: Address;
  enabled?: boolean;
};

interface CollectionInfo {
  nft: Address;
  creator: Address;
  is721A: boolean;
  name: string;
  symbol: string;
  contractURI: string;
  maxSupply: bigint;
  totalMinted: bigint;
  remaining: bigint;
  mintPrice: bigint;
  walletLimit: number;
  saleStart: bigint;
  saleEnd: bigint;
  whitelistEnabled: boolean;
  whitelistStart: bigint;
  whitelistPrice: bigint;
  owner: Address;
  payoutWallet: Address;
  feeRecipient: Address;
  proceedsFeeBps: bigint;
}

type RawCollectionInfo = Partial<CollectionInfo> & {
  [key: number]: unknown;
};

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

function toDeployment(info: CollectionInfo): NFTDeploymentWithMetadata {
  const salePhase = getNFTSalePhase({
    maxSupply: info.maxSupply,
    totalMinted: info.totalMinted,
    saleStart: info.saleStart,
    saleEnd: info.saleEnd,
    whitelistEnabled: info.whitelistEnabled,
    whitelistStart: info.whitelistStart,
  });

  return {
    address: info.nft,
    creator: info.creator,
    owner: info.owner,
    payoutWallet: info.payoutWallet,
    feeRecipient: info.feeRecipient,
    proceedsFeeBps: info.proceedsFeeBps,
    is721A: info.is721A,
    name: info.name || 'NFT Collection',
    symbol: info.symbol || 'NFT',
    contractURI: normalizeContractURI(info.contractURI || ''),
    maxSupply: info.maxSupply,
    totalMinted: info.totalMinted,
    remaining: info.remaining,
    mintPrice: info.mintPrice,
    walletLimit: Number(info.walletLimit),
    saleStart: info.saleStart,
    saleEnd: info.saleEnd,
    whitelistEnabled: info.whitelistEnabled,
    whitelistStart: info.whitelistStart,
    whitelistPrice: info.whitelistPrice,
    salePhase,
    status: getNFTSaleStatus({
      maxSupply: info.maxSupply,
      totalMinted: info.totalMinted,
      saleStart: info.saleStart,
      saleEnd: info.saleEnd,
      whitelistEnabled: info.whitelistEnabled,
      whitelistStart: info.whitelistStart,
    }),
  };
}

function normalizeCollectionInfo(raw: RawCollectionInfo): CollectionInfo | null {
  const nft = (raw.nft ?? raw[0]) as Address | undefined;
  const creator = (raw.creator ?? raw[1]) as Address | undefined;
  const is721A = (raw.is721A ?? raw[2]) as boolean | undefined;
  const name = (raw.name ?? raw[3]) as string | undefined;
  const symbol = (raw.symbol ?? raw[4]) as string | undefined;
  const contractURI = (raw.contractURI ?? raw[5]) as string | undefined;
  const maxSupply = (raw.maxSupply ?? raw[6]) as bigint | undefined;
  const totalMinted = (raw.totalMinted ?? raw[7]) as bigint | undefined;
  const remaining = (raw.remaining ?? raw[8]) as bigint | undefined;
  const mintPrice = (raw.mintPrice ?? raw[9]) as bigint | undefined;
  const walletLimitRaw = (raw.walletLimit ?? raw[10]) as bigint | number | undefined;
  const saleStart = (raw.saleStart ?? raw[11]) as bigint | undefined;
  const saleEnd = (raw.saleEnd ?? raw[12]) as bigint | undefined;
  const whitelistEnabled = (raw.whitelistEnabled ?? raw[13]) as boolean | undefined;
  const whitelistStart = (raw.whitelistStart ?? raw[14]) as bigint | undefined;
  const whitelistPrice = (raw.whitelistPrice ?? raw[15]) as bigint | undefined;
  const owner = (raw.owner ?? raw[16]) as Address | undefined;
  const payoutWallet = (raw.payoutWallet ?? raw[17]) as Address | undefined;
  const feeRecipient = (raw.feeRecipient ?? raw[18]) as Address | undefined;
  const proceedsFeeBps = (raw.proceedsFeeBps ?? raw[19]) as bigint | undefined;

  if (
    !nft ||
    !creator ||
    typeof is721A !== 'boolean' ||
    typeof name !== 'string' ||
    typeof symbol !== 'string' ||
    typeof contractURI !== 'string' ||
    maxSupply === undefined ||
    totalMinted === undefined ||
    remaining === undefined ||
    mintPrice === undefined ||
    walletLimitRaw === undefined ||
    saleStart === undefined ||
    saleEnd === undefined ||
    typeof whitelistEnabled !== 'boolean' ||
    whitelistStart === undefined ||
    whitelistPrice === undefined ||
    !owner ||
    !payoutWallet ||
    !feeRecipient ||
    proceedsFeeBps === undefined
  ) {
    return null;
  }

  return {
    nft,
    creator,
    is721A,
    name,
    symbol,
    contractURI,
    maxSupply,
    totalMinted,
    remaining,
    mintPrice,
    walletLimit: Number(walletLimitRaw),
    saleStart,
    saleEnd,
    whitelistEnabled,
    whitelistStart,
    whitelistPrice,
    owner,
    payoutWallet,
    feeRecipient,
    proceedsFeeBps,
  };
}

function toIndexedDeployment(deployment: IndexedNftCollection): NFTDeploymentWithMetadata {
  const whitelistEnabled = deployment.whitelistEnabled ?? false;
  const whitelistStart = deployment.whitelistStart ?? 0n;
  const whitelistPrice = deployment.whitelistPrice ?? deployment.mintPrice;

  const salePhase = getNFTSalePhase({
    maxSupply: deployment.maxSupply,
    totalMinted: deployment.totalMinted,
    saleStart: deployment.saleStart,
    saleEnd: deployment.saleEnd,
    whitelistEnabled,
    whitelistStart,
  });

  return {
    address: deployment.address,
    creator: deployment.creator,
    owner: deployment.owner,
    payoutWallet: deployment.payoutWallet,
    is721A: deployment.is721A,
    name: deployment.name || 'NFT Collection',
    symbol: deployment.symbol || 'NFT',
    contractURI: normalizeContractURI(deployment.contractURI || ''),
    maxSupply: deployment.maxSupply,
    totalMinted: deployment.totalMinted,
    remaining: deployment.remaining,
    mintPrice: deployment.mintPrice,
    walletLimit: Number(deployment.walletLimit),
    saleStart: deployment.saleStart,
    saleEnd: deployment.saleEnd,
    whitelistEnabled,
    whitelistStart,
    whitelistPrice,
    salePhase,
    status: getNFTSaleStatus({
      maxSupply: deployment.maxSupply,
      totalMinted: deployment.totalMinted,
      saleStart: deployment.saleStart,
      saleEnd: deployment.saleEnd,
      whitelistEnabled,
      whitelistStart,
    }),
  };
}

export function useNFTDeployments(options: UseNFTDeploymentsOptions = {}) {
  const { creator, enabled = true } = options;
  const { nftFactoryLens } = useChainContracts();
  const publicClient = usePublicClient();
  const [metadataByAddress, setMetadataByAddress] = useState<Record<string, NFTContractMetadata | null>>(() =>
    Object.fromEntries(deploymentMetadataCache.entries())
  );
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);

  // Normalize lens address to checksum format. Lowercasing first avoids
  // throwing on mixed-case, non-checksummed input while preserving bytes.
  const lensAddress = useMemo(() => {
    if (!nftFactoryLens || nftFactoryLens === ZERO_ADDRESS) return undefined;
    try {
      return getAddress(nftFactoryLens.toLowerCase() as Address);
    } catch (error) {
      console.error('[useNFTDeployments] Invalid lens address in config:', nftFactoryLens, error);
      return undefined;
    }
  }, [nftFactoryLens]);

  const hasLens = Boolean(lensAddress);
  const canRead = Boolean(enabled);
  const isIndexerConfigured = isGoldskyIndexerConfigured();
  const canReadFromChain = Boolean(canRead && hasLens && publicClient);

  // ── On-chain reads via NFTFactoryLens (always preferred) ──────────────
  // Uses viem publicClient.readContract directly for reliability.
  const {
    data: chainRaw,
    isLoading: isChainLoading,
    error: chainError,
  } = useQuery({
    queryKey: ['nft-lens', creator?.toLowerCase() ?? 'all', lensAddress],
    queryFn: async (): Promise<RawCollectionInfo[]> => {
      if (!publicClient || !lensAddress) return [];

      if (creator) {
        const result = await publicClient.readContract({
          abi: NFTFactoryLens,
          address: lensAddress,
          functionName: 'getCollectionsByCreator',
          args: [creator],
        });
        return result as unknown as RawCollectionInfo[];
      }

      const result = await publicClient.readContract({
        abi: NFTFactoryLens,
        address: lensAddress,
        functionName: 'getAllCollections',
        args: [0n, 0n],
      });
      return result as unknown as RawCollectionInfo[];
    },
    enabled: canReadFromChain,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    refetchInterval: canReadFromChain ? AUTO_REFRESH_INTERVAL : false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
  });

  useEffect(() => {
    if (chainError) {
      console.error('[useNFTDeployments] Lens call failed:', chainError);
    }
  }, [chainError]);

  // ── Goldsky indexer fallback ───────────────────────────────────────────
  // Prefer lens data whenever available. Use indexer only if lens cannot
  // be read (missing/invalid lens or read error).
  const shouldFallbackToIndexer = Boolean(
    canRead &&
    isIndexerConfigured &&
    (!canReadFromChain || Boolean(chainError))
  );

  const {
    data: indexedCollections = [],
    isLoading: isIndexerLoading,
    isError: isIndexerError,
  } = useQuery({
    queryKey: ['goldsky', 'nftCollections', creator?.toLowerCase() ?? 'all'],
    queryFn: () => fetchIndexedNftCollections(creator),
    enabled: shouldFallbackToIndexer,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    refetchInterval: shouldFallbackToIndexer ? AUTO_REFRESH_INTERVAL : false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const hasLensData = Boolean(chainRaw && chainRaw.length > 0);
  const useIndexer = Boolean(
    !hasLensData &&
    shouldFallbackToIndexer &&
    !isIndexerError &&
    (isIndexerLoading || indexedCollections.length > 0)
  );

  const indexedDeployments = useMemo((): NFTDeploymentWithMetadata[] => {
    if (!useIndexer) return [];
    return indexedCollections.map(toIndexedDeployment);
  }, [indexedCollections, useIndexer]);

  const rawDeployments = useMemo((): NFTDeploymentWithMetadata[] => {
    if (useIndexer) {
      return indexedDeployments;
    }

    if (!chainRaw || chainRaw.length === 0) return [];

    return [...chainRaw]
      .reverse()
      .map(normalizeCollectionInfo)
      .filter((entry): entry is CollectionInfo => entry !== null)
      .map(toDeployment);
  }, [chainRaw, indexedDeployments, useIndexer]);

  useEffect(() => {
    const pending = rawDeployments.filter((deployment) => {
      const key = deployment.address.toLowerCase();
      const cachedMetadata = metadataByAddress[key] ?? deploymentMetadataCache.get(key);
      return deployment.contractURI.trim().length > 0 && cachedMetadata === undefined;
    });

    if (pending.length === 0) {
      setIsMetadataLoading(false);
      return;
    }

    let cancelled = false;
    setIsMetadataLoading(true);

    (async () => {
      const results = await Promise.all(
        pending.map(async (deployment) => {
          const key = deployment.address.toLowerCase();
          try {
            const metadataUri = normalizeContractURI(deployment.contractURI);
            if (!metadataUri) return [key, null] as const;

            const candidateUrls = getContractMetadataCandidateUrls(metadataUri);
            if (candidateUrls.length === 0) return [key, null] as const;

            let json: Record<string, unknown> | null = null;
            let resolvedMetadataUri = metadataUri;

            for (const url of candidateUrls) {
              try {
                const response = await fetch(url);
                if (!response.ok) continue;
                const text = await response.text();
                const parsed = JSON.parse(text) as Record<string, unknown>;
                json = parsed;
                resolvedMetadataUri = url;
                break;
              } catch {
                continue;
              }
            }

            if (!json) return [key, null] as const;

            const image =
              typeof json.image === 'string' && json.image.trim().length > 0
                ? resolveMetadataImageUri(json.image, resolvedMetadataUri)
                : undefined;
            const description =
              typeof json.description === 'string' && json.description.trim().length > 0
                ? json.description.trim()
                : undefined;

            return [key, { image, description } as NFTContractMetadata | null] as const;
          } catch {
            return [key, null] as const;
          }
        })
      );

      if (cancelled) return;

      setMetadataByAddress((previous) => {
        const next = { ...previous };
        for (const [key, value] of results) {
          deploymentMetadataCache.set(key, value);
          next[key] = value;
        }
        return next;
      });
      setIsMetadataLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setIsMetadataLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [rawDeployments, metadataByAddress]);

  const deployments = useMemo((): NFTDeploymentWithMetadata[] => {
    return rawDeployments.map((deployment) => {
      const addressKey = deployment.address.toLowerCase();
      const metadata = metadataByAddress[addressKey] ?? deploymentMetadataCache.get(addressKey);
      return {
        ...deployment,
        metadataImage: metadata?.image,
        metadataDescription: metadata?.description,
      };
    });
  }, [rawDeployments, metadataByAddress]);

  const isLoading = useIndexer ? isIndexerLoading : isChainLoading;

  return {
    deployments,
    totalDeployments: deployments.length,
    isLoading,
    isLogsLoading: isLoading,
    isMetadataLoading,
  };
}
