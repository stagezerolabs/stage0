import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useChainId, usePublicClient } from 'wagmi';
import { getAddress, type Address } from 'viem';
import { NFTFactoryLens } from '@/config';
import { useChainContracts } from '@/lib/hooks/useChainContracts';
import { useOffchainCollectionImages } from '@/lib/hooks/useOffchainProjectImages';
import {
  normalizeContractURI,
} from '@/lib/utils/ipfs';
import { resolveCollectionDisplayMetadata } from '@/lib/utils/nft-metadata';
import {
  getNFTSalePhase,
  getNFTSaleStatus,
  type NFTSalePhase,
  type NFTSaleStatus,
} from '@/lib/utils/nft-sales';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const AUTO_REFRESH_INTERVAL = 20000;
const QUERY_STALE_TIME = 15000;
const QUERY_GC_TIME = 5 * 60 * 1000;
const METADATA_CACHE_VERSION = 'v2';

type NFTContractMetadata = {
  image?: string;
  description?: string;
};

const deploymentMetadataCache = new Map<string, NFTContractMetadata | null>();
const deploymentMetadataInflight = new Set<string>();

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

function getMetadataCacheKey(deployment: NFTDeploymentWithMetadata): string {
  return [
    METADATA_CACHE_VERSION,
    deployment.address.toLowerCase(),
    deployment.contractURI,
    deployment.totalMinted.toString(),
  ].join(':');
}

export function useNFTDeployments(options: UseNFTDeploymentsOptions = {}) {
  const { creator, enabled = true } = options;
  const { nftFactoryLens } = useChainContracts();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [metadataByKey, setMetadataByKey] = useState<Record<string, NFTContractMetadata | null>>(() =>
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

  const rawDeployments = useMemo((): NFTDeploymentWithMetadata[] => {
    if (!chainRaw || chainRaw.length === 0) return [];

    return [...chainRaw]
      .reverse()
      .map(normalizeCollectionInfo)
      .filter((entry): entry is CollectionInfo => entry !== null)
      .map(toDeployment);
  }, [chainRaw]);

  const deploymentAddresses = useMemo(
    () => rawDeployments.map((deployment) => deployment.address),
    [rawDeployments],
  );

  const { data: offchainCollectionImages = {} } = useOffchainCollectionImages(
    chainId,
    deploymentAddresses,
    canRead,
  );

  useEffect(() => {
    const pending = rawDeployments.filter((deployment) => {
      const key = getMetadataCacheKey(deployment);
      const cachedMetadata = metadataByKey[key] ?? deploymentMetadataCache.get(key);
      return (
        !deploymentMetadataInflight.has(key) &&
        cachedMetadata === undefined &&
        (deployment.contractURI.trim().length > 0 || deployment.totalMinted > 0n)
      );
    });

    if (pending.length === 0) {
      setIsMetadataLoading(deploymentMetadataInflight.size > 0);
      return;
    }

    let cancelled = false;
    setIsMetadataLoading(true);

    pending.forEach((deployment) => {
      const key = getMetadataCacheKey(deployment);
      deploymentMetadataInflight.add(key);

      resolveCollectionDisplayMetadata({
        contractUri: deployment.contractURI,
        collectionAddress: deployment.address,
        totalMinted: deployment.totalMinted,
        publicClient,
      })
        .then((metadata) => (metadata as NFTContractMetadata | null) ?? null)
        .catch(() => null)
        .then((metadata) => {
          deploymentMetadataCache.set(key, metadata);
          if (cancelled) return;
          setMetadataByKey((previous) => ({
            ...previous,
            [key]: metadata,
          }));
        })
        .finally(() => {
          deploymentMetadataInflight.delete(key);
          if (!cancelled) {
            setIsMetadataLoading(deploymentMetadataInflight.size > 0);
          }
        });
      });

    return () => {
      cancelled = true;
    };
  }, [rawDeployments, metadataByKey, publicClient]);

  const deployments = useMemo((): NFTDeploymentWithMetadata[] => {
    return rawDeployments.map((deployment) => {
      const metadataKey = getMetadataCacheKey(deployment);
      const metadata = metadataByKey[metadataKey] ?? deploymentMetadataCache.get(metadataKey);
      const offchainImage = offchainCollectionImages[deployment.address.toLowerCase()];
      return {
        ...deployment,
        metadataImage: offchainImage?.imageUrl ?? metadata?.image,
        metadataDescription: metadata?.description,
      };
    });
  }, [rawDeployments, metadataByKey, offchainCollectionImages]);

  return {
    deployments,
    totalDeployments: deployments.length,
    isLoading: isChainLoading,
    isLogsLoading: isChainLoading,
    isMetadataLoading,
  };
}
