import { useRnsContracts } from "@/lib/hooks/rns/useRnsContracts";
import { RNSRegistrar, RNSRegistry } from "@/lib/rns/abis";
import { RNS_QUERY_GC_TIME, RNS_QUERY_STALE_TIME } from "@/lib/rns/constants";
import { normalizeRnsLabel, rnsLabelhash } from "@/lib/rns/utils";
import { useMemo } from "react";
import { useReadContract } from "wagmi";

type UseRnsNodeOptions = {
  enabled?: boolean;
};

/** Resolves the registry node for a `.rise` label via `riseNode` + `computeNode`. */
export function useRnsNode(label: string, options: UseRnsNodeOptions = {}) {
  const { registry, registrar } = useRnsContracts();
  const normalized = normalizeRnsLabel(label);
  const labelHash = useMemo(
    () => (normalized ? rnsLabelhash(normalized) : undefined),
    [normalized],
  );
  const enabled = (options.enabled ?? true) && Boolean(normalized);

  const { data: riseNode, isLoading: isRiseNodeLoading } = useReadContract({
    address: registrar,
    abi: RNSRegistrar,
    functionName: "riseNode",
    query: {
      staleTime: RNS_QUERY_STALE_TIME,
      gcTime: RNS_QUERY_GC_TIME,
    },
  });

  const {
    data: node,
    isLoading: isNodeLoading,
    error,
    refetch,
  } = useReadContract({
    address: registry,
    abi: RNSRegistry,
    functionName: "computeNode",
    args: riseNode && labelHash ? [riseNode, labelHash] : undefined,
    query: {
      enabled: enabled && Boolean(riseNode && labelHash),
      staleTime: RNS_QUERY_STALE_TIME,
      gcTime: RNS_QUERY_GC_TIME,
    },
  });

  return {
    label: normalized,
    labelHash,
    riseNode,
    node,
    isLoading: isRiseNodeLoading || isNodeLoading,
    error,
    refetch,
  };
}
