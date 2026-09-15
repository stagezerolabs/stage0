import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAddress, zeroAddress, type Address, type Hex, type TransactionReceipt } from "viem";
import TransferNameDialog, { type TransferNameSelection } from "./TransferNameDialog";
import { getPrimaryLabel, setPrimaryLabel } from "@/lib/rns/primary-label";
import { rnsNamehash } from "@/lib/rns/utils";

const env = vi.hoisted(() => ({
  sender: "0x1111111111111111111111111111111111111111" as Address,
  target: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
  registry: "0x2222222222222222222222222222222222222222" as Address,
  account: { address: "0x1111111111111111111111111111111111111111" as Address, isConnected: true, chainId: 4153 },
  owner: "0x1111111111111111111111111111111111111111" as Address,
  expiry: 9999999999n,
  readContract: vi.fn(), getBlock: vi.fn(), getReceipt: vi.fn(), setOwner: vi.fn(),
  tx: { hash: undefined as Hex | undefined, receipt: undefined as TransactionReceipt | undefined, isConfirming: false, error: null as Error | null },
  client: {} as Record<string, unknown>,
}));
vi.mock("@/config", () => ({ SUPPORTED_CHAINS: [{ id: 4153 }] }));
vi.mock("wagmi", () => ({ useAccount: () => env.account, useConfig: () => ({}), usePublicClient: () => env.client }));
vi.mock("@wagmi/core", () => ({ getAccount: () => env.account }));
vi.mock("@/lib/hooks/rns/useRnsContracts", () => ({ useRnsContracts: () => ({ chainId: 4153, registry: env.registry, registrar: env.registry, explorerUrl: "https://explorer.risechain.com" }) }));
vi.mock("@/lib/hooks/rns/useRnsActions", () => ({
  useRnsRegistrySetOwner: () => ({ ...env.tx, node: rnsNamehash("alice"), setOwner: env.setOwner, reset: () => { env.tx.hash = undefined; env.tx.receipt = undefined; env.tx.error = null; } }),
}));

let queryClient: QueryClient;
let onTransferred: ReturnType<typeof vi.fn<() => void>>;
let onClose: ReturnType<typeof vi.fn<() => void>>;
const hash = `0x${"a".repeat(64)}` as Hex;
const selection = (): TransferNameSelection => ({ label: "alice.rise", node: rnsNamehash("alice"), sender: env.sender, custody: "wallet" });
const receipt = (status: "success" | "reverted" = "success") => ({ status, transactionHash: hash, blockNumber: 100n } as TransactionReceipt);

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, "matchMedia", { writable: true, value: () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
  env.account = { address: env.sender, isConnected: true, chainId: 4153 };
  env.owner = env.sender;
  env.expiry = 9999999999n;
  env.tx = { hash: undefined, receipt: undefined, isConfirming: false, error: null };
  env.readContract.mockReset().mockImplementation(async ({ functionName }: { functionName: string }) => functionName === "owner" ? env.owner : env.expiry);
  env.getBlock.mockReset().mockResolvedValue({ number: 100n, timestamp: BigInt(Math.floor(Date.now() / 1000)) });
  env.getReceipt.mockReset().mockRejectedValue(new Error("Receipt unavailable"));
  env.setOwner.mockReset();
  env.client = { readContract: env.readContract, getBlock: env.getBlock, getTransactionReceipt: env.getReceipt };
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  onTransferred = vi.fn(); onClose = vi.fn();
});
afterEach(() => { cleanup(); queryClient.clear(); });

function mount(overrides: Partial<TransferNameSelection> = {}) {
  const props = { selection: { ...selection(), ...overrides }, onClose, onTransferred };
  const tree = () => <QueryClientProvider client={queryClient}><TransferNameDialog {...props} /></QueryClientProvider>;
  const result = render(tree());
  return () => result.rerender(tree());
}
function button() { return screen.getByRole("button", { name: "Transfer" }) as HTMLButtonElement; }
async function fill(input: string = env.target) {
  await waitFor(() => expect(env.readContract).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText("Recipient address"), { target: { value: input } });
  fireEvent.click(screen.getByRole("checkbox"));
}
async function submit() {
  await fill();
  await waitFor(() => expect(button().disabled).toBe(false));
  fireEvent.click(button());
  await waitFor(() => expect(env.setOwner).toHaveBeenCalledOnce());
}

