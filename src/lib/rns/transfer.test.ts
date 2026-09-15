import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { getAddress, zeroAddress, type Address } from "viem";
import { refreshAfterVerifiedTransfer, transferBlockReason, validateTransferRecipient } from "./transfer";
import { getPrimaryLabel, setPrimaryLabel } from "./primary-label";
import { getRecentRegistrations, saveRecentRegistration } from "./recent-registration";
import { rnsNamehash } from "./utils";

const sender = "0x1111111111111111111111111111111111111111" as Address;
const target = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address;
const registry = "0x2222222222222222222222222222222222222222" as Address;
const node = rnsNamehash("alice");
beforeEach(() => localStorage.clear());

describe("transfer recipient validation", () => {
  it("accepts and checksums a valid recipient", () => {
    expect(validateTransferRecipient(` ${target} `, sender)).toEqual({ address: getAddress(target), error: null });
  });
  it.each(["", "alice.rise", "0x1234", "not an address", "0xAbcdefabcdefabcdefabcdefabcdefabcdefabcd"])("rejects malformed/checksum-invalid input %s", (input) => {
    expect(validateTransferRecipient(input, sender).address).toBeNull();
  });
  it("rejects zero address and current owner", () => {
    expect(validateTransferRecipient(zeroAddress, sender).error).toMatch(/zero address/);
    expect(validateTransferRecipient(getAddress(target), target).error).toMatch(/already/);
  });
});

describe("transfer eligibility", () => {
  const eligible = { connected: true, supportedChain: true, wallet: sender, owner: sender, custody: "wallet" as const, expiry: 200n, now: 100n };
  it("accepts an unexpired name held by the connected registry owner", () => expect(transferBlockReason(eligible)).toBeNull());
  it.each([
    { connected: false }, { supportedChain: false }, { owner: target },
    { custody: "marketplace_listing" as const }, { custody: "marketplace_auction" as const },
    { expiry: 100n }, { expiry: 0n }, { owner: undefined },
  ])("fails closed for ineligible case %#", (change) => expect(transferBlockReason({ ...eligible, ...change })).not.toBeNull());
});

describe("verified transfer cleanup", () => {
  it("clears the matching primary/recent name, removes sender cache and invalidates ownership reads", async () => {
    const queryClient = new QueryClient();
    const key = ["rns", "api", "domains", "owner", 4153, sender];
    const recipientKey = ["rns", "api", "domains", "owner", 4153, target];
    const testnetKey = ["rns", "api", "domains", "owner", 11155931, sender];
    const ownerReadKey = ["readContract", { chainId: 4153, address: registry, functionName: "owner", args: [node] }];
    queryClient.setQueryData(key, [{ node }, { node: rnsNamehash("other") }]);
    queryClient.setQueryData(recipientKey, [{ node }]);
    queryClient.setQueryData(testnetKey, [{ node }]);
    queryClient.setQueryData(ownerReadKey, sender);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    setPrimaryLabel(sender, "alice");
    setPrimaryLabel(target, "bob");
    saveRecentRegistration(sender, "alice", node);
    await refreshAfterVerifiedTransfer({ queryClient, sender, recipient: target, label: "Alice.rise", node, chainId: 4153, registry, registrar: registry });
    expect(getPrimaryLabel(sender)).toBeNull();
    expect(getPrimaryLabel(target)).toBe("bob");
    expect(getRecentRegistrations(sender)).toHaveLength(0);
    expect(queryClient.getQueryData(key)).toEqual([{ node: rnsNamehash("other") }]);
    expect(queryClient.getQueryData(recipientKey)).toEqual([{ node }]);
    expect(queryClient.getQueryData(testnetKey)).toEqual([{ node }]);
    expect(queryClient.getQueryState(ownerReadKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryData(ownerReadKey)).toBe(target);
    expect(invalidate).toHaveBeenCalledOnce();
    queryClient.clear();
  });
  it("preserves a different locally selected primary", async () => {
    const queryClient = new QueryClient();
    setPrimaryLabel(sender, "bob");
    await refreshAfterVerifiedTransfer({ queryClient, sender, recipient: target, label: "alice", node, chainId: 4153, registry, registrar: registry });
    expect(getPrimaryLabel(sender)).toBe("bob");
    queryClient.clear();
  });
  it("updates only the transferred node in batched registry reads, leaving other chains untouched", async () => {
    const queryClient = new QueryClient();
    const contracts = [node, rnsNamehash("bob")].map((value) => ({ address: registry, functionName: "owner", args: [value] }));
    const mainnet = ["readContracts", { chainId: 4153, contracts }];
    const testnet = ["readContracts", { chainId: 11155931, contracts }];
    const before = [{ status: "success", result: sender }, { status: "success", result: sender }];
    queryClient.setQueryData(mainnet, before);
    queryClient.setQueryData(testnet, before);
    await refreshAfterVerifiedTransfer({ queryClient, sender, recipient: target, label: "alice", node, chainId: 4153, registry, registrar: registry });
    expect(queryClient.getQueryData(mainnet)).toEqual([{ status: "success", result: target }, before[1]]);
    expect(queryClient.getQueryData(testnet)).toEqual(before);
    expect(queryClient.getQueryState(testnet)?.isInvalidated).toBe(false);
    queryClient.clear();
  });
});
