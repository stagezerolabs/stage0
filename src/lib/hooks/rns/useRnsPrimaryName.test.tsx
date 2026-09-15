import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useRnsPrimaryName, useSetRnsPrimaryName } from "./useRnsPrimaryName";
import { getPrimaryLabel } from "@/lib/rns/primary-label";

const env = vi.hoisted(() => ({
  wallet: { address: "0x1111111111111111111111111111111111111111", chainId: 4153, isConnected: true },
  sign: vi.fn(), authorize: vi.fn(), save: vi.fn(), lookup: vi.fn(), toast: vi.fn(),
}));
vi.mock("@/config", () => ({ riseMainnet: { id: 4153 } }));
vi.mock("wagmi", () => ({ useAccount: () => env.wallet, useConfig: () => ({}), useSignMessage: () => ({ signMessageAsync: env.sign }) }));
vi.mock("@wagmi/core", () => ({ getAccount: () => env.wallet }));
vi.mock("@/lib/api/rns", () => ({ fetchRnsPrimaryAuthorization: env.authorize, saveRnsPrimaryName: env.save, fetchRnsPrimaryNameForAddress: env.lookup }));
vi.mock("sonner", () => ({ toast: { success: env.toast, error: env.toast } }));

const sender = "0x1111111111111111111111111111111111111111" as const;
const authorization = { address: sender, name: "alice", chainId: 4153, version: "0", timestamp: 1, message: "Primary selection (test)" };
let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  env.wallet = { address: sender, chainId: 4153, isConnected: true };
  env.authorize.mockResolvedValue(authorization);
  env.sign.mockResolvedValue("0x1234");
  env.save.mockResolvedValue({ primaryName: "alice.rise", node: "0x1234", version: "1" });
});
afterEach(() => { cleanup(); client.clear(); });

it("signs a message, saves on the server, then refreshes all RNS queries", async () => {
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const { result } = renderHook(useSetRnsPrimaryName, { wrapper });
  await act(() => result.current.mutateAsync("Alice.rise"));
  expect(env.authorize).toHaveBeenCalledExactlyOnceWith({ address: sender, name: "alice", chainId: 4153 });
  expect(env.sign).toHaveBeenCalledExactlyOnceWith({ account: sender, message: authorization.message });
  expect(env.save).toHaveBeenCalledExactlyOnceWith({ ...authorization, signature: "0x1234" });
  expect(getPrimaryLabel(sender)).toBe("alice");
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rns"] });
});

it.each(["rejected signature", "failed server save"])("preserves the previous primary after %s", async (failure) => {
  localStorage.setItem("rns_primary_label_v1", JSON.stringify({ [sender]: "bob" }));
  (failure === "rejected signature" ? env.sign : env.save).mockRejectedValue(new Error(failure));
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const { result } = renderHook(useSetRnsPrimaryName, { wrapper });
  await act(async () => { await expect(result.current.mutateAsync("alice")).rejects.toThrow(failure); });
  expect(getPrimaryLabel(sender)).toBe("bob");
  expect(invalidate).not.toHaveBeenCalled();
  if (failure === "rejected signature") expect(env.save).not.toHaveBeenCalled();
});

it.each(["disconnected", "wrong chain"])("does not authorize or sign when %s", async (state) => {
  if (state === "disconnected") env.wallet.isConnected = false;
  else env.wallet.chainId = 1;
  const { result } = renderHook(useSetRnsPrimaryName, { wrapper });
  await act(async () => { await expect(result.current.mutateAsync("alice")).rejects.toThrow("RISE Mainnet"); });
  expect(env.authorize).not.toHaveBeenCalled();
  expect(env.sign).not.toHaveBeenCalled();
});

it("aborts if the account changes while the signature prompt is open", async () => {
  env.sign.mockImplementation(async () => { env.wallet.address = "0x2222222222222222222222222222222222222222"; return "0x1234"; });
  const { result } = renderHook(useSetRnsPrimaryName, { wrapper });
  await act(async () => { await expect(result.current.mutateAsync("alice")).rejects.toThrow("wallet changed"); });
  expect(env.save).not.toHaveBeenCalled();
  expect(getPrimaryLabel(sender)).toBeNull();
});

it("rejects an authorization for a different name before asking for a signature", async () => {
  env.authorize.mockResolvedValue({ ...authorization, name: "bob" });
  const { result } = renderHook(useSetRnsPrimaryName, { wrapper });
  await act(async () => { await expect(result.current.mutateAsync("alice")).rejects.toThrow("Invalid primary-name authorization"); });
  expect(env.sign).not.toHaveBeenCalled();
});

it("loads a shared primary on a fresh browser without any local preference", async () => {
  env.lookup.mockResolvedValue({ primaryName: "alice.rise", node: "0x1234" });
  const { result } = renderHook(() => useRnsPrimaryName(sender), { wrapper });
  await waitFor(() => expect(result.current.data?.primaryName).toBe("alice.rise"));
  expect(env.lookup).toHaveBeenCalledWith({ address: sender, chainId: 4153 });
  expect(getPrimaryLabel(sender)).toBeNull();
});
