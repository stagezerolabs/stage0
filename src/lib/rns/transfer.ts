import { getAddress, isAddress, isAddressEqual, zeroAddress, type Address, type Hex } from "viem";
import type { QueryClient } from "@tanstack/react-query";
import { clearPrimaryLabel, getPrimaryLabel } from "./primary-label";
import { removeRecentRegistration, RNS_RECENT_REGISTRATION_EVENT } from "./recent-registration";
import { normalizeRnsLabel } from "./utils";

export type RnsCustody = "wallet" | "marketplace_listing" | "marketplace_auction";

export function validateTransferRecipient(input: string, owner?: Address):
  { address: Address; error: null } | { address: null; error: string } {
  const value = input.trim();
  if (!isAddress(value, { strict: true })) return { address: null, error: "Enter a valid EVM address with a correct checksum." };
  const address = getAddress(value);
  if (isAddressEqual(address, zeroAddress)) return { address: null, error: "The zero address cannot receive a name." };
  if (owner && isAddressEqual(address, owner)) return { address: null, error: "The recipient is already the current owner." };
  return { address, error: null };
}

export function transferBlockReason(input: {
  connected: boolean;
  supportedChain: boolean;
  wallet?: Address;
  owner?: Address;
  custody: RnsCustody;
  expiry?: bigint;
  now: bigint;
}): string | null {
  if (!input.connected || !input.wallet) return "Connect your wallet to transfer this name.";
  if (!input.supportedChain) return "Switch to RISE Mainnet to transfer this name.";
  if (input.custody !== "wallet") return "This name is in marketplace escrow. Cancel its listing or auction first, if cancellation is available.";
  if (!input.owner || input.expiry === undefined) return "Checking onchain ownership and expiry…";
  if (!isAddressEqual(input.owner, input.wallet)) return "Your wallet is no longer the registry owner of this name.";
  if (input.expiry <= input.now) return "This name has expired. Renew it before transferring ownership.";
  return null;
}

/** Called only after a successful receipt AND a fresh registry ownership check. */
export async function refreshAfterVerifiedTransfer(input: {
  queryClient: QueryClient;
  sender: Address;
  recipient: Address;
  label: string;
  node: Hex;
  chainId: number;
  registry: Address;
  registrar: Address;
}) {
  const { queryClient, sender, recipient, node, chainId, registry, registrar } = input;
  const label = normalizeRnsLabel(input.label);
  if (normalizeRnsLabel(getPrimaryLabel(sender) ?? "") === label) clearPrimaryLabel(sender);
  removeRecentRegistration(sender, label);
  window.dispatchEvent(new CustomEvent(RNS_RECENT_REGISTRATION_EVENT));

  // Seed the verified registry read before refreshing discovery. Otherwise a
  // fast, still-stale index response can briefly restore the sender's old row.
  type ReadKey = { address?: string; chainId?: number; functionName?: string; args?: readonly unknown[] };
  type BatchKey = ReadKey & { contracts?: ReadKey[] };
  const isOwnerRead = (key: ReadKey) => key.address?.toLowerCase() === registry.toLowerCase() &&
    (key.chainId === undefined || key.chainId === chainId) && key.functionName === "owner" &&
    String(key.args?.[0]).toLowerCase() === node.toLowerCase();
  const ownershipReads = {
    predicate: ({ queryKey }: { queryKey: readonly unknown[] }) => {
      const key = queryKey[1] as BatchKey | undefined;
      return Boolean(key && (key.chainId === undefined || key.chainId === chainId) && (queryKey[0] === "readContract" ? isOwnerRead(key)
        : queryKey[0] === "readContracts" && key.contracts?.some(isOwnerRead)));
    },
  };
  await queryClient.cancelQueries(ownershipReads);
  for (const query of queryClient.getQueryCache().findAll(ownershipReads)) {
    const key = query.queryKey[1] as BatchKey;
    if (query.queryKey[0] === "readContract") queryClient.setQueryData(query.queryKey, recipient);
    else queryClient.setQueryData<unknown[]>(query.queryKey, (values) => values?.map((value, index) =>
      key.contracts?.[index] && isOwnerRead(key.contracts[index])
        ? typeof value === "object" ? { status: "success", result: recipient } : recipient
        : value));
  }

  // Remove only the sender's cached inventory. A subsequent indexer response is
  // still filtered against registry.owner by useRnsOwnedLabel.
  const ownerQueries = {
    predicate: (query: { queryKey: readonly unknown[] }) => {
      const key = query.queryKey;
      return key[0] === "rns" && key[2] === "domains" && key[3] === "owner" &&
        (key[1] !== "api" || key[4] === chainId) &&
        String(key[key.length - 1]).toLowerCase() === sender.toLowerCase();
    },
  };
  await queryClient.cancelQueries(ownerQueries);
  queryClient.setQueriesData<{ node: string }[]>(ownerQueries, (domains) =>
    domains?.filter((domain) => domain.node.toLowerCase() !== node.toLowerCase()));

  await queryClient.invalidateQueries({
    predicate: ({ queryKey }) => {
      if (queryKey[0] === "rns") return true;
      if (queryKey[0] !== "readContract" && queryKey[0] !== "readContracts") return false;
      const key = queryKey[1] as { address?: string; chainId?: number; contracts?: { address?: string; chainId?: number }[] } | undefined;
      if (key?.chainId !== undefined && key.chainId !== chainId) return false;
      const matches = (contract: { address?: string; chainId?: number }) =>
        (contract.chainId === undefined || contract.chainId === chainId) &&
        [registry.toLowerCase(), registrar.toLowerCase()].includes(contract.address?.toLowerCase() ?? "");
      return Boolean(key && (matches(key) || key.contracts?.some(matches)));
    },
  });
}
