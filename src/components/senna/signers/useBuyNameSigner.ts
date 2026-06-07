import { useEffect, useRef } from 'react';
import { useAccount, useChainId, useSwitchChain, useWaitForTransactionReceipt } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { riseTestnet } from '@/config';
import {
  useRnsApproveForAll,
  useRnsIsApproved,
  useRnsNameStatus,
  useRnsRegister,
  useRnsRegistrationQuote,
} from '@/lib/hooks/rns';
import { RESERVED_NAMES } from '@/lib/rns/constants';
import { saveRecentRegistration } from '@/lib/rns/recent-registration';
import { normalizeRnsLabel, rnsNamehash } from '@/lib/rns/utils';
import { getFriendlyTxErrorMessage } from '@/lib/utils/tx-errors';
import type { SennaActionDraft, SignerState } from '../types';

export function useBuyNameSigner(draft: SennaActionDraft): SignerState {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();
  const queryClient = useQueryClient();
  const onWrongChain = chainId !== riseTestnet.id;

  const requestedName = normalizeRnsLabel(draft.prefill.name || '');
  const reserved = RESERVED_NAMES.has(requestedName);

  const { available, isLoading: statusLoading } = useRnsNameStatus(requestedName, {
    enabled: Boolean(requestedName) && !reserved,
  });

  const { price: registerPrice = 0n } = useRnsRegistrationQuote(requestedName, {
    enabled: Boolean(requestedName) && available && !reserved,
  });

  const { isApproved } = useRnsIsApproved(address);
  const { approve, hash: approveHash, isPending: approvePending, error: approveError, reset: resetApprove } = useRnsApproveForAll();
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });

  const {
    register,
    hash: actionHash,
    isPending: actionPending,
    isConfirming: actionConfirming,
    isSuccess,
    error: actionError,
    reset: resetAction,
  } = useRnsRegister();

  const chainedRef = useRef(false);
  useEffect(() => {
    if (!approveSuccess || chainedRef.current) return;
    if (!requestedName || !available || reserved) return;
    chainedRef.current = true;
    register({ name: requestedName, value: registerPrice });
  }, [approveSuccess, requestedName, available, reserved, register, registerPrice]);

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
    queryClient.invalidateQueries({ queryKey: ['rns', 'api', 'domains', 'owner'] });
    queryClient.invalidateQueries({ queryKey: ['rns', 'subgraph', 'domains', 'owner'] });
  }, [isSuccess, address, requestedName, queryClient]);

  const errorMessage =
    reserved ? 'That name is reserved.' :
    requestedName && !statusLoading && available === false ? 'That name is already taken.' :
    approveError ? getFriendlyTxErrorMessage(approveError, 'Approve') :
    actionError ? getFriendlyTxErrorMessage(actionError, 'Register') :
    '';

  const ready = Boolean(requestedName) && available === true && !reserved;
  const needsApproval = !isApproved;

  let phase: SignerState['phase'] = 'idle';
  let primaryLabel = needsApproval ? 'Sign & Register' : 'Sign & Register';
  let step: SignerState['step'] | undefined = needsApproval ? 'approve' : undefined;
  let busy = false;

  if (!isConnected) {
    phase = 'needs_wallet';
    primaryLabel = 'Connect Wallet';
  } else if (onWrongChain) {
    phase = 'needs_chain';
    primaryLabel = switching ? 'Switching to RISE…' : 'Switch to RISE Testnet';
    busy = switching;
  } else if (approvePending) {
    phase = 'awaiting_signature';
    primaryLabel = 'Sign approval in wallet…';
    step = 'approve';
    busy = true;
  } else if (approveConfirming) {
    phase = 'approving';
    primaryLabel = '1/2 Approving registry…';
    step = 'approve';
    busy = true;
  } else if (actionPending) {
    phase = 'awaiting_signature';
    primaryLabel = 'Sign register in wallet…';
    step = 'action';
    busy = true;
  } else if (actionConfirming) {
    phase = 'confirming';
    primaryLabel = needsApproval ? `2/2 Registering ${requestedName}…` : `Registering ${requestedName}…`;
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
      resetApprove();
      resetAction();
      chainedRef.current = false;
    }
    if (!isConnected) return;
    if (onWrongChain) {
      switchChain({ chainId: riseTestnet.id });
      return;
    }
    if (!ready) return;

    if (needsApproval) {
      approve();
    } else {
      register({ name: requestedName, value: registerPrice });
    }
  };

  return {
    phase,
    step,
    primaryLabel,
    errorMessage,
    approveHash,
    actionHash,
    ready,
    busy,
    primary,
  };
}
