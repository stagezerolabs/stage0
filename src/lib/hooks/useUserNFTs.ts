import { useReadContract } from 'wagmi';
import type { Address } from 'viem';
import { NFTFactoryLens } from '@/config';
import { useChainContracts } from '@/lib/hooks/useChainContracts';
import { useAccount } from 'wagmi';
import { getNFTSaleStatus } from '@/lib/utils/nft-sales';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const AUTO_REFRESH_INTERVAL = 10000;

type RawCollectionInfo = {
  [key: number]: unknown;
  nft?: Address;
  maxSupply?: bigint;
  totalMinted?: bigint;
  mintPrice?: bigint;
  saleStart?: bigint;
  saleEnd?: bigint;
  whitelistEnabled?: boolean;
  whitelistStart?: bigint;
};

type ParsedCollectionMetrics = {
  address: Address;
  totalMinted: bigint;
  mintPrice: bigint;
  status: 'live' | 'upcoming' | 'ended';
};

function normalizeCollectionMetrics(raw: RawCollectionInfo): ParsedCollectionMetrics | null {
  const address = (raw.nft ?? raw[0]) as Address | undefined;
  const maxSupply = (raw.maxSupply ?? raw[6]) as bigint | undefined;
  const totalMinted = (raw.totalMinted ?? raw[7]) as bigint | undefined;
  const mintPrice = (raw.mintPrice ?? raw[9]) as bigint | undefined;
  const saleStart = (raw.saleStart ?? raw[11]) as bigint | undefined;
  const saleEnd = (raw.saleEnd ?? raw[12]) as bigint | undefined;
  const whitelistEnabled = (raw.whitelistEnabled ?? raw[13]) as boolean | undefined;
  const whitelistStart = (raw.whitelistStart ?? raw[14]) as bigint | undefined;

  if (
    !address ||
    maxSupply === undefined ||
    totalMinted === undefined ||
    mintPrice === undefined ||
    saleStart === undefined ||
    saleEnd === undefined ||
    whitelistEnabled === undefined ||
    whitelistStart === undefined
  ) {
    return null;
  }

  return {
    address,
    totalMinted,
    mintPrice,
    status: getNFTSaleStatus({
      maxSupply,
      totalMinted,
      saleStart,
      saleEnd,
      whitelistEnabled,
      whitelistStart,
    }),
  };
}

export function useUserNFTs() {
  const { address } = useAccount();
  const { nftFactoryLens } = useChainContracts();

  const hasLens = Boolean(nftFactoryLens && nftFactoryLens !== ZERO_ADDRESS);
  const canReadUserNFTs = Boolean(address && hasLens);

  // User's collections via Lens — returns full CollectionInfo[] in one call
  const {
    data: userCollectionsData,
    isLoading: isUserNFTsLoading,
    refetch: refetchUserNFTs,
  } = useReadContract({
    abi: NFTFactoryLens,
    address: nftFactoryLens,
    functionName: 'getCollectionsByCreator',
    args: address ? [address as Address] : undefined,
    query: {
      enabled: canReadUserNFTs,
      refetchInterval: canReadUserNFTs ? AUTO_REFRESH_INTERVAL : false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  // Total deployments from lens (offset=0, limit=0 => all)
  const {
    data: allCollectionsData,
    isLoading: isTotalDeploymentsLoading,
    refetch: refetchTotalDeployments,
  } = useReadContract({
    abi: NFTFactoryLens,
    address: nftFactoryLens,
    functionName: 'getAllCollections',
    args: [0n, 0n],
    query: {
      enabled: hasLens,
      refetchInterval: hasLens ? AUTO_REFRESH_INTERVAL : false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const getNftAddress = (item: unknown): Address | null => {
    if (!item || typeof item !== 'object') return null;
    const entry = item as { nft?: Address; 0?: unknown };
    return ((entry.nft ?? entry[0]) as Address | undefined) ?? null;
  };

  const nfts = ((userCollectionsData as unknown[] | undefined) ?? [])
    .map(getNftAddress)
    .filter((addr): addr is Address => Boolean(addr));
  const parsedCollections = (((allCollectionsData as unknown[] | undefined) ?? []) as RawCollectionInfo[])
    .map(normalizeCollectionMetrics)
    .filter((entry): entry is ParsedCollectionMetrics => entry !== null);

  const totalDeployments = BigInt(parsedCollections.length);
  const activeDeployments = parsedCollections.reduce((sum, collection) => (
    collection.status === 'live' || collection.status === 'upcoming' ? sum + 1 : sum
  ), 0);
  const estimatedEthRaised = parsedCollections.reduce(
    (sum, collection) => sum + (collection.totalMinted * collection.mintPrice),
    0n
  );

  const refetch = async () => {
    await Promise.all([refetchUserNFTs(), refetchTotalDeployments()]);
  };

  return {
    nfts,
    totalDeployments,
    activeDeployments,
    estimatedEthRaised,
    isUserNFTsLoading,
    isTotalDeploymentsLoading,
    isLoading: isUserNFTsLoading || isTotalDeploymentsLoading,
    refetch,
  };
}
