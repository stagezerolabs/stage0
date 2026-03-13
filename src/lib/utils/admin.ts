/**
 * Admin utility functions for authentication and authorization.
 * Admin access defaults to the PresaleFactory owner, while NFT factory helpers
 * can be targeted explicitly where needed.
 */

import { NFTFactory, PresaleFactory } from '@/config';
import { useChainContracts } from '@/lib/hooks/useChainContracts';
import { useReadContract } from 'wagmi';
import type { Abi, Address } from 'viem';

type FactoryTarget = 'presale' | 'nft';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const REFRESH_INTERVAL_MS = 30000;

function isConfigured(address: Address | undefined) {
  return Boolean(address) && address !== ZERO_ADDRESS;
}

function useFactoryConfig(target: FactoryTarget) {
  const { presaleFactory, nftFactory } = useChainContracts();

  if (target === 'nft') {
    return {
      address: nftFactory,
      abi: NFTFactory as Abi,
    };
  }

  return {
    address: presaleFactory,
    abi: PresaleFactory as Abi,
  };
}

/**
 * Hook to get the factory owner address.
 */
export function useFactoryOwner(target: FactoryTarget = 'presale') {
  const { address, abi } = useFactoryConfig(target);
  const { data: factoryOwner, isLoading, refetch } = useReadContract({
    address,
    abi,
    functionName: 'factoryOwner',
    query: {
      enabled: isConfigured(address),
      refetchInterval: REFRESH_INTERVAL_MS,
    },
  });

  return {
    factoryOwner: factoryOwner as Address | undefined,
    isLoading,
    refetch,
  };
}

/**
 * Hook to get the fee recipient address.
 */
export function useFeeRecipient(target: FactoryTarget = 'presale') {
  const { address, abi } = useFactoryConfig(target);
  const { data: feeRecipient, isLoading, refetch } = useReadContract({
    address,
    abi,
    functionName: 'feeRecipient',
    query: {
      enabled: isConfigured(address),
      refetchInterval: REFRESH_INTERVAL_MS,
    },
  });

  return {
    feeRecipient: feeRecipient as Address | undefined,
    isLoading,
    refetch,
  };
}

/**
 * Hook to get the NFT factory default proceeds fee in basis points.
 */
export function useProceedsFeeBps() {
  const { nftFactory } = useChainContracts();
  const { data: proceedsFeeBps, isLoading, refetch } = useReadContract({
    address: nftFactory,
    abi: NFTFactory,
    functionName: 'proceedsFeeBps',
    query: {
      enabled: isConfigured(nftFactory),
      refetchInterval: REFRESH_INTERVAL_MS,
    },
  });

  return {
    proceedsFeeBps: proceedsFeeBps as bigint | undefined,
    isLoading,
    refetch,
  };
}

/**
 * Hook to check if the current user is an admin (factory owner).
 */
export function useIsAdmin(address: Address | undefined, target: FactoryTarget = 'presale') {
  const { factoryOwner, isLoading } = useFactoryOwner(target);

  const isAdmin = Boolean(
    address &&
    factoryOwner &&
    address.toLowerCase() === factoryOwner.toLowerCase()
  );

  return {
    isAdmin,
    isLoading,
    factoryOwner,
  };
}

/**
 * Hook to check if the current user is the fee recipient.
 */
export function useIsFeeRecipient(address: Address | undefined, target: FactoryTarget = 'presale') {
  const { feeRecipient, isLoading } = useFeeRecipient(target);

  const isFeeRecipient = Boolean(
    address &&
    feeRecipient &&
    address.toLowerCase() === feeRecipient.toLowerCase()
  );

  return {
    isFeeRecipient,
    isLoading,
    feeRecipient,
  };
}

/**
 * Legacy function for backward compatibility - now always returns false.
 * Use useIsAdmin hook instead for proper on-chain verification.
 * @deprecated Use useIsAdmin hook instead
 */
export function isAdmin(_address: string | undefined): boolean {
  console.warn('isAdmin() is deprecated. Use useIsAdmin() hook for on-chain verification.');
  return false;
}

/**
 * Legacy function - deprecated.
 * @deprecated Use useIsAdmin hook instead
 */
export function useIsAdminLegacy(_address: string | undefined): boolean {
  return isAdmin(_address);
}

/**
 * Legacy function - deprecated.
 * @deprecated Admin check now happens on-chain
 */
export function requireAdmin(_address: string | undefined): void {
  console.warn('requireAdmin() is deprecated. Use on-chain admin verification instead.');
  throw new Error('Unauthorized: Admin access requires on-chain verification');
}

/**
 * Legacy function - deprecated.
 * @deprecated Admin addresses are now determined by factoryOwner on-chain
 */
export function getAdminAddresses(): string[] {
  console.warn('getAdminAddresses() is deprecated. Use useFactoryOwner() hook instead.');
  return [];
}
