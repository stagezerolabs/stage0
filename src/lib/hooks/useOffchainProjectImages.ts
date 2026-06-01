import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import {
  fetchOffchainCollectionImages,
  fetchOffchainTokenImages,
  type OffchainProjectImageMap,
} from '@/lib/api/media';

const OFFCHAIN_IMAGE_STALE_TIME = 60_000;
const OFFCHAIN_IMAGE_GC_TIME = 5 * 60 * 1000;

function useOffchainImages(
  kind: 'collections' | 'tokens',
  chainId: number,
  addresses: Address[],
  enabled = true,
) {
  const addressKey = useMemo(() => {
    return Array.from(new Set(addresses.map((address) => address.toLowerCase()))).sort().join(',');
  }, [addresses]);

  const normalizedAddresses = useMemo(() => {
    return addressKey ? (addressKey.split(',') as Address[]) : [];
  }, [addressKey]);

  return useQuery<OffchainProjectImageMap>({
    queryKey: ['offchain-project-images', kind, chainId, addressKey],
    queryFn: () =>
      kind === 'collections'
        ? fetchOffchainCollectionImages(chainId, normalizedAddresses)
        : fetchOffchainTokenImages(chainId, normalizedAddresses),
    enabled: enabled && normalizedAddresses.length > 0,
    staleTime: OFFCHAIN_IMAGE_STALE_TIME,
    gcTime: OFFCHAIN_IMAGE_GC_TIME,
    refetchOnWindowFocus: false,
    retry: false,
    placeholderData: {},
  });
}

export function useOffchainCollectionImages(chainId: number, addresses: Address[], enabled = true) {
  return useOffchainImages('collections', chainId, addresses, enabled);
}

export function useOffchainTokenImages(chainId: number, addresses: Address[], enabled = true) {
  return useOffchainImages('tokens', chainId, addresses, enabled);
}
