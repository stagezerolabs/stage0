import { DOMAIN_SUFFIX, formatDomainDisplay, normalizeRnsLabel } from "@/lib/rns/utils";
import { riseTestnet } from "@/config";
import { useRnsOwner } from "@/lib/hooks/rns/useRnsRegistry";
import { useRnsExpiry } from "@/lib/hooks/rns/useRnsRegistrar";
import { useRnsApiDomainsForOwner } from "@/lib/hooks/rns/useRnsApi";
import { useRnsSubgraphDomainsForOwner } from "@/lib/hooks/rns/useRnsSubgraph";
import { useRnsContracts } from "@/lib/hooks/rns/useRnsContracts";
import { useRnsLabelRecovery } from "@/lib/hooks/rns/useRnsLabelRecovery";
import { RNSResolver } from "@/lib/rns/abis";
import { getPrimaryLabel } from "@/lib/rns/primary-label";
import { RNS_PRIMARY_LABEL_EVENT } from "@/lib/rns/primary-label";
import {
  getRecentRegistrations,
  removeRecentRegistration,
  RNS_RECENT_REGISTRATION_EVENT,
  type RecentRegistration,
} from "@/lib/rns/recent-registration";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address, Hex } from "viem";
import { useReadContracts } from "wagmi";

/**
 * Returns the connected wallet's primary `.rise` label.
 *
 * Wallet-wide name discovery comes from Senna's Postgres-backed RNS index first,
 * then falls back to Goldsky if the API is unavailable.
 *
 * Per-domain label priority is still:
 *  1. resolver.text(node, "label") — legacy on-chain source for existing records
 *  2. indexed label — from the Senna API (or Goldsky fallback)
 *  3. calldata recovery — decodes label from NameRegistered tx input
 *
 * Pass `hintLabel` immediately after a successful registration so the UI
 * shows the new name while the subgraph indexes the transaction.
 */
