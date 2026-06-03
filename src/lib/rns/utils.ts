import { DOMAIN_SUFFIX, RNS_FEE_STANDARD, RNS_MIN_NAME_LENGTH } from "@/lib/rns/constants";
import { labelhash, namehash } from "viem/ens";
import type { Hex } from "viem";

export { DOMAIN_SUFFIX };

/** Strip `.rise` suffix and lowercase the label. */
export function normalizeRnsLabel(input: string): string {
  return input.trim().toLowerCase().replace(/\.rise$/i, "");
}

/** Full domain for onchain calls, e.g. `alice.rise`. */
export function toRnsFqdn(label: string): string {
  const normalized = normalizeRnsLabel(label);
  return `${normalized}${DOMAIN_SUFFIX}`;
}

/** Display form of a label, e.g. `alice.rise`. */
export function formatDomainDisplay(name: string): string {
  return `${normalizeRnsLabel(name)}${DOMAIN_SUFFIX}`;
}

export type DomainValidationResult = { valid: boolean; error?: string };

export function validateDomainName(name: string): DomainValidationResult {
  if (!name) {
    return { valid: false, error: "Enter a name to search or mint." };
  }
  if (name.length < RNS_MIN_NAME_LENGTH) {
    return { valid: false, error: `Names must be at least ${RNS_MIN_NAME_LENGTH} characters.` };
  }
  if (name.length > 32) {
    return { valid: false, error: "Names must be 32 characters or fewer." };
  }
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(name)) {
    return {
      valid: false,
      error: "Use lowercase letters, numbers, and hyphens (not at the start or end).",
    };
  }
  return { valid: true };
}

/**
 * Returns the effective registration fee for a given label.
 * Takes the higher of the on-chain contract fee and the frontend pricing tier,
 * so the TX always satisfies the contract's msg.value requirement.
 *
 * Pricing tiers (per year):
 *  5+ chars  → 0.0025 ETH (standard)
 */
export function computeRnsFee(label: string, contractFee: bigint): bigint {
  const len = normalizeRnsLabel(label).length;
  const tieredFee = len >= RNS_MIN_NAME_LENGTH ? RNS_FEE_STANDARD : 0n;
  return contractFee > tieredFee ? contractFee : tieredFee;
}

/**
 * ENS namehash for `label.rise`. Prefer onchain `computeNode(riseNode, labelhash)`
 * via `useRnsNode` / `rnsGetNode` for reads and writes.
 */
export function rnsNamehash(label: string): Hex {
  return namehash(toRnsFqdn(label));
}

export function rnsLabelhash(label: string): Hex {
  return labelhash(normalizeRnsLabel(label));
}
