/** Default registration duration (1 year) when callers omit duration. */
export const RNS_DEFAULT_REGISTRATION_DURATION = 365n * 24n * 60n * 60n;

/** Public names start at 3 chars. 1-2 char names are reserved for auctions. */
export const RNS_MIN_NAME_LENGTH = 3;

export const RNS_QUERY_STALE_TIME = 15_000;
export const RNS_QUERY_GC_TIME = 5 * 60 * 1000;

/** Top-level domain suffix for all Rise Name Service names. */
export const DOMAIN_SUFFIX = ".rise";

export const RESERVED_NAMES = new Set([
  "admin",
  "ai",
  "api",
  "app",
  "stage0",
  "stage",
  "s0",
  "stagezero",
  "dashboard",
  "dex",
  "defi",
  "eth",
  "gm",
  "gn",
  "l2",
  "nft",
  "rise",
  "support",
  "team",
  "tools",
  "www",
]);
