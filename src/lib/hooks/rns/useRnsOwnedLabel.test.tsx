import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { type Address } from "viem";
import { useRnsOwnedLabel } from "./useRnsOwnedLabel";
import { rnsNamehash } from "@/lib/rns/utils";
import { saveRecentRegistration } from "@/lib/rns/recent-registration";

const env = vi.hoisted(() => ({
  sender: "0x1111111111111111111111111111111111111111" as Address,
  recipient: "0x2222222222222222222222222222222222222222" as Address,
  owners: [] as { result?: Address; status: string }[],
  domains: [] as { node: string; label: string; custody: string; expiry: bigint }[],
  primary: null as { primaryName: string; node: string } | null,
  refreshPrimary: vi.fn(),
  refreshApi: vi.fn(), refreshOwnership: vi.fn(), noop: vi.fn(), recovered: new Map(), resolverResults: [],
}));
vi.mock("@/config", () => ({ riseMainnet: { id: 4153 } }));
vi.mock("./useRnsContracts", () => ({ useRnsContracts: () => ({ registry: env.sender, registrar: env.sender, resolver: env.sender }) }));
vi.mock("./useRnsApi", () => ({ useRnsApiDomainsForOwner: () => ({ data: env.domains, refetch: env.refreshApi }) }));
vi.mock("./useRnsSubgraph", () => ({ useRnsSubgraphDomainsForOwner: () => ({ refetch: env.noop }) }));
vi.mock("./useRnsRegistry", () => ({ useRnsOwner: () => ({ owner: env.sender, refetch: env.noop }) }));
vi.mock("./useRnsRegistrar", () => ({ useRnsExpiry: () => ({ expiry: 9999999999n, refetch: env.noop }) }));
vi.mock("./useRnsLabelRecovery", () => ({ useRnsLabelRecovery: () => ({ recoveredLabels: env.recovered }) }));
vi.mock("./useRnsPrimaryName", () => ({ useRnsPrimaryName: () => ({ data: env.primary, refetch: env.refreshPrimary }) }));
vi.mock("wagmi", () => ({
  useReadContracts: ({ contracts }: { contracts: { functionName: string }[] }) => contracts[0]?.functionName === "owner"
    ? { data: env.owners, refetch: env.refreshOwnership }
    : { data: env.resolverResults, refetch: env.noop },
}));

beforeEach(() => {
  localStorage.clear();
  env.primary = { primaryName: "alice.rise", node: rnsNamehash("alice") };
  env.domains = [
    { node: rnsNamehash("alice"), label: "alice", custody: "wallet", expiry: 9999999999n },
    { node: rnsNamehash("bob"), label: "bob", custody: "wallet", expiry: 9999999999n },
  ];
  env.owners = [{ result: env.sender, status: "success" }, { result: env.sender, status: "success" }];
});
afterEach(cleanup);

it("drops a transferred name even when the API still returns it, and refetches ownership and discovery", async () => {
  const { result, rerender } = renderHook(() => useRnsOwnedLabel(env.sender));
  expect(result.current.allDomains.map((domain) => domain.label)).toEqual(["alice", "bob"]);
  env.owners = [{ result: env.recipient, status: "success" }, { result: env.sender, status: "success" }];
  rerender();
  expect(result.current.allDomains.map((domain) => domain.label)).toEqual(["bob"]);
  expect(result.current.label).toBeNull(); // A stale API choice cannot survive a transfer.
  env.primary = { primaryName: "bob.rise", node: rnsNamehash("bob") };
  rerender();
  expect(result.current.label).toBe("bob");
  await result.current.refetch();
  expect(env.refreshApi).toHaveBeenCalledOnce();
  expect(env.refreshOwnership).toHaveBeenCalledOnce();
  expect(env.refreshPrimary).toHaveBeenCalledOnce();
});

it("does not resurrect a transferred recent registration absent from the API", () => {
  env.domains = [];
  saveRecentRegistration(env.sender, "alice", rnsNamehash("alice"));
  env.owners = [{ result: env.recipient, status: "success" }];
  const { result } = renderHook(() => useRnsOwnedLabel(env.sender));
  expect(result.current.allDomains).toEqual([]);
});

it("retains seller escrow management but exposes the authoritative owner", () => {
  env.domains[0].custody = "marketplace_listing";
  env.owners = [{ result: env.recipient, status: "success" }, { result: env.sender, status: "success" }];
  const { result } = renderHook(() => useRnsOwnedLabel(env.sender));
  expect(result.current.allDomains[0].custody).toBe("marketplace_listing");
  expect(result.current.allDomains[0].registryOwner).toBe(env.recipient);
  expect(result.current.label).toBeNull();
});

it("does not mark ownership verified when an RPC read fails", () => {
  env.owners = [{ status: "failure" }, { status: "failure" }];
  const { result } = renderHook(() => useRnsOwnedLabel(env.sender));
  expect(result.current.allDomains.every((domain) => domain.registryOwner === undefined)).toBe(true);
});

it("uses the shared choice even when local storage contains a different name", () => {
  localStorage.setItem("rns_primary_label_v1", JSON.stringify({ [env.sender]: "bob" }));
  const { result } = renderHook(() => useRnsOwnedLabel(env.sender));
  expect(result.current.label).toBe("alice");
});

it("does not invent a primary when the shared API has none", () => {
  env.primary = null;
  const { result } = renderHook(() => useRnsOwnedLabel(env.sender));
  expect(result.current.allDomains).toHaveLength(2);
  expect(result.current.label).toBeNull();
});
