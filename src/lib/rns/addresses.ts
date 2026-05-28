import { riseTestnet } from "@/config";
import type { Address } from "viem";

export type RnsContractAddresses = {
  registry: Address;
  resolver: Address;
  registrar: Address;
};

/** Deployed RNS contracts on Rise Testnet. */
export const RNS_CONTRACT_ADDRESSES: Record<number, RnsContractAddresses> = {
  [riseTestnet.id]: {
    registry: "0xa8d639540D11bd295d12a8F56DA5D2F53aBC0caF",
    resolver: "0x251c89457FbFF8930ae1D400C67E33B76498502b",
    registrar: "0x26F762137df7821369E95263f3EB556d96C4cEbB",
  },
};

export function getRnsContractAddresses(chainId?: number): RnsContractAddresses {
  const id = chainId ?? riseTestnet.id;
  return RNS_CONTRACT_ADDRESSES[id] ?? RNS_CONTRACT_ADDRESSES[riseTestnet.id];
}
