import { isAddressEqual, zeroAddress, type Address } from "viem";
import type { RnsCustody } from "./transfer";

export function resolverUpdateBlockReason(input: {
  connected: boolean; supportedChain: boolean; wallet?: Address; owner?: Address;
  custody: RnsCustody; expiry?: bigint; now: bigint; resolver?: Address;
  expectedResolver: Address; resolvedAddress?: Address;
}): string | null {
  if (!input.connected || !input.wallet || isAddressEqual(input.wallet, zeroAddress)) return "Connect the wallet that owns this name.";
  if (!input.supportedChain) return "Switch to RISE Mainnet to update this name.";
  if (input.custody !== "wallet") return "Cancel the marketplace listing or auction first, where cancellation is available.";
  if (!input.owner || input.expiry === undefined || !input.resolver) return "Checking ownership and resolver…";
  if (!isAddressEqual(input.owner, input.wallet)) return "This wallet is no longer the registry owner.";
  if (input.expiry <= input.now) return "Renew this name before updating its address.";
  if (!isAddressEqual(input.resolver, input.expectedResolver)) return "This name is not using the Stage0 resolver. Its resolver must be configured separately.";
  if (input.resolvedAddress && isAddressEqual(input.resolvedAddress, input.wallet)) return "This name already points to your wallet.";
  return null;
}
