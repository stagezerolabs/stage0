import type { Address, Hash, Hex } from "viem";

export type RnsName = string;

export type RnsRecord = {
  name: string;
  fqdn: string;
  node: Hex;
  exists: boolean;
  owner: Address | null;
  resolver: Address | null;
  expiry?: bigint;
};

export type RnsResolvedAddress = {
  name: string;
  fqdn: string;
  node: Hex;
  resolver: Address;
  addr: Address | null;
};

export type RnsRegistrationQuote = {
  name: string;
  duration: bigint;
  price: bigint;
  available: boolean;
};

/** Registrant is `msg.sender`; optional resolver defaults to the deployed RNS resolver. */
export type RnsRegisterParams = {
  name: string;
  duration?: bigint;
  resolver?: Address;
  value?: bigint;
};

export type RnsRenewParams = {
  name: string;
  duration?: bigint;
  value?: bigint;
};

export type RnsReleaseParams = {
  name: string;
};

export type RnsSetResolverParams = {
  name: string;
  resolver: Address;
  node?: Hex;
};

export type RnsSetAddrParams = {
  name: string;
  addr: Address;
  node?: Hex;
};

export type RnsTxResult = {
  hash: Hash;
};
