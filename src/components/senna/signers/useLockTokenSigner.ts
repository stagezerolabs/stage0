import { useEffect, useMemo, useRef } from 'react';
import { useAccount, useChainId, useReadContract, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { isAddress, maxUint256, parseUnits, type Address } from 'viem';
import { TokenLocker, erc20Abi, getContractAddresses, riseTestnet } from '@/config';
import { getFriendlyTxErrorMessage } from '@/lib/utils/tx-errors';
import type { SennaActionDraft, SignerState } from '../types';

export function useLockTokenSigner(draft: SennaActionDraft): SignerState {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();
  const onWrongChain = chainId !== riseTestnet.id;
  const contracts = getContractAddresses(chainId);

  const tokenAddress = isAddress(draft.prefill.token || '') ? (draft.prefill.token as Address) : undefined;
  const durationDays = Number.parseInt(draft.prefill.duration || '0', 10);
  const lockName = draft.prefill.name || 'Token Lock';
  const lockDescription = draft.prefill.description || lockName;

  const { data: tokenDecimals } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: 'decimals',
    query: { enabled: Boolean(tokenAddress) },
  });

  const decimals = typeof tokenDecimals === 'number' ? tokenDecimals : 18;
  const parsedAmount = useMemo(() => {
    if (!draft.prefill.amount) return null;
    try {
      return parseUnits(draft.prefill.amount, decimals);
    } catch {
      return null;
    }
  }, [draft.prefill.amount, decimals]);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: 'allowance',
    args: address && tokenAddress ? [address, contracts.tokenLocker] : undefined,
    query: { enabled: Boolean(address && tokenAddress) },
  });

  const needsApproval = useMemo(() => {
    if (!parsedAmount) return false;
    if (allowance === undefined) return true;
    return (allowance as bigint) < parsedAmount;
  }, [allowance, parsedAmount]);

  const {
    data: approveHash,
    writeContract: writeApprove,
    isPending: approvePending,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract();

  const {
    isLoading: approveConfirming,
    isSuccess: approveSuccess,
  } = useWaitForTransactionReceipt({ hash: approveHash });

  const {
    data: actionHash,
    writeContract: writeAction,
    isPending: actionPending,
    error: actionError,
    reset: resetAction,
  } = useWriteContract();

  const {
    isLoading: actionConfirming,
    isSuccess,
    isError: actionReceiptError,
    error: actionReceiptErrorObj,
  } = useWaitForTransactionReceipt({ hash: actionHash });

  // Auto-chain: when approve confirms, fire the lock.
  const chainedRef = useRef(false);
  useEffect(() => {
    if (!approveSuccess || chainedRef.current) return;
    if (!parsedAmount || !tokenAddress) return;
    chainedRef.current = true;
    refetchAllowance();
    writeAction({
      abi: TokenLocker,
      address: contracts.tokenLocker,
      functionName: 'lockTokens',
      args: [tokenAddress, parsedAmount, BigInt(durationDays) * 86400n, lockName, lockDescription],
    });
  }, [
    approveSuccess,
    parsedAmount,
    tokenAddress,
    durationDays,
    lockName,
    lockDescription,
    contracts.tokenLocker,
    refetchAllowance,
    writeAction,
  ]);

  const errorMessage =
    approveError ? getFriendlyTxErrorMessage(approveError, 'Approve') :
    actionError ? getFriendlyTxErrorMessage(actionError, 'Lock') :
    actionReceiptError && actionReceiptErrorObj ? getFriendlyTxErrorMessage(actionReceiptErrorObj, 'Lock') :
    '';

  const fireApprove = () => {
    if (!tokenAddress) return;
    chainedRef.current = false;
    writeApprove({
      abi: erc20Abi,
      address: tokenAddress,
      functionName: 'approve',
      args: [contracts.tokenLocker, maxUint256],
    });
  };

  const fireLock = () => {
    if (!tokenAddress || !parsedAmount) return;
    writeAction({
      abi: TokenLocker,
      address: contracts.tokenLocker,
      functionName: 'lockTokens',
      args: [tokenAddress, parsedAmount, BigInt(durationDays) * 86400n, lockName, lockDescription],
    });
  };

  let phase: SignerState['phase'] = 'idle';
  let primaryLabel = 'Sign & Lock';
  let step: SignerState['step'] | undefined;
  let busy = false;
  let ready = Boolean(tokenAddress && parsedAmount && durationDays > 0);

  if (!isConnected) {
    phase = 'needs_wallet';
    primaryLabel = 'Connect Wallet';
    ready = false;
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
    primaryLabel = '1/2 Approving…';
    step = 'approve';
    busy = true;
  } else if (actionPending) {
    phase = 'awaiting_signature';
    primaryLabel = 'Sign lock in wallet…';
    step = 'action';
    busy = true;
  } else if (actionConfirming) {
    phase = 'confirming';
    primaryLabel = needsApproval ? '2/2 Locking…' : 'Locking…';
    step = 'action';
    busy = true;
  } else if (isSuccess) {
    phase = 'success';
    primaryLabel = 'Lock complete';
  } else if (errorMessage) {
    phase = 'error';
    primaryLabel = 'Try again';
  } else if (needsApproval) {
    primaryLabel = 'Sign & Lock';
    step = 'approve';
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
      fireApprove();
    } else {
      fireLock();
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
