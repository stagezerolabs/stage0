import { riseMainnet } from "@/config";
import { RNSRegistrar, RNSRegistry, RNSResolver } from "@/lib/rns/abis";
import { resolverUpdateBlockReason } from "@/lib/rns/resolver-update";
import type { RnsCustody } from "@/lib/rns/transfer";
import { useEffect, useState } from "react";
import { isAddress, isAddressEqual, zeroAddress, type Address, type Hex } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { useRnsContracts } from "./useRnsContracts";

type NameCandidate = {
  node: Hex; label: string; registrant?: Address | null; custody?: RnsCustody;
};

/** Only show an address-update action when a received name actually needs it.
 * Registration history comes from the index; current state is checked onchain
 * in one background batch shared by the owned cards and incoming notices.
 */
export function useRnsWalletAddressUpdates(names: readonly NameCandidate[]) {
  const { address, isConnected, chainId } = useAccount();
  const { registry, registrar, resolver } = useRnsContracts();
  const supported = isConnected && Boolean(address) && chainId === riseMainnet.id;
  const [now, setNow] = useState(() => BigInt(Math.floor(Date.now() / 1000)));
  useEffect(() => {
    if (!supported || names.length === 0) return;
    const timer = window.setInterval(() => setNow(BigInt(Math.floor(Date.now() / 1000))), 15_000);
    return () => window.clearInterval(timer);
  }, [supported, names.length]);
  const candidates = supported ? names.filter(name =>
    (name.custody ?? "wallet") === "wallet" && name.label &&
    name.registrant && isAddress(name.registrant) &&
    !isAddressEqual(name.registrant, zeroAddress) &&
    !isAddressEqual(name.registrant, address!)) : [];

  const { data, isError } = useReadContracts({
    contracts: candidates.flatMap(name => [
      { chainId: riseMainnet.id, address: registry, abi: RNSRegistry, functionName: "owner", args: [name.node] },
      { chainId: riseMainnet.id, address: registry, abi: RNSRegistry, functionName: "resolver", args: [name.node] },
      { chainId: riseMainnet.id, address: resolver, abi: RNSResolver, functionName: "addr", args: [name.node] },
      { chainId: riseMainnet.id, address: registrar, abi: RNSRegistrar, functionName: "expiryOf", args: [name.label] },
    ] as const),
    query: { enabled: candidates.length > 0, staleTime: 0, refetchInterval: 15_000 },
  });

  const needsUpdate = new Set<string>();
  if (!data || isError || !supported) return needsUpdate;
  candidates.forEach((name, index) => {
    const results = data.slice(index * 4, index * 4 + 4);
    if (results.length !== 4 || results.some(result => result.status !== "success")) return;
    const [owner, currentResolver, resolvedAddress, expiry] = results.map(result => result.result);
    if (typeof owner !== "string" || !isAddress(owner) ||
        typeof currentResolver !== "string" || !isAddress(currentResolver) ||
        typeof resolvedAddress !== "string" || !isAddress(resolvedAddress) || typeof expiry !== "bigint") return;
    const blocked = resolverUpdateBlockReason({
      connected: isConnected, supportedChain: supported, wallet: address,
      owner, resolver: currentResolver, expectedResolver: resolver, resolvedAddress,
      expiry, custody: name.custody ?? "wallet", now,
    });
    if (!blocked) needsUpdate.add(name.node.toLowerCase());
  });
  return needsUpdate;
}
