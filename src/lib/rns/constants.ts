/** Default registration duration (1 year) when callers omit duration. */
export const RNS_DEFAULT_REGISTRATION_DURATION = 365n * 24n * 60n * 60n;

/** Public names start at 3 chars. 1-2 char names are reserved for auctions. */
export const RNS_MIN_NAME_LENGTH = 3;

export const RNS_QUERY_STALE_TIME = 15_000;
export const RNS_QUERY_GC_TIME = 5 * 60 * 1000;

export const RNS_LABEL_POLICY_OPEN = 0;
export const RNS_LABEL_POLICY_PROTECTED = 1;
export const RNS_LABEL_POLICY_AUCTION_ONLY = 2;
export const RNS_LABEL_POLICY_FIXED_PREMIUM = 3;

/** Top-level domain suffix for all Rise Name Service names. */
export const DOMAIN_SUFFIX = ".rise";