describe("RNS ownership transfer dialog", () => {
  it("shows bold owner/expiry and an irreversible warning, then submits a checksum-normalized recipient once", async () => {
    mount();
    expect(screen.getByText("alice.rise")).toBeTruthy();
    expect(screen.getByText(/does not renew the name/)).toBeTruthy();
    expect(screen.queryByText(/Resolver, address and text records stay unchanged/)).toBeNull();
    for (const label of ["Current owner", "Expires"]) {
      const field = screen.getByText(label);
      expect(field.classList.contains("font-bold")).toBe(true);
      expect(field.nextElementSibling?.classList.contains("font-bold")).toBe(true);
    }
    await submit();
    expect(env.setOwner).toHaveBeenCalledWith(getAddress(env.target));
    expect(screen.getByText("Awaiting wallet confirmation")).toBeTruthy();
    expect(button().disabled).toBe(true);
    fireEvent.click(button());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(env.setOwner).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    expect(onTransferred).not.toHaveBeenCalled();
  });

  it.each(["invalid", "0x1234", zeroAddress, env.sender, "0xAbcdefabcdefabcdefabcdefabcdefabcdefabcd"])("rejects recipient %s in the UI", async (input) => {
    mount(); await fill(input);
    expect(button().disabled).toBe(true);
    fireEvent.click(button()); expect(env.setOwner).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Recipient address").getAttribute("aria-invalid")).toBe("true");
  });
  it.each(["marketplace_listing", "marketplace_auction"] as const)("disables transfer for %s custody", async (custody) => {
    mount({ custody }); await fill();
    expect(button().disabled).toBe(true);
    expect(screen.getByText(/This name is in marketplace escrow/)).toBeTruthy();
    expect(env.setOwner).not.toHaveBeenCalled();
  });
  it("disables expired names", async () => {
    env.expiry = 1n; mount(); await fill();
    await screen.findByText(/This name has expired/);
    expect(button().disabled).toBe(true);
  });
  it("disables a non-owner, including a marketplace contract owner despite stale wallet custody", async () => {
    env.owner = env.registry; mount(); await fill();
    await screen.findByText(/no longer the registry owner/);
    expect(button().disabled).toBe(true);
  });
  it.each(["disconnected", "wrong chain"])("disables transfer when %s", async (mode) => {
    if (mode === "disconnected") env.account.isConnected = false;
    else env.account.chainId = 1;
    mount(); await fill(); expect(button().disabled).toBe(true);
  });
  it("rechecks the owner immediately before sending, without clearing primary state on failure", async () => {
    setPrimaryLabel(env.sender, "alice");
    mount(); await fill(); await waitFor(() => expect(button().disabled).toBe(false));
    env.owner = env.target;
    fireEvent.click(button());
    await screen.findByText(/no longer the registry owner/);
    expect(env.setOwner).not.toHaveBeenCalled();
    expect(getPrimaryLabel(env.sender)).toBe("alice");
  });
  it("aborts if the wallet changes during the fresh ownership read", async () => {
    mount(); await fill(); await waitFor(() => expect(button().disabled).toBe(false));
    env.getBlock.mockImplementationOnce(async () => {
      env.account.address = env.target;
      return { number: 100n, timestamp: 1n };
    });
    fireEvent.click(button()); await screen.findByText(/no longer the registry owner/);
    expect(env.setOwner).not.toHaveBeenCalled();
  });
  it("requires explicit acknowledgement before requesting a wallet transaction", async () => {
    mount();
    fireEvent.change(screen.getByLabelText("Recipient address"), { target: { value: env.target } });
    expect(button().disabled).toBe(true);
    fireEvent.click(button());
    expect(env.setOwner).not.toHaveBeenCalled();
  });
  it("rechecks expiry immediately before submission", async () => {
    mount(); await fill(); await waitFor(() => expect(button().disabled).toBe(false));
    env.expiry = 1n;
    fireEvent.click(button()); await screen.findByText(/This name has expired/);
    expect(env.setOwner).not.toHaveBeenCalled();
  });
  it("fails closed on a fresh RPC error", async () => {
    setPrimaryLabel(env.sender, "alice");
    mount(); await fill(); await waitFor(() => expect(button().disabled).toBe(false));
    env.getBlock.mockRejectedValueOnce(new Error("RPC unavailable"));
    fireEvent.click(button()); await screen.findByText("RPC unavailable");
    expect(env.setOwner).not.toHaveBeenCalled();
    expect(getPrimaryLabel(env.sender)).toBe("alice");
  });
  it("locks submission if ownership verification RPC fails after confirmation", async () => {
    setPrimaryLabel(env.sender, "alice");
    const rerender = mount(); await submit();
    env.readContract.mockRejectedValueOnce(new Error("Ownership RPC unavailable"));
    env.tx.hash = hash; env.tx.receipt = receipt(); rerender();
    await screen.findByText("Ownership not yet verified");
    expect(getPrimaryLabel(env.sender)).toBe("alice");
    expect(onTransferred).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Transfer" })).toBeNull();
  });
  it("waits for a successful receipt AND verified ownership before clearing primary and refreshing lists", async () => {
    setPrimaryLabel(env.sender, "alice");
    const key = ["rns", "api", "domains", "owner", 4153, env.sender];
    queryClient.setQueryData(key, [{ node: rnsNamehash("alice") }]);
    const rerender = mount(); await submit();
    env.tx.hash = hash; env.tx.isConfirming = true; rerender();
    expect(screen.getByText("Confirming transfer")).toBeTruthy();
    expect(getPrimaryLabel(env.sender)).toBe("alice");
    expect(onTransferred).not.toHaveBeenCalled();
    env.owner = getAddress(env.target); env.tx.receipt = receipt(); rerender();
    await screen.findByText("Transfer sent");
    expect(getPrimaryLabel(env.sender)).toBeNull();
    expect(queryClient.getQueryData(key)).toEqual([]);
    expect(onTransferred).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "View transaction" }).getAttribute("href")).toBe(`https://explorer.risechain.com/tx/${hash}`);
  });
  it.each(["rejected", "reverted"])("leaves lists and primary unchanged when %s", async (mode) => {
    setPrimaryLabel(env.sender, "alice");
    const rerender = mount(); await submit();
    if (mode === "rejected") env.tx.error = new Error("User rejected");
    else { env.tx.hash = hash; env.tx.receipt = receipt("reverted"); }
    rerender(); await screen.findByText("Transfer failed or rejected");
    expect(getPrimaryLabel(env.sender)).toBe("alice");
    expect(onTransferred).not.toHaveBeenCalled();
    expect(env.owner).toBe(env.sender);
  });
  it("does not report success on receipt alone when registry ownership disagrees; retry verifies without resending", async () => {
    setPrimaryLabel(env.sender, "alice");
    const rerender = mount(); await submit(); env.tx.hash = hash; env.tx.receipt = receipt(); rerender();
    await screen.findByText("Ownership not yet verified");
    expect(getPrimaryLabel(env.sender)).toBe("alice"); expect(onTransferred).not.toHaveBeenCalled();
    env.owner = env.target;
    fireEvent.click(screen.getByRole("button", { name: "Retry verification" }));
    await screen.findByText("Transfer sent");
    expect(env.setOwner).toHaveBeenCalledOnce();
  });
  it("recovers a receipt polling failure without enabling another transfer", async () => {
    const rerender = mount(); await submit(); env.tx.hash = hash; env.tx.error = new Error("RPC timeout"); rerender();
    await screen.findByText("Ownership not yet verified");
    env.getReceipt.mockResolvedValue(receipt()); env.owner = env.target;
    fireEvent.click(screen.getByRole("button", { name: "Retry verification" }));
    await screen.findByText("Transfer sent");
    expect(env.setOwner).toHaveBeenCalledOnce();
  });
  it("recovers a reverted receipt when Wagmi reports it as a confirmation error", async () => {
    setPrimaryLabel(env.sender, "alice");
    const rerender = mount(); await submit();
    env.getReceipt.mockResolvedValue(receipt("reverted"));
    env.tx.hash = hash; env.tx.error = new Error("execution reverted"); rerender();
    await screen.findByText("Transfer failed or rejected");
    expect(getPrimaryLabel(env.sender)).toBe("alice");
    expect(onTransferred).not.toHaveBeenCalled();
  });
  it("preserves a different primary and the original sender if the account changes after submission", async () => {
    setPrimaryLabel(env.sender, "bob"); setPrimaryLabel(env.target, "carol");
    const rerender = mount(); await submit();
    env.account = { address: env.target, chainId: 1, isConnected: true };
    env.owner = env.target; env.tx.hash = hash; env.tx.receipt = receipt();
    await act(async () => rerender()); await screen.findByText("Transfer sent");
    expect(getPrimaryLabel(env.sender)).toBe("bob"); expect(getPrimaryLabel(env.target)).toBe("carol");
  });
});
