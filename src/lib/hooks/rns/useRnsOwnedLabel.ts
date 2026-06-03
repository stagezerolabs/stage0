import { DOMAIN_SUFFIX, formatDomainDisplay, normalizeRnsLabel } from "@/lib/rns/utils";
import { useRnsOwner } from "@/lib/hooks/rns/useRnsRegistry";
import { useRnsExpiry } from "@/lib/hooks/rns/useRnsRegistrar";
import { useRnsSubgraphDomainsForOwner } from "@/lib/hooks/rns/useRnsSubgraph";
import { useRnsContracts } from "@/lib/hooks/rns/useRnsContracts";
import { useRnsLabelRecovery } from "@/lib/hooks/rns/useRnsLabelRecovery";
import { RNSResolver } from "@/lib/rns/abis";
import { getPrimaryLabel } from "@/lib/rns/primary-label";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Address, Hex } from "viem";
import { useReadContracts, useWriteContract } from "wagmi";

/**
 * Returns the connected wallet's primary `.rise` label.
 *
 * Priority order (all on-chain — no localStorage):
 *  1. resolver.text(node, "label") — canonical on-chain source set during registration
 *  2. Subgraph label — fallback for names registered before setText was implemented
 *  3. Calldata recovery — decodes label from NameRegistered tx input via getLogs+getTransaction
 *     (Rise Testnet subgraph cannot access calldata server-side, so we do it client-side)
 *
 * When a label is recovered via calldata, setText is auto-called so future loads
 * hit source #1 directly without needing recovery.
 *
 * Pass `hintLabel` immediately after a successful registration so the UI
 * shows the new name while the subgraph indexes the transaction.
 */
export function useRnsOwnedLabel(address?: string, hintLabel?: string) {
  const typedAddress = address as Address | undefined;
  const { resolver: resolverAddress, registrar } = useRnsContracts();
  const { writeContract } = useWriteContract();
  const healedRef = useRef<Set<string>>(new Set());

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

  // Auto-heal: write recovered labels to the resolver so future loads use source #1.
  // Fires once per recovered node per session; never re-fires after setText is written.
  useEffect(() => {
    if (!recoveredLabels.size || !resolverAddress) return;
    recoveredLabels.forEach((label, nodeKey) => {
      if (healedRef.current.has(nodeKey)) return;
      healedRef.current.add(nodeKey);
      writeContract({
        address: resolverAddress,
        abi: RNSResolver,
        functionName: "setText",
        args: [nodeKey as Hex, "label", label],
      });
    });
  }, [recoveredLabels, resolverAddress, writeContract]);

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
    // isRecovering intentionally excluded — recovery is a background enrichment pass
    // that should not block the UI from rendering whatever labels are already available.
    isLoading: isSubgraphLoading || isHintLoading || isExpiryLoading || isResolverLoading,
    allDomains: resolvedDomains,
    refetch,
  };
}
