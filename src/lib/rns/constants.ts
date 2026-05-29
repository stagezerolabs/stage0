/** Default registration duration (1 year) when callers omit duration. */
export const RNS_DEFAULT_REGISTRATION_DURATION = 365n * 24n * 60n * 60n;

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
