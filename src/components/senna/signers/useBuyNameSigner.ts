import { useEffect, useRef } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { riseMainnet } from '@/config';
import { fetchRnsNameResolution } from '@/lib/api/rns';
import {
  useRnsNameStatus,
  useRnsRegister,
  useRnsRegistrationQuote,
} from '@/lib/hooks/rns';
import { saveRecentRegistration } from '@/lib/rns/recent-registration';
import { normalizeRnsLabel, rnsNamehash } from '@/lib/rns/utils';
import { getFriendlyTxErrorMessage } from '@/lib/utils/tx-errors';
import type { SennaActionDraft, SignerState } from '../types';

export function useBuyNameSigner(draft: SennaActionDraft): SignerState {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();
  const queryClient = useQueryClient();
  const onWrongChain = chainId !== riseMainnet.id;

  const requestedName = normalizeRnsLabel(draft.prefill.name || '');

  const { available, isReserved: reserved, isLoading: statusLoading } = useRnsNameStatus(requestedName, {
    enabled: Boolean(requestedName),
  });

  const {
    price: registerPrice = 0n,
    signedQuote,
    signature,
    isLoading: quoteLoading,
  } = useRnsRegistrationQuote(requestedName, {
    enabled: Boolean(requestedName) && available && !reserved,
  });

  const {
    register,
    hash: actionHash,
    isPending: actionPending,
    isConfirming: actionConfirming,
    isSuccess,
    error: actionError,
    reset: resetAction,
  } = useRnsRegister();

  // Bridge indexer lag: when the register tx confirms, persist a local hint so
  // DomainsPage/MyDomains can show the new name immediately, then invalidate
  // both the Senna-backed and legacy subgraph caches.
  const persistedRef = useRef(false);
  useEffect(() => {
    if (!isSuccess || persistedRef.current) return;
    if (!address || !requestedName) return;
    persistedRef.current = true;
    try {
      saveRecentRegistration(address, requestedName, rnsNamehash(requestedName));
    } catch {
      // localStorage may be unavailable in some browser modes; safe to ignore.
    }
    void fetchRnsNameResolution({ name: requestedName, chainId: riseMainnet.id }).catch(() => {
      // The normal indexer will still catch up; this only accelerates Senna's DB repair.
    });
    queryClient.invalidateQueries({ queryKey: ['rns', 'api', 'domains', 'owner'] });
    queryClient.invalidateQueries({ queryKey: ['rns', 'subgraph', 'domains', 'owner'] });
  }, [isSuccess, address, requestedName, queryClient]);

  const errorMessage =
    reserved ? 'That name is reserved.' :
    requestedName && !statusLoading && available === false ? 'That name is already taken.' :
    actionError ? getFriendlyTxErrorMessage(actionError, 'Register') :
    '';

  const ready = Boolean(requestedName) && available === true && !reserved && Boolean(signedQuote && signature);

  let phase: SignerState['phase'] = 'idle';
  let primaryLabel = 'Sign & Register';
  let step: SignerState['step'] | undefined;
  let busy = false;

  if (!isConnected) {
    phase = 'needs_wallet';
    primaryLabel = 'Connect Wallet';
  } else if (onWrongChain) {
    phase = 'needs_chain';
    primaryLabel = switching ? 'Switching to RISE…' : 'Switch to RISE Mainnet';
    busy = switching;
  } else if (quoteLoading) {
    primaryLabel = 'Preparing quote…';
    busy = true;
  } else if (actionPending) {
    phase = 'awaiting_signature';
    primaryLabel = 'Sign register in wallet…';
    step = 'action';
    busy = true;
  } else if (actionConfirming) {
    phase = 'confirming';
    primaryLabel = `Registering ${requestedName}…`;
    step = 'action';
    busy = true;
  } else if (isSuccess) {
    phase = 'success';
    primaryLabel = `${requestedName}.rise registered`;
  } else if (errorMessage) {
    phase = 'error';
    primaryLabel = 'Try again';
  }

  const primary = () => {
    if (errorMessage) {
      resetAction();
    }
    if (!isConnected) return;
    if (onWrongChain) {
      switchChain({ chainId: riseMainnet.id });
      return;
    }
    if (!ready) return;

    if (!signedQuote || !signature) return;
    register({
      name: requestedName,
      value: registerPrice,
      quote: signedQuote,
      signature,
    });
  };

  return {
    phase,
    step,
    primaryLabel,
    errorMessage,
    approveHash: undefined,
    actionHash,
    ready,
    busy,
    primary,
  };
}
