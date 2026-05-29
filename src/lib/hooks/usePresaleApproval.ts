import { onchainLog } from "@/lib/utils/onchain-logger";
import { useMemo } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { erc20Abi } from "@/config";
import { type Address, maxUint256 } from "viem";

export function usePresaleApproval({
  presaleAddress,
  paymentToken,
  amount,
  isPaymentETH,
}: {
  presaleAddress: Address;
  paymentToken: { address: Address; decimals: number };
  amount: bigint;
  isPaymentETH: boolean;
}) {
  const { address } = useAccount();

  const {
    data: allowance,
    refetch,
    isLoading: isAllowanceLoading,
  } = useReadContract({
    address: paymentToken.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, presaleAddress] : undefined,
    query: {
      enabled: Boolean(address && !isPaymentETH),
    },
  });

  const { isPending: isApproveLoading, writeContractAsync: approveAsync } =
    useWriteContract();

  const needsApproval = useMemo(() => {
    if (isPaymentETH || amount === 0n || allowance === undefined) return false;
    return allowance < amount;
  }, [allowance, amount, isPaymentETH]);

  const approve = async () => {
    if (!paymentToken.address) return;

    onchainLog.submit(paymentToken.address, "approve", [presaleAddress, maxUint256]);

    try {
      const hash = await approveAsync({
        address: paymentToken.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [presaleAddress, maxUint256],
      });

      if (hash) {
        onchainLog.hash(hash, "approve");
        refetch();
      }
    } catch (error) {
      onchainLog.error("approve", error);
    }
  };

  return {
    needsApproval,
    approve,
    isApproving: isApproveLoading || isAllowanceLoading,
    refetchAllowance: refetch,
  };
}