export function useRnsOwnedLabel(address?: string, hintLabel?: string) {
  const typedAddress = address as Address | undefined;
  const { resolver: resolverAddress, registrar } = useRnsContracts();

  const {
    data: apiDomains,
    error: apiError,
    isLoading: isApiLoading,
    refetch: refetchApi,
  } = useRnsApiDomainsForOwner(typedAddress, riseTestnet.id, { enabled: Boolean(address) });

  const {
    data: subgraphDomains,
    isLoading: isSubgraphLoading,
    refetch: refetchSubgraph,
  } = useRnsSubgraphDomainsForOwner(typedAddress, {
    enabled: Boolean(address) && Boolean(apiError),
  });

  // Recent registrations from localStorage bridge the 30s–few-minute Goldsky lag.
  // Stored on tx success by Senna's buy-name signer and the legacy DomainsPage flow.
  const [recentTick, setRecentTick] = useState(0);
  const [primaryTick, setPrimaryTick] = useState(0);
  const recentRegistrations = useMemo<RecentRegistration[]>(() => {
    if (!address) return [];
    return getRecentRegistrations(address);
    // recentTick lets the merge re-evaluate after a fresh save without remounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, recentTick]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const bump = () => setPrimaryTick((t) => t + 1);
    window.addEventListener(RNS_PRIMARY_LABEL_EVENT, bump);
    return () => window.removeEventListener(RNS_PRIMARY_LABEL_EVENT, bump);
  }, []);

  // Re-read localStorage when the tab regains focus or another component
  // dispatches the recent-registration event (Senna's buy-name signer fires
  // it on tx success so /domains updates without a focus change).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const bump = () => setRecentTick((t) => t + 1);
    window.addEventListener("focus", bump);
    window.addEventListener(RNS_RECENT_REGISTRATION_EVENT, bump);
    return () => {
      window.removeEventListener("focus", bump);
      window.removeEventListener(RNS_RECENT_REGISTRATION_EVENT, bump);
    };
  }, []);

  // Merge recent localStorage entries with the subgraph result.
  // If the subgraph already returned a node, the localStorage entry is dropped
  // from storage (subgraph caught up) and skipped to avoid duplicates.
  const rawDomains = useMemo(() => {
    const fromGraph = apiDomains ?? subgraphDomains ?? [];
    if (recentRegistrations.length === 0) return fromGraph;

    const graphNodes = new Set(fromGraph.map((d) => d.node.toLowerCase()));
    const synthetic = recentRegistrations
      .filter((r) => {
        if (graphNodes.has(r.node.toLowerCase())) {
          // Subgraph has it now — clean up the bridge entry.
          removeRecentRegistration(r.address, r.label);
          return false;
        }
        return true;
      })
      .map<typeof fromGraph[number]>((r) => ({
        node: r.node as Hex,
        label: r.label,
        fqdn: `${r.label}${DOMAIN_SUFFIX}`,
        owner: (typedAddress ?? (r.address as Address)) as Address,
        resolver: null,
        resolvedAddress: null,
        registrant: (typedAddress ?? (r.address as Address)) as Address,
        expiry: BigInt(r.expiry),
        registeredAt: BigInt(Math.floor(r.registeredAt / 1000)),
        renewedAt: null,
        releasedAt: null,
        createdAtBlock: 0n,
      }));

    return [...synthetic, ...fromGraph];
  }, [apiDomains, subgraphDomains, recentRegistrations, typedAddress]);

  // Batch-read resolver.text(node, "label") for older names that already have it.
  const { data: resolverTextResults, isLoading: isResolverLoading } = useReadContracts({
    contracts: rawDomains.map((d) => ({
      address: resolverAddress,
      abi: RNSResolver,
      functionName: "text" as const,
      args: [d.node as Hex, "label"] as const,
    })),
    query: { enabled: rawDomains.length > 0 },
  });

  // Domains that still have no label after resolver.text — these need calldata recovery.
  const domainsNeedingRecovery = useMemo(() => {
    return rawDomains.filter((d, i) => {
      const onChainLabel = (resolverTextResults?.[i]?.result as string | undefined) ?? "";
      return !onChainLabel && !d.label;
    });
  }, [rawDomains, resolverTextResults]);

  // Recover labels from on-chain NameRegistered calldata for domains with no label source.
  const { recoveredLabels } = useRnsLabelRecovery(
    domainsNeedingRecovery,
    typedAddress,
    registrar,
  );

  // Merge: resolver text first, subgraph label second, calldata recovery third.
  const resolvedDomains = useMemo(() => {
    return rawDomains.map((d, i) => {
      const onChainLabel = (resolverTextResults?.[i]?.result as string | undefined) ?? "";
      const recoveredLabel = recoveredLabels.get(d.node.toLowerCase()) ?? "";
      const label = onChainLabel || d.label || recoveredLabel;
      return { ...d, label };
    });
  }, [rawDomains, resolverTextResults, recoveredLabels]);

  // Pick the user's preferred primary if it's still in their owned list,
  // otherwise fall back to the first domain. Primary preference is stored
  // in localStorage only for UI ordering — it is never used as a data source.
  const subgraphLabel = useMemo(() => {
    const walletDomains = resolvedDomains.filter((domain) => (domain.custody ?? "wallet") === "wallet");
    if (!walletDomains.length) return null;
    const stored = address ? getPrimaryLabel(address) : null;
    if (stored) {
      const match = walletDomains.find((d) => d.label === stored);
      if (match) return match.label;
    }
    return walletDomains[0].label || null;
  }, [resolvedDomains, address, primaryTick]);

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
    await Promise.all([refetchApi(), refetchSubgraph(), refetchOwner(), refetchExpiry(), refetchHintOwner()]);
  }, [refetchApi, refetchSubgraph, refetchOwner, refetchExpiry, refetchHintOwner]);

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
    // isRecovering intentionally excluded — recovery is a background enrichment pass
    // that should not block the UI from rendering whatever labels are already available.
    isLoading:
      (isApiLoading || (Boolean(apiError) && isSubgraphLoading)) ||
      isHintLoading ||
      isExpiryLoading ||
      isResolverLoading,
    allDomains: resolvedDomains,
    refetch,
  };
}
