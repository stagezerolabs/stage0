import { getExplorerUrl } from "@/config";
import { getRnsContractAddresses } from "@/lib/rns/addresses";
import { useChainId } from "wagmi";

export function useRnsContracts() {
  const chainId = useChainId();
  const addresses = getRnsContractAddresses(chainId);

  return {
    chainId,
    explorerUrl: getExplorerUrl(chainId),
    registry: addresses.registry,
    resolver: addresses.resolver,
    registrar: addresses.registrar,
  };
}
