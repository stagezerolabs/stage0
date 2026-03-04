import { useEffect, useMemo } from 'react';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import type { Address } from 'viem';
import { TokenFactory } from '@/config';
import { useChainContracts } from '@/lib/hooks/useChainContracts';
import { useBlockchainStore } from '@/lib/store/blockchain-store';

const AUTO_REFRESH_INTERVAL = 10000;

export function useUserTokens(forceRefetch = false) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { tokenFactory } = useChainContracts();

  const {
    getUserTokens,
    setUserTokens,
    setUserTokensLoading,
    getImportedTokens,
  } = useBlockchainStore();

  const cachedTokens = address ? getUserTokens(address) : null;
  const importedTokens = address ? getImportedTokens(address, chainId) : [];
  const shouldFetch = Boolean(address && tokenFactory && tokenFactory !== '0x0000000000000000000000000000000000000000');

  const { data: tokens, isLoading, refetch } = useReadContract({
    abi: TokenFactory,
    address: tokenFactory,
    functionName: 'tokensCreatedBy',
    args: [address as `0x${string}`],
    query: {
      enabled: shouldFetch,
      refetchInterval: shouldFetch ? AUTO_REFRESH_INTERVAL : false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  useEffect(() => {
    if (address && isLoading) {
      setUserTokensLoading(address, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, isLoading]);

  useEffect(() => {
    if (address && tokens && !isLoading) {
      setUserTokens(address, tokens as `0x${string}`[]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, tokens, isLoading]);

  useEffect(() => {
    if (forceRefetch && address) {
      refetch();
    }
  }, [forceRefetch, address, refetch]);

  const handleRefetch = async () => {
    if (address) {
      setUserTokensLoading(address, true);
      await refetch();
    }
  };

  const contractTokens = tokens as unknown as Address[] | undefined;
  const factoryTokens = contractTokens && contractTokens.length > 0
    ? contractTokens
    : cachedTokens && cachedTokens.length > 0
    ? cachedTokens
    : contractTokens ?? cachedTokens ?? [];

  // Merge factory-created and imported tokens, deduplicating by lowercase address
  const allTokens = useMemo(() => {
    const seen = new Set<string>();
    const merged: Address[] = [];
    for (const t of factoryTokens) {
      const lower = t.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        merged.push(t);
      }
    }
    for (const t of importedTokens) {
      const lower = t.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        merged.push(t);
      }
    }
    return merged;
  }, [factoryTokens, importedTokens]);

  return {
    tokens: allTokens,
    factoryTokens,
    importedTokens,
    isLoading: address ? (isLoading && allTokens.length === 0) : false,
    refetch: handleRefetch,
  };
}
