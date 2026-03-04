import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { type Address } from 'viem';
import { NFTFactoryLens } from '@/config';
import { useChainContracts } from '@/lib/hooks/useChainContracts';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const AUTO_REFRESH_INTERVAL = 10000;

export type NFTDeploymentStatus = 'live' | 'upcoming' | 'ended';

export interface NFTDeploymentWithMetadata {
  address: Address;
  creator: Address;
  owner: Address;
  payoutWallet: Address;
  is721A: boolean;
  name: string;
  symbol: string;
  maxSupply: bigint;
  totalMinted: bigint;
  remaining: bigint;
  mintPrice: bigint;
  walletLimit: number;
  saleStart: bigint;
  saleEnd: bigint;
  status: NFTDeploymentStatus;
}

type UseNFTDeploymentsOptions = {
  creator?: Address;
  enabled?: boolean;
};

// Raw CollectionInfo tuple returned by the Lens
interface CollectionInfo {
  nft: Address;
  creator: Address;
  is721A: boolean;
  name: string;
  symbol: string;
  maxSupply: bigint;
  totalMinted: bigint;
  remaining: bigint;
  mintPrice: bigint;
  walletLimit: number;
  saleStart: bigint;
  saleEnd: bigint;
  owner: Address;
  payoutWallet: Address;
}

type RawCollectionInfo = Partial<CollectionInfo> & {
  [key: number]: unknown;
};

function getNFTStatus(
  saleStart: bigint,
  saleEnd: bigint,
  totalMinted: bigint,
  maxSupply: bigint
): NFTDeploymentStatus {
  if (maxSupply > 0n && totalMinted >= maxSupply) return 'ended';
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (saleStart > now) return 'upcoming';
  if (saleEnd !== 0n && saleEnd <= now) return 'ended';
  return 'live';
}

function toDeployment(info: CollectionInfo): NFTDeploymentWithMetadata {
  return {
    address: info.nft,
    creator: info.creator,
    owner: info.owner,
    payoutWallet: info.payoutWallet,
    is721A: info.is721A,
    name: info.name || 'NFT Collection',
    symbol: info.symbol || 'NFT',
    maxSupply: info.maxSupply,
    totalMinted: info.totalMinted,
    remaining: info.remaining,
    mintPrice: info.mintPrice,
    walletLimit: Number(info.walletLimit),
    saleStart: info.saleStart,
    saleEnd: info.saleEnd,
    status: getNFTStatus(info.saleStart, info.saleEnd, info.totalMinted, info.maxSupply),
  };
}

function normalizeCollectionInfo(raw: RawCollectionInfo): CollectionInfo | null {
  const nft = (raw.nft ?? raw[0]) as Address | undefined;
  const creator = (raw.creator ?? raw[1]) as Address | undefined;
  const is721A = (raw.is721A ?? raw[2]) as boolean | undefined;
  const name = (raw.name ?? raw[3]) as string | undefined;
  const symbol = (raw.symbol ?? raw[4]) as string | undefined;
  const maxSupply = (raw.maxSupply ?? raw[5]) as bigint | undefined;
  const totalMinted = (raw.totalMinted ?? raw[6]) as bigint | undefined;
  const remaining = (raw.remaining ?? raw[7]) as bigint | undefined;
  const mintPrice = (raw.mintPrice ?? raw[8]) as bigint | undefined;
  const walletLimitRaw = (raw.walletLimit ?? raw[9]) as bigint | number | undefined;
  const saleStart = (raw.saleStart ?? raw[10]) as bigint | undefined;
  const saleEnd = (raw.saleEnd ?? raw[11]) as bigint | undefined;
  const owner = (raw.owner ?? raw[12]) as Address | undefined;
  const payoutWallet = (raw.payoutWallet ?? raw[13]) as Address | undefined;

  if (
    !nft ||
    !creator ||
    typeof is721A !== 'boolean' ||
    typeof name !== 'string' ||
    typeof symbol !== 'string' ||
    maxSupply === undefined ||
    totalMinted === undefined ||
    remaining === undefined ||
    mintPrice === undefined ||
    walletLimitRaw === undefined ||
    saleStart === undefined ||
    saleEnd === undefined ||
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
    maxSupply,
    totalMinted,
    remaining,
    mintPrice,
    walletLimit: Number(walletLimitRaw),
    saleStart,
    saleEnd,
    owner,
    payoutWallet,
  };
}

export function useNFTDeployments(options: UseNFTDeploymentsOptions = {}) {
  const { creator, enabled = true } = options;
  const { nftFactoryLens } = useChainContracts();

  const hasLens = Boolean(nftFactoryLens && nftFactoryLens !== ZERO_ADDRESS);
  const canRead = Boolean(enabled && hasLens);

  // When a creator is specified use the targeted lens call
  const { data: creatorData, isLoading: isCreatorLoading } = useReadContract({
    abi: NFTFactoryLens,
    address: nftFactoryLens,
    functionName: 'getCollectionsByCreator',
    args: creator ? [creator] : undefined,
    query: {
      enabled: canRead && Boolean(creator),
      refetchInterval: canRead && Boolean(creator) ? AUTO_REFRESH_INTERVAL : false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  // When no creator filter, fetch all collections (offset=0, limit=0 → all)
  const { data: allData, isLoading: isAllLoading } = useReadContract({
    abi: NFTFactoryLens,
    address: nftFactoryLens,
    functionName: 'getAllCollections',
    args: [0n, 0n],
    query: {
      enabled: canRead && !creator,
      refetchInterval: canRead && !creator ? AUTO_REFRESH_INTERVAL : false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const deployments = useMemo((): NFTDeploymentWithMetadata[] => {
    const raw = (creator ? creatorData : allData) as RawCollectionInfo[] | undefined;
    if (!raw || raw.length === 0) return [];
    // Newest first — the factory appends, so reverse gives newest-first
    return [...raw]
      .reverse()
      .map(normalizeCollectionInfo)
      .filter((entry): entry is CollectionInfo => entry !== null)
      .map(toDeployment);
  }, [creator, creatorData, allData]);

  return {
    deployments,
    totalDeployments: deployments.length,
    isLoading: creator ? isCreatorLoading : isAllLoading,
    isLogsLoading: creator ? isCreatorLoading : isAllLoading,
    isMetadataLoading: false,
  };
}
