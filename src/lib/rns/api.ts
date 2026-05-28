import { RNSRegistrar, RNSRegistry, RNSResolver } from "@/lib/rns/abis";
import { getRnsContractAddresses } from "@/lib/rns/addresses";
import { RNS_DEFAULT_REGISTRATION_DURATION } from "@/lib/rns/constants";
import type {
  RnsRecord,
  RnsRegisterParams,
  RnsRegistrationQuote,
  RnsReleaseParams,
  RnsRenewParams,
  RnsResolvedAddress,
  RnsSetAddrParams,
  RnsSetResolverParams,
} from "@/lib/rns/types";
import { normalizeRnsLabel, rnsLabelhash, toRnsFqdn } from "@/lib/rns/utils";
import {
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
  type WalletClient,
  zeroAddress,
} from "viem";

// ---------------------------------------------------------------------------
// Node helpers
// ---------------------------------------------------------------------------

export async function rnsGetRiseNode(
  client: PublicClient,
  chainId: number,
): Promise<Hex> {
  const { registrar } = getRnsContractAddresses(chainId);
  return client.readContract({
    address: registrar,
    abi: RNSRegistrar,
    functionName: "riseNode",
  });
}

export async function rnsGetNode(
  client: PublicClient,
  chainId: number,
  label: string,
): Promise<Hex> {
  const { registry } = getRnsContractAddresses(chainId);
  const riseNode = await rnsGetRiseNode(client, chainId);
  const normalized = normalizeRnsLabel(label);
  return client.readContract({
    address: registry,
    abi: RNSRegistry,
    functionName: "computeNode",
    args: [riseNode, rnsLabelhash(normalized)],
  });
}

// ---------------------------------------------------------------------------
// Registry reads
// ---------------------------------------------------------------------------

export async function rnsGetOwner(
  client: PublicClient,
  chainId: number,
  label: string,
): Promise<Address | null> {
  const { registry } = getRnsContractAddresses(chainId);
  const node = await rnsGetNode(client, chainId, label);
  const owner = await client.readContract({
    address: registry,
    abi: RNSRegistry,
    functionName: "owner",
    args: [node],
  });
  if (!owner || owner === zeroAddress) return null;
  return owner;
}

export async function rnsGetResolver(
  client: PublicClient,
  chainId: number,
  label: string,
): Promise<Address | null> {
  const { registry } = getRnsContractAddresses(chainId);
  const node = await rnsGetNode(client, chainId, label);
  const resolver = await client.readContract({
    address: registry,
    abi: RNSRegistry,
    functionName: "resolver",
    args: [node],
  });
  if (!resolver || resolver === zeroAddress) return null;
  return resolver;
}

export async function rnsRecordExists(
  client: PublicClient,
  chainId: number,
  label: string,
): Promise<boolean> {
  const { registry } = getRnsContractAddresses(chainId);
  const node = await rnsGetNode(client, chainId, label);
  return client.readContract({
    address: registry,
    abi: RNSRegistry,
    functionName: "recordExists",
    args: [node],
  });
}

export async function rnsGetExpiry(
  client: PublicClient,
  chainId: number,
  label: string,
): Promise<bigint> {
  const { registrar } = getRnsContractAddresses(chainId);
  const name = normalizeRnsLabel(label);
  return client.readContract({
    address: registrar,
    abi: RNSRegistrar,
    functionName: "expiryOf",
    args: [name],
  });
}

export async function rnsGetRecord(
  client: PublicClient,
  chainId: number,
  label: string,
): Promise<RnsRecord> {
  const normalized = normalizeRnsLabel(label);
  const fqdn = toRnsFqdn(normalized);
  const node = await rnsGetNode(client, chainId, normalized);
  const [exists, owner, resolver, expiry] = await Promise.all([
    rnsRecordExists(client, chainId, normalized),
    rnsGetOwner(client, chainId, normalized),
    rnsGetResolver(client, chainId, normalized),
    rnsGetExpiry(client, chainId, normalized),
  ]);
  return {
    name: normalized,
    fqdn,
    node,
    exists,
    owner,
    resolver,
    expiry,
  };
}

// ---------------------------------------------------------------------------
// Resolver reads
// ---------------------------------------------------------------------------

export async function rnsResolveAddr(
  client: PublicClient,
  chainId: number,
  label: string,
  resolverAddress?: Address,
): Promise<RnsResolvedAddress> {
  const normalized = normalizeRnsLabel(label);
  const fqdn = toRnsFqdn(normalized);
  const node = await rnsGetNode(client, chainId, normalized);
  const resolver =
    resolverAddress ?? (await rnsGetResolver(client, chainId, normalized));

  if (!resolver) {
    return { name: normalized, fqdn, node, resolver: zeroAddress, addr: null };
  }

  const addr = await client.readContract({
    address: resolver,
    abi: RNSResolver,
    functionName: "addr",
    args: [node],
  });

  return {
    name: normalized,
    fqdn,
    node,
    resolver,
    addr: addr && addr !== zeroAddress ? addr : null,
  };
}

export async function rnsGetText(
  client: PublicClient,
  resolver: Address,
  label: string,
  key: string,
  chainId: number,
): Promise<string> {
  const node = await rnsGetNode(client, chainId, label);
  return client.readContract({
    address: resolver,
    abi: RNSResolver,
    functionName: "text",
    args: [node, key],
  });
}

// ---------------------------------------------------------------------------
// Registrar reads
// ---------------------------------------------------------------------------

export async function rnsIsAvailable(
  client: PublicClient,
  chainId: number,
  label: string,
): Promise<boolean> {
  const { registrar } = getRnsContractAddresses(chainId);
  const name = normalizeRnsLabel(label);
  return client.readContract({
    address: registrar,
    abi: RNSRegistrar,
    functionName: "available",
    args: [name],
  });
}

