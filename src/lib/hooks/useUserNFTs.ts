import { useReadContract } from 'wagmi';
import type { Address } from 'viem';
import { NFTFactoryLens } from '@/config';
import { useChainContracts } from '@/lib/hooks/useChainContracts';
import { useAccount } from 'wagmi';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const AUTO_REFRESH_INTERVAL = 10000;

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
  const totalDeployments = BigInt(((allCollectionsData as unknown[] | undefined) ?? []).length);

  const refetch = async () => {
    await Promise.all([refetchUserNFTs(), refetchTotalDeployments()]);
  };

  return {
    nfts,
    totalDeployments,
    isUserNFTsLoading,
    isTotalDeploymentsLoading,
    isLoading: isUserNFTsLoading || isTotalDeploymentsLoading,
    refetch,
  };
}
