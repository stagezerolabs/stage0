import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAccount } from "@wagmi/core";
import { isAddressEqual, type Address } from "viem";
import { useAccount, useConfig, useSignMessage } from "wagmi";
import { riseMainnet } from "@/config";
import { fetchRnsPrimaryNameForAddress, fetchRnsPrimaryAuthorization, saveRnsPrimaryName } from "@/lib/api/rns";
import { normalizeRnsLabel } from "@/lib/rns/utils";
import { setPrimaryLabel } from "@/lib/rns/primary-label";
import { toast } from "sonner";

export function useRnsPrimaryName(address?: Address) {
  return useQuery({
    queryKey: ["rns", "api", "primary", riseMainnet.id, address?.toLowerCase()],
    queryFn: () => fetchRnsPrimaryNameForAddress({ address: address!, chainId: riseMainnet.id }),
    enabled: Boolean(address),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useSetRnsPrimaryName() {
  const { address, chainId, isConnected } = useAccount();
  const config = useConfig();
  const { signMessageAsync } = useSignMessage();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!address || !isConnected || chainId !== riseMainnet.id) throw new Error("Connect your wallet on RISE Mainnet first.");
      const label = normalizeRnsLabel(name);
      const authorization = await fetchRnsPrimaryAuthorization({ address, name: label, chainId });
      if (!isAddressEqual(authorization.address, address) || authorization.name !== label || authorization.chainId !== chainId) throw new Error("Invalid primary-name authorization. Please retry.");
      const checkWallet = () => {
        const current = getAccount(config);
        if (!current.isConnected || !current.address || !isAddressEqual(current.address, address) || current.chainId !== chainId) throw new Error("Your wallet changed. Please select your primary name again.");
      };
      checkWallet();
      const signature = await signMessageAsync({ account: address, message: authorization.message });
      checkWallet();
      const result = await saveRnsPrimaryName({ ...authorization, signature });
      // This is now a cache of an acknowledged server write, never the source
      // for primary lookup. Keep it for existing transfer cleanup compatibility.
      setPrimaryLabel(address, label);
      await queryClient.invalidateQueries({ queryKey: ["rns"] });
      return result;
    },
    onSuccess: (result) => toast.success(`${result.primaryName} is now your public primary name.`),
    onError: (error) => toast.error(error.message.split("\n")[0] || "Could not update your primary name."),
  });
}
