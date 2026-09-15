import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { zeroAddress, type Address, type Hex } from "viem";
import { useRnsWalletAddressUpdates } from "./useRnsWalletAddressUpdates";

const env = vi.hoisted(() => ({
  wallet: { address: "0x1111111111111111111111111111111111111111" as Address, isConnected: true, chainId: 4153 },
  reads: vi.fn(),
}));
const wallet = env.wallet.address;
const other = "0x2222222222222222222222222222222222222222" as Address;
const resolver = "0x3333333333333333333333333333333333333333" as Address;
const registry = "0x4444444444444444444444444444444444444444" as Address;
const registrar = "0x5555555555555555555555555555555555555555" as Address;
const node = `0x${"a".repeat(64)}` as Hex;
const name = { node, label: "alice", registrant: other, custody: "wallet" as const };
vi.mock("@/config", () => ({ riseMainnet: { id: 4153 } }));
vi.mock("wagmi", () => ({ useAccount: () => env.wallet, useReadContracts: (...args: unknown[]) => env.reads(...args) }));
vi.mock("./useRnsContracts", () => ({ useRnsContracts: () => ({ registry, registrar, resolver }) }));
const success = (result: Address | bigint) => ({ status: "success", result });
const correctReads = () => [success(wallet), success(resolver), success(other), success(9999999999n)];
beforeEach(() => {
  vi.resetAllMocks();env.wallet = { address: wallet, isConnected: true, chainId: 4153 };
  env.reads.mockReturnValue({ data: correctReads(), isError: false });
});
afterEach(cleanup);

it("checks received names in one mainnet batch and refreshes in the background", () => {
  const { result } = renderHook(() => useRnsWalletAddressUpdates([name]));
  expect(result.current.has(node)).toBe(true);
  const options = env.reads.mock.calls[0][0];
  expect(options.query).toEqual({ enabled: true, staleTime: 0, refetchInterval: 15000 });
  expect(options.contracts.map((c: { functionName: string }) => c.functionName)).toEqual(["owner", "resolver", "addr", "expiryOf"]);
  expect(options.contracts.every((c: { chainId: number }) => c.chainId === 4153)).toBe(true);
  expect(options.contracts[2].address).toBe(resolver);
});
it("offers acceptance to the original registrant when a returned name points elsewhere", () => {
  const { result } = renderHook(() => useRnsWalletAddressUpdates([{ ...name, registrant: wallet }]));
  expect(result.current.has(node)).toBe(true);
  expect(env.reads.mock.calls[0][0].query.enabled).toBe(true);
});
it("hides for an original registration already pointing to its owner", () => {
  const data = correctReads();data[2] = success(wallet);env.reads.mockReturnValue({ data });
  const { result } = renderHook(() => useRnsWalletAddressUpdates([{ ...name, registrant: wallet }]));
  expect(result.current.size).toBe(0);
});
it.each([undefined, null, zeroAddress])("uses verified live ownership when registration history is unknown (%s)", registrant => {
  const { result } = renderHook(() => useRnsWalletAddressUpdates([{ ...name, registrant }]));
  expect(result.current.has(node)).toBe(true);
});
it.each(["already points here", "non-owner", "expired", "custom resolver", "failed read", "missing read", "RPC error", "loading"])("hides for %s", reason => {
  let data: ReturnType<typeof correctReads> | undefined = correctReads();
  if (reason === "already points here") data[2] = success(wallet);
  if (reason === "non-owner") data[0] = success(other);
  if (reason === "expired") data[3] = success(1n);
  if (reason === "custom resolver") data[1] = success(other);
  if (reason === "failed read") data[2] = { status: "failure", result: zeroAddress };
  if (reason === "missing read") data.pop();
  if (reason === "loading") data = undefined;
  env.reads.mockReturnValue({ data, isError: reason === "RPC error" });
  const { result } = renderHook(() => useRnsWalletAddressUpdates([name]));
  expect(result.current.size).toBe(0);
});
it("allows setting an empty address record on a received name", () => {
  const data = correctReads();data[2] = success(zeroAddress);env.reads.mockReturnValue({ data });
  const { result } = renderHook(() => useRnsWalletAddressUpdates([name]));
  expect(result.current.has(node)).toBe(true);
});
it.each(["disconnected", "wrong chain", "listing", "auction"])("does not query for %s", reason => {
  if (reason === "disconnected") env.wallet.isConnected = false;
  if (reason === "wrong chain") env.wallet.chainId = 1;
  const custody = reason === "listing" ? "marketplace_listing" : reason === "auction" ? "marketplace_auction" : "wallet";
  const { result } = renderHook(() => useRnsWalletAddressUpdates([{ ...name, custody }]));
  expect(result.current.size).toBe(0);expect(env.reads.mock.calls[0][0].query.enabled).toBe(false);
});
it("never flashes a button while loading and removes it after the address catches up", () => {
  env.reads.mockReturnValue({ data: undefined });
  const { result, rerender } = renderHook(() => useRnsWalletAddressUpdates([name]));
  expect(result.current.size).toBe(0);
  env.reads.mockReturnValue({ data: correctReads() });rerender();expect(result.current.has(node)).toBe(true);
  const updated = correctReads();updated[2] = success(wallet);env.reads.mockReturnValue({ data: updated });rerender();
  expect(result.current.size).toBe(0);
});
it("keeps batched results aligned for original and received names", () => {
  const original = { ...name, node: `0x${"b".repeat(64)}` as Hex, registrant: wallet };
  const correctOriginal = correctReads();correctOriginal[2] = success(wallet);
  env.reads.mockReturnValue({ data: [...correctOriginal, ...correctReads()] });
  const { result } = renderHook(() => useRnsWalletAddressUpdates([original, name]));
  expect([...result.current]).toEqual([node]);
  expect(env.reads.mock.calls[0][0].contracts).toHaveLength(8);
});
it("does not reuse another connected wallet's eligibility", () => {
  const { result, rerender } = renderHook(() => useRnsWalletAddressUpdates([name]));
  expect(result.current.has(node)).toBe(true);
  env.wallet.address = registry;rerender();expect(result.current.size).toBe(0);
});
