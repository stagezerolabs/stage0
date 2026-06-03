import { recoverLabelsFromChain } from "@/lib/rns/recover-labels";
import type { IndexedRnsDomain } from "@/lib/indexer/rns-goldsky";
import type { Address } from "viem";
import { useEffect, useRef, useState } from "react";
import { usePublicClient } from "wagmi";

/**
 * Recovers domain labels from on-chain NameRegistered calldata for any domain
 * whose label is missing from both the subgraph and resolver.text.
 *
 * This happens on Rise Testnet because the subgraph cannot access transaction
 * calldata during event processing. We decode it client-side via eth_getTransactionByHash.
 *
 * No localStorage. Pure on-chain read. Results live in React state only.
 */
export function useRnsLabelRecovery(
  rawDomains: IndexedRnsDomain[],
  owner: Address | undefined,
  registrar: Address,
) {
  const publicClient = usePublicClient();
  const [recoveredLabels, setRecoveredLabels] = useState<Map<string, string>>(new Map());
  const [isRecovering, setIsRecovering] = useState(false);

  // Track which (owner, registrar) combo we've already tried so we don't
  // re-fire on every render while the subgraph is still loading.
  const attemptedRef = useRef<string>("");

  useEffect(() => {
    if (!owner || !publicClient) return;

    // Domains with empty labels from both subgraph and resolver.text
    const emptyDomains = rawDomains.filter((d) => !d.label);

    if (!emptyDomains.length) return;

    const key = `${owner}-${registrar}-${emptyDomains.map((d) => d.node).join(",")}`;
    if (attemptedRef.current === key) return;
    attemptedRef.current = key;

    setIsRecovering(true);
    recoverLabelsFromChain(owner, registrar, publicClient, emptyDomains)
      .then((map) => {
        if (map.size > 0) setRecoveredLabels(map);
      })
      .catch(() => {
        // Recovery is best-effort — silent failure is acceptable.
      })
      .finally(() => setIsRecovering(false));
  }, [rawDomains, owner, registrar, publicClient]);

  return { recoveredLabels, isRecovering };
}
