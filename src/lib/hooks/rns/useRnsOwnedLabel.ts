import { DOMAIN_SUFFIX, formatDomainDisplay, normalizeRnsLabel } from "@/lib/rns/utils";
import { useRnsOwner } from "@/lib/hooks/rns/useRnsRegistry";
import { useRnsExpiry } from "@/lib/hooks/rns/useRnsRegistrar";
import { useRnsSubgraphDomainsForOwner } from "@/lib/hooks/rns/useRnsSubgraph";
import { getCachedRnsLabel } from "@/lib/rns/label-cache";
import { useCallback, useMemo } from "react";
import type { Address } from "viem";

/**
 * Returns the connected wallet's primary `.rise` label sourced from the
 * Goldsky subgraph (address → owned domains).
 *
 * Pass `hintLabel` immediately after a successful registration so the UI
 * shows the new name while the subgraph indexes the transaction.
 * The hint is verified onchain and is never persisted anywhere.
 */
export function useRnsOwnedLabel(address?: string, hintLabel?: string) {
  const typedAddress = address as Address | undefined;

  // Primary source: subgraph reverse lookup (all non-released domains owned by address)
  const {
    data: subgraphDomains,
    isLoading: isSubgraphLoading,
    refetch: refetchSubgraph,
  } = useRnsSubgraphDomainsForOwner(typedAddress, { enabled: Boolean(address) });

  // Treat empty string from subgraph as null — Rise Testnet calldata isn't
  // available so the indexer may leave label="" even for registered domains.
  const subgraphLabel = subgraphDomains?.[0]?.label || null;

  // Cache fallback: look up the label via the node hash that was stored at
  // registration time in localStorage.
  const firstNode = subgraphDomains?.[0]?.node;
  const cachedLabel = !subgraphLabel && firstNode
    ? (getCachedRnsLabel(firstNode) || null)
    : null;

  // Fallback: onchain ownership check for hintLabel while subgraph indexes
  const hintNormalized = hintLabel ? normalizeRnsLabel(hintLabel) : "";
  const { owner: hintOwner, isLoading: isHintLoading } = useRnsOwner(
    hintNormalized,
    { enabled: Boolean(address && hintNormalized && !subgraphLabel && !cachedLabel) },
  );
  const isHintOwner = Boolean(
    address && hintOwner && hintOwner.toLowerCase() === address.toLowerCase(),
  );

  const label = subgraphLabel ?? cachedLabel ?? (isHintOwner ? hintNormalized : null);

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
    refetch,
  };
}
