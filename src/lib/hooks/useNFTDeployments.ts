import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReadContract } from 'wagmi';
import { type Address } from 'viem';
import { NFTFactoryLens } from '@/config';
import { useChainContracts } from '@/lib/hooks/useChainContracts';
import { contractUriToHttp, ipfsUriToHttp, normalizeContractURI } from '@/lib/utils/ipfs';
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
const AUTO_REFRESH_INTERVAL = 10000;

type NFTContractMetadata = {
  image?: string;
  description?: string;
};

export interface NFTDeploymentWithMetadata {
  address: Address;
  creator: Address;
  owner: Address;
  payoutWallet: Address;
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

  const metadataHttpUri = `${contractUriToHttp(metadataUri).replace(/\/+$/, '')}/`;
  try {
    return new URL(normalized, metadataHttpUri).toString();
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
    !payoutWallet
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
  const [metadataByAddress, setMetadataByAddress] = useState<Record<string, NFTContractMetadata | null>>({});
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);

  const hasLens = Boolean(nftFactoryLens && nftFactoryLens !== ZERO_ADDRESS);
  const canRead = Boolean(enabled);
  const isIndexerConfigured = isGoldskyIndexerConfigured();
  const canReadFromChain = Boolean(canRead && hasLens);
  const canReadFromIndexer = Boolean(canRead && !hasLens && isIndexerConfigured);

  const {
    data: indexedCollections = [],
    isLoading: isIndexerLoading,
    isError: isIndexerError,
  } = useQuery({
    queryKey: ['goldsky', 'nftCollections', creator?.toLowerCase() ?? 'all'],
    queryFn: () => fetchIndexedNftCollections(creator),
    enabled: canReadFromIndexer,
    staleTime: AUTO_REFRESH_INTERVAL,
    refetchInterval: canReadFromIndexer ? AUTO_REFRESH_INTERVAL : false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const useIndexer =
    canReadFromIndexer &&
    !isIndexerError &&
    (isIndexerLoading || indexedCollections.length > 0);

  const { data: creatorData, isLoading: isCreatorLoading } = useReadContract({
    abi: NFTFactoryLens,
    address: nftFactoryLens,
    functionName: 'getCollectionsByCreator',
    args: creator ? [creator] : undefined,
    query: {
      enabled: canReadFromChain && Boolean(creator),
      refetchInterval: canReadFromChain && Boolean(creator) ? AUTO_REFRESH_INTERVAL : false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const { data: allData, isLoading: isAllLoading } = useReadContract({
    abi: NFTFactoryLens,
    address: nftFactoryLens,
    functionName: 'getAllCollections',
    args: [0n, 0n],
    query: {
      enabled: canReadFromChain && !creator,
      refetchInterval: canReadFromChain && !creator ? AUTO_REFRESH_INTERVAL : false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const indexedDeployments = useMemo((): NFTDeploymentWithMetadata[] => {
    if (!useIndexer) return [];
    return indexedCollections.map(toIndexedDeployment);
  }, [indexedCollections, useIndexer]);

  const rawDeployments = useMemo((): NFTDeploymentWithMetadata[] => {
    if (useIndexer) {
      return indexedDeployments;
    }

    const raw = (creator ? creatorData : allData) as RawCollectionInfo[] | undefined;
    if (!raw || raw.length === 0) return [];

    return [...raw]
      .reverse()
      .map(normalizeCollectionInfo)
      .filter((entry): entry is CollectionInfo => entry !== null)
      .map(toDeployment);
  }, [allData, creator, creatorData, indexedDeployments, useIndexer]);

  useEffect(() => {
    const pending = rawDeployments.filter((deployment) => {
      const key = deployment.address.toLowerCase();
      return deployment.contractURI.trim().length > 0 && metadataByAddress[key] === undefined;
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

            const response = await fetch(contractUriToHttp(metadataUri));
            if (!response.ok) throw new Error(`Metadata fetch failed: ${response.status}`);

            const json = (await response.json()) as Record<string, unknown>;
            const image =
              typeof json.image === 'string' && json.image.trim().length > 0
                ? resolveMetadataImageUri(json.image, metadataUri)
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
      const metadata = metadataByAddress[deployment.address.toLowerCase()];
      return {
        ...deployment,
        metadataImage: metadata?.image,
        metadataDescription: metadata?.description,
      };
    });
  }, [rawDeployments, metadataByAddress]);

  const isChainLoading = canReadFromChain ? (creator ? isCreatorLoading : isAllLoading) : false;
  const isLoading = useIndexer ? isIndexerLoading : isChainLoading;

  return {
    deployments,
    totalDeployments: deployments.length,
    isLoading,
    isLogsLoading: isLoading,
    isMetadataLoading,
  };
}
