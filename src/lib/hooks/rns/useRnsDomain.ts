import { DOMAIN_SUFFIX } from "@/lib/rns/utils";
import { useRnsOwner, useRnsRecord } from "@/lib/hooks/rns/useRnsRegistry";
import {
  useRnsAvailable,
  useRnsExpiry,
  useRnsRegistrationQuote,
} from "@/lib/hooks/rns/useRnsRegistrar";
import { useRnsResolvedAddr } from "@/lib/hooks/rns/useRnsResolver";
import { normalizeRnsLabel, toRnsFqdn } from "@/lib/rns/utils";
import { useMemo } from "react";
import { useAccount } from "wagmi";

type UseRnsDomainLookupOptions = {
  enabled?: boolean;
};

/**
 * High-level read hook for a single `.rise` label — registry record,
 * registrar quote, resolver address, and expiry.
 */
export function useRnsDomain(label: string, options: UseRnsDomainLookupOptions = {}) {
  const normalized = normalizeRnsLabel(label);
  const enabled = (options.enabled ?? true) && Boolean(normalized);

  const record = useRnsRecord(normalized, { enabled });
  const quote = useRnsRegistrationQuote(normalized, { enabled });
  const resolved = useRnsResolvedAddr(normalized, { enabled });
  const { expiry, isLoading: isExpiryLoading } = useRnsExpiry(normalized, {
    enabled: enabled && !quote.available,
  });

  const fqdn = useMemo(() => toRnsFqdn(normalized), [normalized]);

  return {
    label: normalized,
    fqdn,
    displayName: `${normalized}${DOMAIN_SUFFIX}`,
    record,
    quote,
    resolved,
    expiry,
    isLoading:
      record.isLoading || quote.isLoading || resolved.isLoading || isExpiryLoading,
  };
}

/** Whether the connected wallet owns the given label onchain. */
export function useRnsIsOwner(label: string, options: UseRnsDomainLookupOptions = {}) {
  const { address } = useAccount();
  const normalized = normalizeRnsLabel(label);
  const { owner, isLoading, error, refetch } = useRnsOwner(normalized, options);

  const isOwner = Boolean(
    address && owner && owner.toLowerCase() === address.toLowerCase(),
  );

  return { isOwner, owner, isLoading, error, refetch };
}

/** Combines registrar availability with registry ownership for mint/search UIs. */
export function useRnsNameStatus(label: string, options: UseRnsDomainLookupOptions = {}) {
  const { address } = useAccount();
  const normalized = normalizeRnsLabel(label);
  const enabled = (options.enabled ?? true) && Boolean(normalized);

  const { available, isLoading: isAvailableLoading, refetch: refetchAvailable } =
    useRnsAvailable(normalized, { enabled });
  const { owner, isLoading: isOwnerLoading, refetch: refetchOwner } = useRnsOwner(
    normalized,
    { enabled },
  );

  const isOwnedByUser = Boolean(
    address && owner && owner.toLowerCase() === address.toLowerCase(),
  );
  const isTaken = !available && Boolean(owner);

  return {
    label: normalized,
    fqdn: toRnsFqdn(normalized),
    available,
    owner,
    isOwnedByUser,
    isTaken,
    isLoading: isAvailableLoading || isOwnerLoading,
    refetch: async () => {
      await Promise.all([refetchAvailable(), refetchOwner()]);
    },
  };
}