export async function rnsGetFee(
  client: PublicClient,
  chainId: number,
  duration: bigint = RNS_DEFAULT_REGISTRATION_DURATION,
): Promise<bigint> {
  const { registrar } = getRnsContractAddresses(chainId);
  return client.readContract({
    address: registrar,
    abi: RNSRegistrar,
    functionName: "feeFor",
    args: [duration],
  });
}

/** @deprecated Use `rnsGetFee` — kept as alias for older call sites. */
export const rnsGetRentPrice = rnsGetFee;

export async function rnsGetRegistrationQuote(
  client: PublicClient,
  chainId: number,
  label: string,
  duration: bigint = RNS_DEFAULT_REGISTRATION_DURATION,
): Promise<RnsRegistrationQuote> {
  const name = normalizeRnsLabel(label);
  const [available, price] = await Promise.all([
    rnsIsAvailable(client, chainId, name),
    rnsGetFee(client, chainId, duration),
  ]);
  return { name, duration, price, available };
}

// ---------------------------------------------------------------------------
// Writes (wallet client)
// ---------------------------------------------------------------------------

export async function rnsRegister(
  walletClient: WalletClient,
  readClient: PublicClient,
  chainId: number,
  params: RnsRegisterParams,
): Promise<Hash> {
  const { registrar, resolver: defaultResolver } = getRnsContractAddresses(chainId);
  const name = normalizeRnsLabel(params.name);
  const duration = params.duration ?? RNS_DEFAULT_REGISTRATION_DURATION;
  const resolver = params.resolver ?? defaultResolver;
  const value = params.value ?? (await rnsGetFee(readClient, chainId, duration));

  return walletClient.writeContract({
    chain: walletClient.chain,
    account: walletClient.account!,
    address: registrar,
    abi: RNSRegistrar,
    functionName: "register",
    args: [name, duration, resolver],
    value,
  });
}

export async function rnsRenew(
  walletClient: WalletClient,
  readClient: PublicClient,
  chainId: number,
  params: RnsRenewParams,
): Promise<Hash> {
  const { registrar } = getRnsContractAddresses(chainId);
  const name = normalizeRnsLabel(params.name);
  const duration = params.duration ?? RNS_DEFAULT_REGISTRATION_DURATION;
  const value = params.value ?? (await rnsGetFee(readClient, chainId, duration));

  return walletClient.writeContract({
    chain: walletClient.chain,
    account: walletClient.account!,
    address: registrar,
    abi: RNSRegistrar,
    functionName: "renew",
    args: [name, duration],
    value,
  });
}

export async function rnsRelease(
  walletClient: WalletClient,
  chainId: number,
  params: RnsReleaseParams,
): Promise<Hash> {
  const { registrar } = getRnsContractAddresses(chainId);
  const name = normalizeRnsLabel(params.name);

  return walletClient.writeContract({
    chain: walletClient.chain,
    account: walletClient.account!,
    address: registrar,
    abi: RNSRegistrar,
    functionName: "release",
    args: [name],
  });
}

export async function rnsSetResolver(
  walletClient: WalletClient,
  chainId: number,
  params: RnsSetResolverParams,
  readClient?: PublicClient,
): Promise<Hash> {
  const { registry } = getRnsContractAddresses(chainId);
  const node =
    params.node ??
    (readClient
      ? await rnsGetNode(readClient, chainId, params.name)
      : (() => {
        throw new Error("readClient required when node is not provided");
      })());

  return walletClient.writeContract({
    chain: walletClient.chain,
    account: walletClient.account!,
    address: registry,
    abi: RNSRegistry,
    functionName: "setResolver",
    args: [node, params.resolver],
  });
}

export async function rnsSetAddr(
  walletClient: WalletClient,
  readClient: PublicClient,
  chainId: number,
  params: RnsSetAddrParams,
  resolverAddress?: Address,
): Promise<Hash> {
  const node =
    params.node ?? (await rnsGetNode(readClient, chainId, params.name));
  const resolver =
    resolverAddress ?? (await rnsGetResolver(readClient, chainId, params.name));

  if (!resolver) {
    throw new Error("No resolver set for this name.");
  }

  return walletClient.writeContract({
    chain: walletClient.chain,
    account: walletClient.account!,
    address: resolver,
    abi: RNSResolver,
    functionName: "setAddr",
    args: [node, params.addr],
  });
}

export async function rnsSetText(
  walletClient: WalletClient,
  readClient: PublicClient,
  chainId: number,
  label: string,
  key: string,
  value: string,
  resolverAddress?: Address,
): Promise<Hash> {
  const node = await rnsGetNode(readClient, chainId, label);
  const resolver =
    resolverAddress ?? (await rnsGetResolver(readClient, chainId, label));

  if (!resolver) {
    throw new Error("No resolver set for this name.");
  }

  return walletClient.writeContract({
    chain: walletClient.chain,
    account: walletClient.account!,
    address: resolver,
    abi: RNSResolver,
    functionName: "setText",
    args: [node, key, value],
  });
}

export async function rnsSetPrimaryAddr(
  walletClient: WalletClient,
  readClient: PublicClient,
  chainId: number,
  label: string,
  addr: Address,
): Promise<Hash> {
  return rnsSetAddr(walletClient, readClient, chainId, { name: label, addr });
}

/** @deprecated Use `rnsGetNode` */
export async function rnsNodeForLabel(
  client: PublicClient,
  chainId: number,
  label: string,
): Promise<Hex> {
  return rnsGetNode(client, chainId, label);
}
