import { useEffect, useMemo, useRef } from 'react';
import { useAccount, useChainId, useReadContract, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { isAddress, parseUnits, type Address } from 'viem';
import { AirdropMultiSender, erc20Abi, getContractAddresses, riseTestnet } from '@/config';
import { getFriendlyTxErrorMessage } from '@/lib/utils/tx-errors';
import type { SennaActionDraft, SignerState } from '../types';

interface Recipient {
  address: Address;
  rawAmount: string;
}

function parseRecipientCsv(raw: string): Recipient[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [addr, amount] = line.split(/[,\s]+/);
      return { address: addr as Address, rawAmount: amount ?? '0' };
    })
    .filter((r) => isAddress(r.address));
}

export function useAirdropSigner(draft: SennaActionDraft): SignerState {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();
  const onWrongChain = chainId !== riseTestnet.id;
  const contracts = getContractAddresses(chainId);

  const isNative = (draft.prefill.nativeToken || 'false') === 'true';
  const tokenAddress = !isNative && isAddress(draft.prefill.token || '') ? (draft.prefill.token as Address) : undefined;

  const recipients = useMemo(() => parseRecipientCsv(draft.prefill.recipientsData || ''), [draft.prefill.recipientsData]);

  const { data: tokenDecimals } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: 'decimals',
    query: { enabled: Boolean(tokenAddress) },
  });

  const decimals = isNative ? 18 : typeof tokenDecimals === 'number' ? tokenDecimals : 18;

  const amounts = useMemo(
    () =>
      recipients.map((r) => {
        try {
          return parseUnits(r.rawAmount.replace(/,/g, ''), decimals);
        } catch {
          return 0n;
        }
      }),
    [recipients, decimals],
  );

  const totalAmount = useMemo(() => amounts.reduce((sum, a) => sum + a, 0n), [amounts]);

  const { address: userAddress } = useAccount();
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: 'allowance',
    args: userAddress && tokenAddress ? [userAddress, contracts.airdropMultisender] : undefined,
    query: { enabled: Boolean(userAddress && tokenAddress) },
  });

  const needsApproval = !isNative && (allowance === undefined || (allowance as bigint) < totalAmount);

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

  const chainedRef = useRef(false);
  useEffect(() => {
    if (!approveSuccess || chainedRef.current) return;
    if (isNative || !tokenAddress) return;
    chainedRef.current = true;
    refetchAllowance();
    writeAction({
      abi: AirdropMultiSender,
      address: contracts.airdropMultisender,
      functionName: 'sendERC20',
      args: [tokenAddress, recipients.map((r) => r.address), amounts],
    });
  }, [
    approveSuccess,
    isNative,
    tokenAddress,
    recipients,
    amounts,
    contracts.airdropMultisender,
    refetchAllowance,
    writeAction,
  ]);

  const errorMessage =
    approveError ? getFriendlyTxErrorMessage(approveError, 'Approve') :
    actionError ? getFriendlyTxErrorMessage(actionError, 'Airdrop') :
    actionReceiptError && actionReceiptErrorObj ? getFriendlyTxErrorMessage(actionReceiptErrorObj, 'Airdrop') :
    '';

  const fireApprove = () => {
    if (!tokenAddress) return;
    chainedRef.current = false;
    writeApprove({
      abi: erc20Abi,
      address: tokenAddress,
      functionName: 'approve',
      args: [contracts.airdropMultisender, totalAmount],
    });
  };

  const fireSend = () => {
    if (isNative) {
      writeAction({
        abi: AirdropMultiSender,
        address: contracts.airdropMultisender,
        functionName: 'sendETH',
        args: [recipients.map((r) => r.address), amounts],
        value: totalAmount,
      });
    } else if (tokenAddress) {
      writeAction({
        abi: AirdropMultiSender,
        address: contracts.airdropMultisender,
        functionName: 'sendERC20',
        args: [tokenAddress, recipients.map((r) => r.address), amounts],
      });
    }
  };

  let phase: SignerState['phase'] = 'idle';
  let primaryLabel = isNative ? 'Sign & Airdrop' : 'Sign & Airdrop';
  let step: SignerState['step'] | undefined;
  let busy = false;
  let ready = (isNative || Boolean(tokenAddress)) && recipients.length > 0 && totalAmount > 0n;

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
    primaryLabel = 'Sign airdrop in wallet…';
    step = 'action';
    busy = true;
  } else if (actionConfirming) {
    phase = 'confirming';
    primaryLabel = needsApproval ? '2/2 Sending…' : 'Sending…';
    step = 'action';
    busy = true;
  } else if (isSuccess) {
    phase = 'success';
    primaryLabel = 'Airdrop sent';
  } else if (errorMessage) {
    phase = 'error';
    primaryLabel = 'Try again';
  } else if (needsApproval) {
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
      fireSend();
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
