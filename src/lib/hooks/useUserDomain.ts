import {
  formatDomainDisplay,
  getDomainForAddress,
  mintDomain as mintDomainInStorage,
  type MintDomainResult,
} from '@/lib/domains/storage';
import { useCallback, useSyncExternalStore } from 'react';

const DOMAIN_UPDATED_EVENT = 'rise:domain-updated';

function subscribeToDomainRegistry(onStoreChange: () => void) {
  window.addEventListener(DOMAIN_UPDATED_EVENT, onStoreChange);
  return () => window.removeEventListener(DOMAIN_UPDATED_EVENT, onStoreChange);
}

export function useUserDomain(address?: string) {
  const domain = useSyncExternalStore(
    subscribeToDomainRegistry,
    () => (address ? getDomainForAddress(address) : null),
    () => null,
  );

  const refresh = useCallback(() => {
    window.dispatchEvent(new CustomEvent(DOMAIN_UPDATED_EVENT));
  }, []);

  const mint = useCallback(
    (name: string): MintDomainResult => {
      if (!address) {
        return { ok: false, error: 'Connect your wallet to mint a name.' };
      }
      return mintDomainInStorage(name, address);
    },
    [address],
  );

  return {
    domain,
    displayName: domain ? formatDomainDisplay(domain) : null,
    mintDomain: mint,
    refresh,
  };
}
