import { useRnsContracts } from "@/lib/hooks/rns/useRnsContracts";
import { useRnsNode } from "@/lib/hooks/rns/useRnsNode";
import { useRnsResolver as useRnsRegistryResolver } from "@/lib/hooks/rns/useRnsRegistry";
import { RNSResolver } from "@/lib/rns/abis";
import { RNS_QUERY_GC_TIME, RNS_QUERY_STALE_TIME } from "@/lib/rns/constants";
import { normalizeRnsLabel, toRnsFqdn } from "@/lib/rns/utils";
import { zeroAddress } from "viem";
import { useReadContract } from "wagmi";

type UseRnsResolverReadOptions = {
  enabled?: boolean;
  resolverAddress?: `0x${string}`;
};

export function useRnsResolvedAddr(label: string, options: UseRnsResolverReadOptions = {}) {
  const { resolver: defaultResolver } = useRnsContracts();
  const normalized = normalizeRnsLabel(label);
  const enabled = (options.enabled ?? true) && Boolean(normalized);
  const { node, isLoading: isNodeLoading } = useRnsNode(normalized, { enabled });
  const { resolver: registryResolver, isLoading: isResolverLoading } =
    useRnsRegistryResolver(normalized, { enabled });

  const resolver = options.resolverAddress ?? registryResolver ?? defaultResolver;
  const readEnabled =
    enabled &&
    Boolean(node) &&
    Boolean(resolver) &&
    resolver !== zeroAddress &&
    !isResolverLoading;

  const { data, isLoading, error, refetch } = useReadContract({
    address: resolver,
    abi: RNSResolver,
    functionName: "addr",
    args: node ? [node] : undefined,
    query: {
      enabled: readEnabled,
      staleTime: RNS_QUERY_STALE_TIME,
      gcTime: RNS_QUERY_GC_TIME,
    },
  });

  const addr = data && data !== zeroAddress ? data : null;

  return {
    name: normalized,
    fqdn: toRnsFqdn(normalized),
    node,
    resolver,
    addr,
    isLoading: isNodeLoading || isResolverLoading || isLoading,
    error,
    refetch,
  };
}

export function useRnsText(
  label: string,
  key: string,
  options: UseRnsResolverReadOptions = {},
) {
  const { resolver: defaultResolver } = useRnsContracts();
  const normalized = normalizeRnsLabel(label);
  const enabled = (options.enabled ?? true) && Boolean(normalized);
  const { node, isLoading: isNodeLoading } = useRnsNode(normalized, { enabled });
  const { resolver: registryResolver, isLoading: isResolverLoading } =
    useRnsRegistryResolver(normalized, { enabled });

  const resolver = options.resolverAddress ?? registryResolver ?? defaultResolver;
  const readEnabled =
    enabled &&
    Boolean(normalized) &&
    Boolean(key) &&
    Boolean(node) &&
    Boolean(resolver) &&
    resolver !== zeroAddress &&
    !isResolverLoading;

  const { data, isLoading, error, refetch } = useReadContract({
    address: resolver,
    abi: RNSResolver,
    functionName: "text",
    args: node ? [node, key] : undefined,
    query: {
      enabled: readEnabled,
      staleTime: RNS_QUERY_STALE_TIME,
      gcTime: RNS_QUERY_GC_TIME,
    },
  });

  return {
    text: data ?? "",
    isLoading: isNodeLoading || isResolverLoading || isLoading,
    error,
    refetch,
  };
}
