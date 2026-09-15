import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { decodeFunctionData, encodeFunctionData, type Address } from "viem";
import { useRnsRegistrySetOwner } from "./useRnsActions";
import { RNSRegistry } from "@/lib/contracts/generatedAbis";
import { rnsNamehash } from "@/lib/rns/utils";

const env = vi.hoisted(() => ({ write: vi.fn(), tracked: vi.fn(), registry: "0x1111111111111111111111111111111111111111" as Address }));
vi.mock("./useRnsContracts", () => ({ useRnsContracts: () => ({ registry: env.registry }) }));
vi.mock("@/lib/hooks/useTrackedWriteContract", () => ({ useTrackedWriteContract: (options: unknown) => { env.tracked(options); return { writeContract: env.write }; } }));
afterEach(cleanup);

it("uses the generated ABI and existing namehash, pinning the sender and chain for a single setOwner transaction", () => {
  const sender = "0x2222222222222222222222222222222222222222" as Address;
  const recipient = "0x3333333333333333333333333333333333333333" as Address;
  const { result } = renderHook(() => useRnsRegistrySetOwner("Alice.rise", { chainId: 4153, account: sender }));
  result.current.setOwner(recipient);
  expect(env.tracked).toHaveBeenCalledWith({ chainId: 4153 });
  expect(env.write).toHaveBeenCalledExactlyOnceWith({ address: env.registry, abi: RNSRegistry, functionName: "setOwner", args: [rnsNamehash("alice"), recipient], chainId: 4153, account: sender });
  const data = encodeFunctionData({ abi: RNSRegistry, functionName: "setOwner", args: [rnsNamehash("alice"), recipient] });
  expect(decodeFunctionData({ abi: RNSRegistry, data })).toEqual({ functionName: "setOwner", args: [rnsNamehash("alice"), recipient] });
  expect(RNSRegistry.find((item) => item.type === "function" && item.name === "owner")).toBeDefined();
  expect(RNSRegistry.find((item) => item.type === "event" && item.name === "Transfer")).toBeDefined();
});
