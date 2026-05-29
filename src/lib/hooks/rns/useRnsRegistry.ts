import { useRnsContracts } from "@/lib/hooks/rns/useRnsContracts";
import { useRnsNode } from "@/lib/hooks/rns/useRnsNode";
import { RNSRegistry } from "@/lib/rns/abis";
import { RNS_QUERY_GC_TIME, RNS_QUERY_STALE_TIME } from "@/lib/rns/constants";
import { normalizeRnsLabel } from "@/lib/rns/utils";
import { zeroAddress } from "viem";
import { useReadContract, useReadContracts } from "wagmi";

type UseRnsRegistryOptions = {
  enabled?: boolean;
};

export function useRnsOwner(label: string, options: UseRnsRegistryOptions = {}) {
  const { registry } = useRnsContracts();
  const normalized = normalizeRnsLabel(label);
  const enabled = (options.enabled ?? true) && Boolean(normalized);
  const { node, isLoading: isNodeLoading } = useRnsNode(normalized, { enabled });

  const { data, isLoading, error, refetch } = useReadContract({
    address: registry,
    abi: RNSRegistry,
    functionName: "owner",
    args: node ? [node] : undefined,
    query: {
      enabled: enabled && Boolean(node),
      staleTime: RNS_QUERY_STALE_TIME,
      gcTime: RNS_QUERY_GC_TIME,
    },
  });

  const owner = data && data !== zeroAddress ? data : null;

  return { owner, isLoading: isNodeLoading || isLoading, error, refetch, node };
}

export function useRnsResolver(label: string, options: UseRnsRegistryOptions = {}) {
  const { registry } = useRnsContracts();
  const normalized = normalizeRnsLabel(label);
  const enabled = (options.enabled ?? true) && Boolean(normalized);
  const { node, isLoading: isNodeLoading } = useRnsNode(normalized, { enabled });

  const { data, isLoading, error, refetch } = useReadContract({
    address: registry,
    abi: RNSRegistry,
    functionName: "resolver",
    args: node ? [node] : undefined,
    query: {
      enabled: enabled && Boolean(node),
      staleTime: RNS_QUERY_STALE_TIME,
      gcTime: RNS_QUERY_GC_TIME,
    },
  });

  const resolver = data && data !== zeroAddress ? data : null;

  return { resolver, isLoading: isNodeLoading || isLoading, error, refetch, node };
}

export function useRnsRecordExists(label: string, options: UseRnsRegistryOptions = {}) {
  const { registry } = useRnsContracts();
  const normalized = normalizeRnsLabel(label);
  const enabled = (options.enabled ?? true) && Boolean(normalized);
  const { node, isLoading: isNodeLoading } = useRnsNode(normalized, { enabled });

  const { data, isLoading, error, refetch } = useReadContract({
    address: registry,
    abi: RNSRegistry,
    functionName: "recordExists",
    args: node ? [node] : undefined,
    query: {
      enabled: enabled && Boolean(node),
      staleTime: RNS_QUERY_STALE_TIME,
      gcTime: RNS_QUERY_GC_TIME,
    },
  });

  return {
    exists: Boolean(data),
    isLoading: isNodeLoading || isLoading,
    error,
    refetch,
    node,
  };
}

/** Owner, resolver, and existence for a label in one round-trip. */
export function useRnsRecord(label: string, options: UseRnsRegistryOptions = {}) {
  const { registry } = useRnsContracts();
  const normalized = normalizeRnsLabel(label);
  const enabled = (options.enabled ?? true) && Boolean(normalized);
  const { node, isLoading: isNodeLoading } = useRnsNode(normalized, { enabled });

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: node
      ? [
          {
            address: registry,
            abi: RNSRegistry,
            functionName: "recordExists",
            args: [node],
          },
          {
            address: registry,
            abi: RNSRegistry,
            functionName: "owner",
            args: [node],
          },
          {
            address: registry,
            abi: RNSRegistry,
            functionName: "resolver",
            args: [node],
          },
        ]
      : [],
    query: {
      enabled: enabled && Boolean(node),
      staleTime: RNS_QUERY_STALE_TIME,
      gcTime: RNS_QUERY_GC_TIME,
    },
  });

  const exists = data?.[0]?.result === true;
  const ownerRaw = data?.[1]?.result;
  const resolverRaw = data?.[2]?.result;

  return {
    name: normalized,
    node,
    exists,
    owner: ownerRaw && ownerRaw !== zeroAddress ? ownerRaw : null,
    resolver: resolverRaw && resolverRaw !== zeroAddress ? resolverRaw : null,
    isLoading: isNodeLoading || isLoading,
    error,
    refetch,
  };
}
