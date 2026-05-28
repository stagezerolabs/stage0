/**
 * Pure domain name utilities.
 * All onchain state (ownership, availability) is sourced from the RNS contracts
 * and the Goldsky subgraph — nothing is persisted in localStorage.
 */
export {
  DOMAIN_SUFFIX,
  formatDomainDisplay,
  normalizeRnsLabel as normalizeDomainName,
  validateDomainName,
  type DomainValidationResult,
} from "@/lib/rns/utils";

export type MintDomainResult =
  | { ok: true; name: string }
  | { ok: false; error: string };
