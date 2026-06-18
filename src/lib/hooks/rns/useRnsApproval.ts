import { useRnsContracts } from "@/lib/hooks/rns/useRnsContracts";
import { useTrackedWriteContract } from "@/lib/hooks/useTrackedWriteContract";
import { RNSRegistry } from "@/lib/rns/abis";
import { RNS_QUERY_GC_TIME, RNS_QUERY_STALE_TIME } from "@/lib/rns/constants";
import { useCallback } from "react";
import type { Address } from "viem";
import { useReadContract } from "wagmi";

export function useRnsIsApproved(owner?: string, operatorOverride?: Address) {
  const { registry, registrar } = useRnsContracts();
  const operator = operatorOverride ?? registrar;

  const { data, isLoading, refetch } = useReadContract({
    address: registry,
    abi: RNSRegistry,
    functionName: "isApprovedForAll",
    args: owner ? [owner as Address, operator] : undefined,
    query: {
      enabled: Boolean(owner),
      staleTime: RNS_QUERY_STALE_TIME,
      gcTime: RNS_QUERY_GC_TIME,
    },
  });

  return { isApproved: Boolean(data), isLoading, refetch };
}

export function useRnsApproveForAll(operatorOverride?: Address) {
  const { registry, registrar } = useRnsContracts();
  const operator = operatorOverride ?? registrar;
  const { hash, writeContract, isPending, isConfirming, isSuccess, error, reset } =
    useTrackedWriteContract();

  const approve = useCallback(() => {
    writeContract({
      address: registry,
      abi: RNSRegistry,
      functionName: "setApprovalForAll",
      args: [operator, true],
    });
  }, [registry, operator, writeContract]);

  return { hash, approve, isPending, isConfirming, isSuccess, error, reset };
}
