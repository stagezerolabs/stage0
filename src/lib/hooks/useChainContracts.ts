import { getContractAddresses, getExplorerUrl } from "@/config";
import { useChainId } from "wagmi";

export function useChainContracts() {
  const chainId = useChainId();
  const contractAddresses = getContractAddresses(chainId);

  return {
    chainId,
    explorerUrl: getExplorerUrl(chainId),
    ...contractAddresses,
  };
}
