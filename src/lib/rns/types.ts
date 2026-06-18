import type { Address, Hash, Hex } from "viem";

export type RnsName = string;

export type RnsRecord = {
  name: string;
  fqdn: string;
  node: Hex;
  exists: boolean;
  owner: Address | null;
  resolver: Address | null;
  expiry?: bigint;
};

export type RnsResolvedAddress = {
  name: string;
  fqdn: string;
  node: Hex;
  resolver: Address;
  addr: Address | null;
};

export type RnsRegistrationQuote = {
  name: string;
  duration: bigint;
  price: bigint;
  available: boolean;
  signedQuote?: RnsSignedPriceQuote;
  signature?: Hex;
  display?: {
    years: string;
    usdCentsPerYear: number;
    subtotalUsdCents?: string;
    subtotalUsd?: string;
    priceMultiplierBps?: number;
    discountBps?: number;
    discountPercent?: string;
    discountUsdCents?: string;
    discountUsd?: string;
    totalUsdCents: string;
    totalUsd?: string;
    ethUsd: number;
    priceEth: string;
    quoteExpiresAt: string;
  };
};

export type RnsSignedPriceQuote = {
  action: number;
  labelHash: Hex;
  beneficiary: Address;
  duration: bigint;
  priceWei: bigint;
  deadline: bigint;
  nonce: Hex;
};

/** Registrant is `msg.sender`; optional resolver defaults to the deployed RNS resolver. */
export type RnsRegisterParams = {
  name: string;
  duration?: bigint;
  resolver?: Address;
  value?: bigint;
  quote: RnsSignedPriceQuote;
  signature: Hex;
};

export type RnsRenewParams = {
  name: string;
  duration?: bigint;
  value?: bigint;
  quote: RnsSignedPriceQuote;
  signature: Hex;
};

export type RnsReleaseParams = {
  name: string;
};

export type RnsCreateMarketplaceAuctionParams = {
  name: string;
  reservePrice: bigint;
  minIncrementBps: number;
  startTime: bigint;
  endTime: bigint;
};

export type RnsSetResolverParams = {
  name: string;
  resolver: Address;
  node?: Hex;
};

export type RnsSetAddrParams = {
  name: string;
  addr: Address;
  node?: Hex;
};

export type RnsTxResult = {
  hash: Hash;
};
