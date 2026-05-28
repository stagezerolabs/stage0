import {
  formatDomainDisplay,
  normalizeDomainName,
  validateDomainName,
  type MintDomainResult,
} from '@/lib/domains/storage';
import { useRnsOwnedLabel } from '@/lib/hooks/rns/useRnsOwnedLabel';
import { useCallback } from 'react';

/**
 * User's `.rise` name — sourced from the Goldsky subgraph (onchain, no localStorage).
 */
export function useUserDomain(address?: string) {
  const {
    label,
    displayName,
    isLoading,
    refetch,
    expiry,
    owner,
  } = useRnsOwnedLabel(address);

  const mintDomain = useCallback(
    (name: string): MintDomainResult => {
      if (!address) {
        return { ok: false, error: 'Connect your wallet to mint a name.' };
      }
      const normalized = normalizeDomainName(name);
      const validation = validateDomainName(normalized);
      if (!validation.valid) {
        return { ok: false, error: validation.error ?? 'Invalid name.' };
      }
      if (label) {
        return {
          ok: false,
          error: `You already own ${formatDomainDisplay(label)}.`,
        };
      }
      return {
        ok: false,
        error: 'Use the register transaction on the Names page to mint onchain.',
      };
    },
    [address, label],
  );

  return {
    domain: label,
    displayName,
    owner,
    expiry,
    isLoading,
    mintDomain,
    refresh: refetch,
  };
}
