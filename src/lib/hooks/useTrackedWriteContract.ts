import { onchainLog } from '@/lib/utils/onchain-logger';
import { useEffect, useRef } from 'react';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

interface CallMeta {
  address: string;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

/**
 * Drop-in replacement for wagmi's useWriteContract + useWaitForTransactionReceipt
 * that logs every lifecycle phase to the browser console for easy onchain tracing.
 */
export function useTrackedWriteContract() {
  const {
    data: hash,
    writeContract: wagmiWriteContract,
    isPending,
    error: writeError,
    reset: wagmiReset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, error: confirmError } =
    useWaitForTransactionReceipt({ hash });

  // Keep the last call metadata across renders without re-rendering
  const metaRef = useRef<CallMeta | null>(null);

  // Wrap writeContract to log at submission time
  const writeContract: typeof wagmiWriteContract = (params) => {
    const { address, functionName, args, value } = params as {
      address: string;
      functionName: string;
      args?: readonly unknown[];
      value?: bigint;
    };
    metaRef.current = { address, functionName, args, value };
    onchainLog.submit(address, functionName, args, value);
    wagmiWriteContract(params);
  };

  useEffect(() => {
    if (hash) onchainLog.hash(hash, metaRef.current?.functionName);
  }, [hash]);

  useEffect(() => {
    if (isConfirming && hash)
      onchainLog.confirming(hash, metaRef.current?.functionName);
  }, [isConfirming, hash]);

  useEffect(() => {
    if (isSuccess && hash)
      onchainLog.success(hash, metaRef.current?.functionName);
  }, [isSuccess, hash]);

  useEffect(() => {
    const err = writeError ?? confirmError;
    if (err) onchainLog.error(metaRef.current?.functionName, err);
  }, [writeError, confirmError]);

  const reset = () => {
    onchainLog.reset(metaRef.current?.functionName);
    metaRef.current = null;
    wagmiReset();
  };

  return {
    hash,
    writeContract,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError ?? confirmError,
    reset,
    isBusy: isPending || isConfirming,
  };
}
