import {
  fetchRnsNameResolution,
  fetchRnsPrimaryNameForAddress,
  resolveRnsAddressInput,
} from '@/lib/api/rns';
import {
  coerceAddress,
  formatRnsLookupName,
  normalizeRnsLookupName,
  shortAddress,
} from '@/lib/rns/address-resolution';
import { RNS_QUERY_GC_TIME, RNS_QUERY_STALE_TIME } from '@/lib/rns/constants';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Address } from 'viem';

export type RnsAddressInputStatus =
  | 'empty'
  | 'address'
  | 'resolving'
  | 'resolved'
  | 'not_found'
  | 'invalid'
  | 'error';

type UseRnsAddressInputOptions = {
  enabled?: boolean;
};

export function useRnsAddressInput(
  value: string,
  chainId: number,
  options: UseRnsAddressInputOptions = {},
) {
  const input = value.trim();
  const enabled = options.enabled ?? true;
  const directAddress = coerceAddress(input);
  const lookupLabel = normalizeRnsLookupName(input);

  const nameQuery = useQuery({
    queryKey: ['rns', 'api', 'resolve-name', chainId, lookupLabel],
    queryFn: () => fetchRnsNameResolution({ name: lookupLabel!, chainId }),
    enabled: enabled && Boolean(lookupLabel) && !directAddress,
    staleTime: RNS_QUERY_STALE_TIME,
    gcTime: RNS_QUERY_GC_TIME,
    retry: 1,
  });

  const reverseQuery = useQuery({
    queryKey: ['rns', 'api', 'resolve-address', chainId, directAddress],
    queryFn: () => fetchRnsPrimaryNameForAddress({ address: directAddress!, chainId }),
    enabled: enabled && Boolean(directAddress),
    staleTime: RNS_QUERY_STALE_TIME,
    gcTime: RNS_QUERY_GC_TIME,
    retry: 1,
  });

  return useMemo(() => {
    if (!input) {
      return {
        input,
        address: null as Address | null,
        lookupName: null as string | null,
        displayName: null as string | null,
        status: 'empty' as RnsAddressInputStatus,
        isLoading: false,
        message: '',
      };
    }

    if (directAddress) {
      const primaryName = reverseQuery.data?.primaryName ?? null;
      return {
        input,
        address: directAddress,
        lookupName: null,
        displayName: primaryName,
        status: 'address' as RnsAddressInputStatus,
        isLoading: reverseQuery.isLoading,
        message: primaryName
          ? `${primaryName} -> ${shortAddress(directAddress)}`
          : reverseQuery.isLoading
          ? 'Checking for .rise name...'
          : 'Valid wallet address.',
      };
    }

    if (!lookupLabel) {
      return {
        input,
        address: null as Address | null,
        lookupName: null as string | null,
        displayName: null as string | null,
        status: 'invalid' as RnsAddressInputStatus,
        isLoading: false,
        message: 'Enter a valid address or .rise name.',
      };
    }

    const lookupName = `${lookupLabel}.rise`;
    if (nameQuery.isLoading) {
      return {
        input,
        address: null as Address | null,
        lookupName,
        displayName: lookupName,
        status: 'resolving' as RnsAddressInputStatus,
        isLoading: true,
        message: `Resolving ${lookupName}...`,
      };
    }

    if (nameQuery.isError) {
      return {
        input,
        address: null as Address | null,
        lookupName,
        displayName: lookupName,
        status: 'error' as RnsAddressInputStatus,
        isLoading: false,
        message: `Could not resolve ${lookupName}.`,
      };
    }

    const resolved = nameQuery.data;
    const resolvedAddress = resolved && !resolved.isExpired
      ? coerceAddress(resolved.resolvedAddress)
      : null;

    if (!resolvedAddress) {
      return {
        input,
        address: null as Address | null,
        lookupName,
        displayName: lookupName,
        status: 'not_found' as RnsAddressInputStatus,
        isLoading: false,
        message: resolved?.isExpired
          ? `${lookupName} has expired.`
          : `No active address record found for ${lookupName}.`,
      };
    }

    return {
      input,
      address: resolvedAddress,
      lookupName,
      displayName: lookupName,
      status: 'resolved' as RnsAddressInputStatus,
      isLoading: false,
      message: `${lookupName} -> ${shortAddress(resolvedAddress)}`,
    };
  }, [
    directAddress,
    input,
    lookupLabel,
    nameQuery.data,
    nameQuery.isError,
    nameQuery.isLoading,
    reverseQuery.data?.primaryName,
    reverseQuery.isLoading,
  ]);
}

export async function resolveRnsAddressValues(
  values: string[],
  chainId: number,
): Promise<Array<Address | null>> {
  return Promise.all(values.map((value) => resolveRnsAddressInput({ value, chainId })));
}

export function getRnsAddressInputPlaceholder(base = '0x...'): string {
  return `${base} or name.rise`;
}

export function getRnsAddressDisplay(value: string): string {
  const address = coerceAddress(value);
  if (address) return shortAddress(address);
  return formatRnsLookupName(value);
}
