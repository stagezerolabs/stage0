/** Default registration duration (1 year) when callers omit duration. */
export const RNS_DEFAULT_REGISTRATION_DURATION = 365n * 24n * 60n * 60n;

/**
 * Frontend-enforced minimum name length (the contract allows 3, but we gate at 5).
 * Names shorter than this are rejected before the TX is constructed.
 */
export const RNS_MIN_NAME_LENGTH = 5;

/**
 * Registration fee tiers (per year).
 * Applied on top of the on-chain base fee — whichever is higher is used.
 */
export const RNS_FEE_STANDARD = 2_500_000_000_000_000n; // 0.0025 ETH (5+ char names)

export const RNS_QUERY_STALE_TIME = 15_000;
export const RNS_QUERY_GC_TIME = 5 * 60 * 1000;

/** Top-level domain suffix for all Rise Name Service names. */
export const DOMAIN_SUFFIX = ".rise";

export const RESERVED_NAMES = new Set([
  "admin",
  "api",
  "www",
  "app",
  "mail",
  "ftp",
  "rise",
  "dashboard",
  "presales",
  "tools",
]);
