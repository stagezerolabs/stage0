import { getContractAddresses, getExplorerUrl } from "@/config";
import { getRnsContractAddresses } from "@/lib/rns/addresses";
import { useChainId } from "wagmi";

export function useChainContracts() {
  const chainId = useChainId();
  const contractAddresses = getContractAddresses(chainId);
  const rns = getRnsContractAddresses(chainId);

  return {
    chainId,
    explorerUrl: getExplorerUrl(chainId),
    ...contractAddresses,
    rnsRegistry: rns.registry,
    rnsResolver: rns.resolver,
    rnsRegistrar: rns.registrar,
  };
}
