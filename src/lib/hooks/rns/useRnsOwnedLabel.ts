import { DOMAIN_SUFFIX, formatDomainDisplay, normalizeRnsLabel } from "@/lib/rns/utils";
import { useRnsOwner } from "@/lib/hooks/rns/useRnsRegistry";
import { useRnsExpiry } from "@/lib/hooks/rns/useRnsRegistrar";
import { useRnsSubgraphDomainsForOwner } from "@/lib/hooks/rns/useRnsSubgraph";
import { useRnsContracts } from "@/lib/hooks/rns/useRnsContracts";
import { RNSResolver } from "@/lib/rns/abis";
import { getPrimaryLabel } from "@/lib/rns/primary-label";
import { useCallback, useMemo } from "react";
import type { Address, Hex } from "viem";
import { useReadContracts } from "wagmi";

/**
 * Returns the connected wallet's primary `.rise` label.
 *
 * Priority order (all on-chain — no localStorage):
 *  1. resolver.text(node, "label") — canonical on-chain source set during registration
 *  2. Subgraph label — fallback for names registered before setText was implemented
 *  3. On-chain ownership check for hintLabel (post-registration before subgraph indexes)
 *
 * Pass `hintLabel` immediately after a successful registration so the UI
 * shows the new name while the subgraph indexes the transaction.
 */
export function useRnsOwnedLabel(address?: string, hintLabel?: string) {
  const typedAddress = address as Address | undefined;
  const { resolver: resolverAddress } = useRnsContracts();

  const {
    data: subgraphDomains,
    isLoading: isSubgraphLoading,
    refetch: refetchSubgraph,
  } = useRnsSubgraphDomainsForOwner(typedAddress, { enabled: Boolean(address) });

  const rawDomains = useMemo(() => subgraphDomains ?? [], [subgraphDomains]);

  // Batch-read resolver.text(node, "label") for every owned domain.
  // This is the authoritative on-chain source of truth — set via setText after registration.
  const { data: resolverTextResults, isLoading: isResolverLoading } = useReadContracts({
    contracts: rawDomains.map((d) => ({
      address: resolverAddress,
      abi: RNSResolver,
      functionName: "text" as const,
      args: [d.node as Hex, "label"] as const,
    })),
    query: { enabled: rawDomains.length > 0 },
  });

  // Merge: resolver text record first, subgraph label as fallback.
  const resolvedDomains = useMemo(() => {
    return rawDomains.map((d, i) => {
      const onChainLabel = (resolverTextResults?.[i]?.result as string | undefined) || "";
      const label = onChainLabel || d.label || "";
      return { ...d, label };
    });
  }, [rawDomains, resolverTextResults]);

  // Pick the user's preferred primary if it's still in their owned list,
  // otherwise fall back to the first domain. Primary preference is stored
  // in localStorage only for UI ordering — it is never used as a data source.
  const subgraphLabel = useMemo(() => {
    if (!resolvedDomains.length) return null;
    const stored = address ? getPrimaryLabel(address) : null;
    if (stored) {
      const match = resolvedDomains.find((d) => d.label === stored);
      if (match) return match.label;
    }
    return resolvedDomains[0].label || null;
  }, [resolvedDomains, address]);

  // Fallback: onchain ownership check for hintLabel while subgraph indexes
  const hintNormalized = hintLabel ? normalizeRnsLabel(hintLabel) : "";
  const {
    owner: hintOwner,
    isLoading: isHintLoading,
    refetch: refetchHintOwner,
  } = useRnsOwner(
    hintNormalized,
    { enabled: Boolean(address && hintNormalized && !subgraphLabel) },
  );
  const isHintOwner = Boolean(
    address && hintOwner && hintOwner.toLowerCase() === address.toLowerCase(),
  );

  const label = subgraphLabel ?? (isHintOwner ? hintNormalized : null);

  const { expiry, isLoading: isExpiryLoading, refetch: refetchExpiry } = useRnsExpiry(
    label ?? "",
    { enabled: Boolean(label) },
  );

  const { owner, refetch: refetchOwner } = useRnsOwner(label ?? "", {
    enabled: Boolean(label),
  });

  const refetch = useCallback(async () => {
    await Promise.all([refetchSubgraph(), refetchOwner(), refetchExpiry(), refetchHintOwner()]);
  }, [refetchSubgraph, refetchOwner, refetchExpiry, refetchHintOwner]);

  const displayName = useMemo(
    () => (label ? formatDomainDisplay(label) : null),
    [label],
  );

  return {
    label,
    displayName,
    fqdn: label ? `${label}${DOMAIN_SUFFIX}` : null,
    owner: owner ?? null,
    expiry: expiry ?? 0n,
    isLoading: isSubgraphLoading || isHintLoading || isExpiryLoading || isResolverLoading,
    allDomains: resolvedDomains,
    refetch,
  };
}
