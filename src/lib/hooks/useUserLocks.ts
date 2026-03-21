import { useCallback, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { TokenLocker } from '@/config';
import { useChainContracts } from '@/lib/hooks/useChainContracts';
import { useBlockchainStore } from '@/lib/store/blockchain-store';

const AUTO_REFRESH_INTERVAL = 20000;
const QUERY_STALE_TIME = 15000;
const QUERY_GC_TIME = 5 * 60 * 1000;

export function useUserLocks(forceRefetch = false) {
  const { address } = useAccount();
  const { tokenLocker } = useChainContracts();

  const {
    getUserLocks,
    setUserLocks,
    setUserLocksLoading,
  } = useBlockchainStore();

  const cachedLockIds = address ? getUserLocks(address) : null;
  const shouldFetch = Boolean(address);

  const { data: lockIds, isLoading, refetch } = useReadContract({
    abi: TokenLocker,
    address: tokenLocker,
    functionName: 'locksOfOwner',
    args: [address as `0x${string}`],
    query: {
      enabled: shouldFetch,
      staleTime: QUERY_STALE_TIME,
      gcTime: QUERY_GC_TIME,
      refetchInterval: shouldFetch ? AUTO_REFRESH_INTERVAL : false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  });

  useEffect(() => {
    if (address && isLoading) {
      setUserLocksLoading(address, true);
    }
  }, [address, isLoading, setUserLocksLoading]);

  useEffect(() => {
    if (address && lockIds && !isLoading) {
      setUserLocks(address, lockIds as unknown as bigint[]);
    }
  }, [address, lockIds, isLoading, setUserLocks]);

  useEffect(() => {
    if (forceRefetch && address) {
      refetch();
    }
  }, [forceRefetch, address, refetch]);

  const handleRefetch = useCallback(async () => {
    if (address) {
      setUserLocksLoading(address, true);
      await refetch();
    }
  }, [address, setUserLocksLoading, refetch]);

  return {
    lockIds: cachedLockIds || (lockIds as unknown as bigint[]) || [],
    isLoading: address ? isLoading : false,
    refetch: handleRefetch,
  };
}
