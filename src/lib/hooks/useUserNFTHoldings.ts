import { useMemo } from 'react';
import { type Address } from 'viem';
import { useReadContracts } from 'wagmi';
import { NFTCollectionContract } from '@/config';
import { useNFTDeployments, type NFTDeploymentWithMetadata } from '@/lib/hooks/useNFTDeployments';

export type UserNFTHolding = NFTDeploymentWithMetadata & {
  ownedCount: bigint;
  mintedCount: bigint;
};

function readBigintResult(entry: unknown): bigint | undefined {
  if (!entry || typeof entry !== 'object') return undefined;

  const maybe = entry as { status?: string; result?: unknown };
  if (maybe.status && maybe.status !== 'success') return undefined;
  if (typeof maybe.result === 'bigint') return maybe.result;
  return undefined;
}

export function useUserNFTHoldings(userAddress?: Address, enabled = true) {
  const canRead = Boolean(enabled && userAddress);

  const { deployments, isLoading: isDeploymentsLoading } = useNFTDeployments({
    enabled: canRead,
  });

  const holdingQueries = useMemo(() => {
    if (!userAddress || deployments.length === 0) return [];

    return deployments.flatMap((deployment) => [
      {
        abi: NFTCollectionContract,
        address: deployment.address,
        functionName: 'balanceOf',
        args: [userAddress],
      },
      {
        abi: NFTCollectionContract,
        address: deployment.address,
        functionName: 'mintedBy',
        args: [userAddress],
      },
      {
        abi: NFTCollectionContract,
        address: deployment.address,
        functionName: 'mintedPerWallet',
        args: [userAddress],
      },
    ] as const);
  }, [deployments, userAddress]);

  const { data: holdingResults, isLoading: isHoldingsLoading } = useReadContracts({
    contracts: holdingQueries as readonly any[],
    query: {
      enabled: holdingQueries.length > 0,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const holdings = useMemo((): UserNFTHolding[] => {
    if (!userAddress || deployments.length === 0) return [];

    return deployments
      .map((deployment, index) => {
        const base = index * 3;
        const ownedCount = readBigintResult(holdingResults?.[base]) ?? 0n;
        const mintedViaOldName = readBigintResult(holdingResults?.[base + 1]);
        const mintedViaNewName = readBigintResult(holdingResults?.[base + 2]);
        const mintedCount = mintedViaOldName ?? mintedViaNewName ?? ownedCount;

        return {
          ...deployment,
          ownedCount,
          mintedCount,
        };
      })
      .filter((holding) => holding.ownedCount > 0n || holding.mintedCount > 0n);
  }, [userAddress, deployments, holdingResults]);

  const totalOwned = useMemo(
    () => holdings.reduce((sum, holding) => sum + holding.ownedCount, 0n),
    [holdings]
  );

  const totalMinted = useMemo(
    () => holdings.reduce((sum, holding) => sum + holding.mintedCount, 0n),
    [holdings]
  );

  return {
    holdings,
    totalOwned,
    totalMinted,
    isLoading:
      isDeploymentsLoading ||
      (holdingQueries.length > 0 && isHoldingsLoading),
  };
}
