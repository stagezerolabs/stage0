import { DOMAIN_SUFFIX, formatDomainDisplay, normalizeRnsLabel } from "@/lib/rns/utils";
import { useRnsOwner } from "@/lib/hooks/rns/useRnsRegistry";
import { useRnsExpiry } from "@/lib/hooks/rns/useRnsRegistrar";
import { useRnsSubgraphDomainsForOwner } from "@/lib/hooks/rns/useRnsSubgraph";
import { getCachedRnsLabel } from "@/lib/rns/label-cache";
import { getPrimaryLabel } from "@/lib/rns/primary-label";
import { useCallback, useMemo } from "react";
import type { Address } from "viem";

/**
 * Returns the connected wallet's primary `.rise` label.
 *
 * Priority order:
 *  1. User-selected primary stored in localStorage (setPrimaryLabel)
 *  2. First domain from the Goldsky subgraph
 *  3. Label cache fallback (for domains with empty subgraph label on Rise Testnet)
 *  4. On-chain ownership check for hintLabel (post-registration before subgraph indexes)
 *
 * Pass `hintLabel` immediately after a successful registration so the UI
 * shows the new name while the subgraph indexes the transaction.
 */
export function useRnsOwnedLabel(address?: string, hintLabel?: string) {
  const typedAddress = address as Address | undefined;

  const {
    data: subgraphDomains,
    isLoading: isSubgraphLoading,
    refetch: refetchSubgraph,
  } = useRnsSubgraphDomainsForOwner(typedAddress, { enabled: Boolean(address) });

  // Resolve each domain's label, falling back to the localStorage cache when
  // the subgraph returns an empty string (Rise Testnet calldata limitation).
  const resolvedDomains = useMemo(() => {
    if (!subgraphDomains) return [];
    return subgraphDomains.map((d) => ({
      ...d,
      label: d.label || getCachedRnsLabel(d.node) || "",
    }));
  }, [subgraphDomains]);

  // Pick the user's preferred primary if it's still in their owned list,
  // otherwise fall back to the first domain.
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
  const { owner: hintOwner, isLoading: isHintLoading } = useRnsOwner(
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
    await Promise.all([refetchSubgraph(), refetchOwner(), refetchExpiry()]);
  }, [refetchSubgraph, refetchOwner, refetchExpiry]);

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
    isLoading: isSubgraphLoading || isHintLoading || isExpiryLoading,
    allDomains: resolvedDomains,
    refetch,
  };
}
