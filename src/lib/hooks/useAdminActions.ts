import { LaunchpadPresaleContract, PresaleFactory } from '@/config';
import { useChainContracts } from '@/lib/hooks/useChainContracts';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import type { Address } from 'viem';

/**
 * Hook for factory owner to manage whitelisted creators
 */
export function useSetWhitelistedCreator() {
  const { presaleFactory } = useChainContracts();
  const {
    writeContract,
    data: hash,
    isPending,
    isError,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const addWhitelistedCreator = (creatorAddress: Address) => {
    writeContract({
      address: presaleFactory,
      abi: PresaleFactory,
      functionName: 'setWhitelistedCreator',
      args: [creatorAddress, true],
    });
  };

  return {
    addWhitelistedCreator,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    isError,
    error,
    reset,
    isBusy: isPending || isConfirming,
  };
}

/**
 * Hook for factory owner to remove whitelisted creators
 */
export function useRemoveWhitelistedCreator() {
  const { presaleFactory } = useChainContracts();
  const {
    writeContract,
    data: hash,
    isPending,
    isError,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const removeWhitelistedCreator = (creatorAddress: Address) => {
    writeContract({
      address: presaleFactory,
      abi: PresaleFactory,
      functionName: 'setWhitelistedCreator',
      args: [creatorAddress, false],
    });
  };

  return {
    removeWhitelistedCreator,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    isError,
    error,
    reset,
    isBusy: isPending || isConfirming,
  };
}

/**
 * Hook for factory owner to update fee recipient
 */
export function useSetFeeRecipient() {
  const { presaleFactory } = useChainContracts();
  const {
    writeContract,
    data: hash,
    isPending,
    isError,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const setFeeRecipient = (newRecipient: Address) => {
    writeContract({
      address: presaleFactory,
      abi: PresaleFactory,
      functionName: 'setFeeRecipient',
      args: [newRecipient],
    });
  };

  return {
    setFeeRecipient,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    isError,
    error,
    reset,
    isBusy: isPending || isConfirming,
  };
}

/**
 * Hook for fee recipient to update fees on a specific presale
 */
export function useUpdatePresaleFees() {
  const {
    writeContract,
    data: hash,
    isPending,
    isError,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const updateFees = (
    presaleAddress: Address,
    newTokenFeeBps: number,
    newProceedsFeeBps: number
  ) => {
    writeContract({
      address: presaleAddress,
      abi: LaunchpadPresaleContract,
      functionName: 'updateFees',
      args: [BigInt(newTokenFeeBps), BigInt(newProceedsFeeBps)],
    });
  };

  return {
    updateFees,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    isError,
    error,
    reset,
    isBusy: isPending || isConfirming,
  };
}
