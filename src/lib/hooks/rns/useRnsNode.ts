import { normalizeRnsLabel, rnsLabelhash, rnsNamehash } from "@/lib/rns/utils";
import { useMemo } from "react";

type UseRnsNodeOptions = {
  enabled?: boolean;
};

/** Resolves the registry node for a `.rise` label using ENS-compatible namehash. */
export function useRnsNode(label: string, options: UseRnsNodeOptions = {}) {
  const normalized = normalizeRnsLabel(label);
  const labelHash = useMemo(
    () => (normalized ? rnsLabelhash(normalized) : undefined),
    [normalized],
  );
  const enabled = (options.enabled ?? true) && Boolean(normalized);
  const node = useMemo(() => (enabled ? rnsNamehash(normalized) : undefined), [enabled, normalized]);

  return {
    label: normalized,
    labelHash,
    riseNode: undefined,
    node,
    isLoading: false,
    error: null,
    refetch: async () => ({ data: node }),
  };
}
