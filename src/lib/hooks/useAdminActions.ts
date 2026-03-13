import { LaunchpadPresaleContract, NFTFactory, PresaleFactory } from '@/config';
import { useChainContracts } from '@/lib/hooks/useChainContracts';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import type { Abi, Address } from 'viem';

type FactoryTarget = 'presale' | 'nft';

function useFactoryWriteConfig(target: FactoryTarget) {
  const { presaleFactory, nftFactory } = useChainContracts();

  if (target === 'nft') {
    return {
      address: nftFactory,
      abi: NFTFactory as Abi,
    };
  }

  return {
    address: presaleFactory,
    abi: PresaleFactory as Abi,
  };
}

function useContractWriteState() {
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

  return {
    writeContract,
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
 * Hook for factory owner to manage whitelisted creators.
 */
export function useSetWhitelistedCreator() {
  const { presaleFactory } = useChainContracts();
  const contractState = useContractWriteState();

  const addWhitelistedCreator = (creatorAddress: Address) => {
    contractState.writeContract({
      address: presaleFactory,
      abi: PresaleFactory,
      functionName: 'setWhitelistedCreator',
      args: [creatorAddress, true],
    });
  };

  return {
    addWhitelistedCreator,
    ...contractState,
  };
}

/**
 * Hook for factory owner to remove whitelisted creators.
 */
export function useRemoveWhitelistedCreator() {
  const { presaleFactory } = useChainContracts();
  const contractState = useContractWriteState();

  const removeWhitelistedCreator = (creatorAddress: Address) => {
    contractState.writeContract({
      address: presaleFactory,
      abi: PresaleFactory,
      functionName: 'setWhitelistedCreator',
      args: [creatorAddress, false],
    });
  };

  return {
    removeWhitelistedCreator,
    ...contractState,
  };
}

/**
 * Hook for factory owner to update a factory fee recipient.
 */
export function useSetFeeRecipient(target: FactoryTarget = 'presale') {
  const { address, abi } = useFactoryWriteConfig(target);
  const contractState = useContractWriteState();

  const setFeeRecipient = (newRecipient: Address) => {
    contractState.writeContract({
      address,
      abi,
      functionName: 'setFeeRecipient',
      args: [newRecipient],
    });
  };

  return {
    setFeeRecipient,
    ...contractState,
  };
}

/**
 * Hook for NFT factory owner to update the default proceeds fee.
 */
export function useSetNFTFactoryProceedsFeeBps() {
  const { nftFactory } = useChainContracts();
  const contractState = useContractWriteState();

  const setProceedsFeeBps = (newProceedsFeeBps: number) => {
    contractState.writeContract({
      address: nftFactory,
      abi: NFTFactory,
      functionName: 'setProceedsFeeBps',
      args: [BigInt(newProceedsFeeBps)],
    });
  };

  return {
    setProceedsFeeBps,
    ...contractState,
  };
}

/**
 * Hook for fee recipient to update fees on a specific presale.
 */
export function useUpdatePresaleFees() {
  const contractState = useContractWriteState();

  const updateFees = (
    presaleAddress: Address,
    newTokenFeeBps: number,
    newProceedsFeeBps: number
  ) => {
    contractState.writeContract({
      address: presaleAddress,
      abi: LaunchpadPresaleContract,
      functionName: 'updateFees',
      args: [BigInt(newTokenFeeBps), BigInt(newProceedsFeeBps)],
    });
  };

  return {
    updateFees,
    ...contractState,
  };
}
