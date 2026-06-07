import { fetchRnsIndexedDomainsForOwner } from '@/lib/api/rns';
import type { IndexedRnsDomain } from '@/lib/indexer/rns-goldsky';
import { RNS_QUERY_GC_TIME, RNS_QUERY_STALE_TIME } from '@/lib/rns/constants';
import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';

type QueryOptions = {
  enabled?: boolean;
};

export function useRnsApiDomainsForOwner(
  owner: Address | undefined,
  chainId: number,
  options: QueryOptions = {},
) {
  const enabled = (options.enabled ?? true) && Boolean(owner);

  return useQuery<IndexedRnsDomain[]>({
    queryKey: ['rns', 'api', 'domains', 'owner', chainId, owner],
    queryFn: () => fetchRnsIndexedDomainsForOwner(owner!, chainId),
    enabled,
    staleTime: RNS_QUERY_STALE_TIME,
    gcTime: RNS_QUERY_GC_TIME,
  });
}
