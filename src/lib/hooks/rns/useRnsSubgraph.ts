import {
  fetchRnsDomainByLabel,
  fetchRnsDomainByNode,
  fetchRnsDomainsForOwner,
  fetchRnsReverseRecord,
  isRnsSubgraphConfigured,
  type IndexedRnsDomain,
} from "@/lib/indexer/rns-goldsky";
import { RNS_QUERY_GC_TIME, RNS_QUERY_STALE_TIME } from "@/lib/rns/constants";
import { normalizeRnsLabel } from "@/lib/rns/utils";
import { useQuery } from "@tanstack/react-query";
import type { Address, Hex } from "viem";

type QueryOptions = {
  enabled?: boolean;
};

/**
 * Fetch a domain from the subgraph by its ENS-compatible namehash node.
 * Returns null when the domain has not been registered or is not yet indexed.
 */
export function useRnsSubgraphDomainByNode(
  node: Hex | undefined,
  options: QueryOptions = {},
) {
  const enabled =
    isRnsSubgraphConfigured() && (options.enabled ?? true) && Boolean(node);

  return useQuery<IndexedRnsDomain | null>({
    queryKey: ["rns", "subgraph", "domain", "node", node],
    queryFn: () => fetchRnsDomainByNode(node!),
    enabled,
    staleTime: RNS_QUERY_STALE_TIME,
    gcTime: RNS_QUERY_GC_TIME,
  });
}

/**
 * Fetch a domain from the subgraph by its label (e.g. "alice" or "alice.rise").
 * Useful for availability / ownership checks without needing a wagmi client.
 */
export function useRnsSubgraphDomainByLabel(
  label: string,
  options: QueryOptions = {},
) {
  const normalized = normalizeRnsLabel(label);
  const enabled =
    isRnsSubgraphConfigured() &&
    (options.enabled ?? true) &&
    Boolean(normalized);

  return useQuery<IndexedRnsDomain | null>({
    queryKey: ["rns", "subgraph", "domain", "label", normalized],
    queryFn: () => fetchRnsDomainByLabel(normalized),
    enabled,
    staleTime: RNS_QUERY_STALE_TIME,
    gcTime: RNS_QUERY_GC_TIME,
  });
}

/**
 * Fetch all active (non-released) domains owned by an address.
 * This is the primary way to list a wallet's names — it cannot be done
 * cheaply on-chain because there is no enumeration contract.
 */
export function useRnsSubgraphDomainsForOwner(
  owner: Address | undefined,
  options: QueryOptions = {},
) {
  const enabled =
    isRnsSubgraphConfigured() && (options.enabled ?? true) && Boolean(owner);

  return useQuery<IndexedRnsDomain[]>({
    queryKey: ["rns", "subgraph", "domains", "owner", owner],
    queryFn: () => fetchRnsDomainsForOwner(owner!),
    enabled,
    staleTime: RNS_QUERY_STALE_TIME,
    gcTime: RNS_QUERY_GC_TIME,
  });
}

/**
 * Reverse lookup: resolve an address to its primary `.rise` domain.
 * Populated from AddrChanged events on the resolver contract.
 * Returns null when the address has no reverse record.
 */
export function useRnsSubgraphReverseRecord(
  address: Address | undefined,
  options: QueryOptions = {},
) {
  const enabled =
    isRnsSubgraphConfigured() && (options.enabled ?? true) && Boolean(address);

  return useQuery<IndexedRnsDomain | null>({
    queryKey: ["rns", "subgraph", "reverse", address],
    queryFn: () => fetchRnsReverseRecord(address!),
    enabled,
    staleTime: RNS_QUERY_STALE_TIME,
    gcTime: RNS_QUERY_GC_TIME,
  });
}
