import type { IndexedRnsDomain } from '@/lib/indexer/rns-goldsky';
import { coerceAddress, normalizeRnsLookupName } from '@/lib/rns/address-resolution';
import type { RnsRegistrationQuote, RnsSignedPriceQuote } from '@/lib/rns/types';
import type { Address, Hex } from 'viem';

const SENNA_API_URL =
  (import.meta.env.VITE_SENNA_CHAT_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:8788';

type ApiRnsName = {
  chainId: number;
  node: `0x${string}`;
  label: string | null;
  name?: string | null;
  fqdn: string | null;
  registrant: Address;
  owner: Address;
  expiry: string;
  isExpired?: boolean;
  resolver: Address | null;
  resolvedAddress: Address | null;
  registeredTxHash: `0x${string}` | null;
  registeredAt: string;
  renewedAt: string | null;
  releasedAt: string | null;
  createdAtBlock: string;
  custody?: 'wallet' | 'marketplace_listing' | 'marketplace_auction';
  seller?: Address | null;
  marketplace?: ApiRnsMarketplaceSummary | null;
};

type ApiRnsMarketplaceSummary =
  | {
      kind: 'listing';
      listingId: string;
      status: string;
      seller: Address;
      price: string;
      buyer: Address | null;
      purchasedPrice: string | null;
    }
  | {
      kind: 'auction';
      auctionId: string;
      status: string;
      rawStatus?: string;
      seller: Address;
      reservePrice: string;
      startTime: string;
      endTime: string;
      currentExtensionWindow: string | null;
      bidCount: number;
      highestBidder: Address | null;
      highestBid: string;
      winner: Address | null;
      settledAmount: string | null;
    };

type ApiRnsQuote = {
  label: string;
  name: string;
  quote: {
    action: number;
    labelHash: Hex;
    beneficiary: Address;
    duration: string;
    priceWei: string;
    deadline: string;
    nonce: Hex;
  };
  signature: Hex;
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

export type RnsPricingSummary = {
  chainId: number;
  ethUsd: number;
  priceFetchedAt: string;
  multiYearPolicy: {
    type: string;
    discountBps?: number;
    schedule?: Array<{
      years: number;
      priceMultiplierBps: number;
      discountBps: number;
    }>;
    description: string;
  };
  tiers: Array<{
    label: string;
    minLength: number;
    maxLength: number;
    usdCentsPerYear: number;
    usdPerYear: string;
  }>;
  estimate: null | {
    label: string;
    name: string;
    years: string;
    usdCentsPerYear: number;
    usdPerYear: string;
    subtotalUsdCents: string;
    subtotalUsd: string;
    discountBps: number;
    discountPercent: string;
    discountUsdCents: string;
    discountUsd: string;
    totalUsdCents: string;
    totalUsd: string;
    priceEth: string;
    priceWei: string;
  };
};

export type RnsPrimaryAuctionSummary = {
  chainId: number;
  auctionId: bigint;
  name: string;
  fqdn: string;
  duration: bigint;
  reservePrice: bigint;
  startTime: bigint;
  endTime: bigint;
  currentExtensionWindow: bigint | null;
  bidCount: number;
  highestBidder: Address | null;
  highestBid: bigint;
  status: string;
  rawStatus?: string;
  winner: Address | null;
  settledAmount: bigint | null;
  createdTxHash: `0x${string}` | null;
  createdBlock: bigint | null;
  createdAt: string | null;
  lastIndexedBlock: bigint;
  lastIndexedAt: string | null;
};

export type RnsMarketplaceListingSummary = {
  chainId: number;
  listingId: bigint;
  node: `0x${string}`;
  name: string;
  fqdn: string;
  seller: Address;
  price: bigint;
  status: string;
  buyer: Address | null;
  purchasedPrice: bigint | null;
  createdTxHash: `0x${string}` | null;
  createdBlock: bigint | null;
  createdAt: string | null;
  lastIndexedBlock: bigint;
  lastIndexedAt: string | null;
};

export type RnsMarketplaceAuctionSummary = {
  chainId: number;
  auctionId: bigint;
  node: `0x${string}`;
  name: string;
  fqdn: string;
  seller: Address;
  reservePrice: bigint;
  startTime: bigint;
  endTime: bigint;
  currentExtensionWindow: bigint | null;
  bidCount: number;
  highestBidder: Address | null;
  highestBid: bigint;
  status: string;
  rawStatus?: string;
  winner: Address | null;
  settledAmount: bigint | null;
  createdTxHash: `0x${string}` | null;
  createdBlock: bigint | null;
  createdAt: string | null;
  lastIndexedBlock: bigint;
  lastIndexedAt: string | null;
};

export type RnsReservedSaleMode = "auction" | "buy_now";

export type RnsReservedNameSummary = {
  id: number;
  chainId: number;
  label: string;
  fqdn: string;
  category: string;
  enabled: boolean;
  saleMode: RnsReservedSaleMode;
  reservePriceWei: bigint | null;
  fixedPriceWei: bigint | null;
  auctionDurationSeconds: bigint;
  notes: string | null;
  displayOrder: number;
  primaryAuctionId: bigint | null;
  activationTxHash: `0x${string}` | null;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RnsNameResolution = IndexedRnsDomain & {
  name: string;
  isExpired: boolean;
};

export type RnsAddressResolution = {
  chainId: number;
  address: Address;
  primaryName: string | null;
  node: Hex | null;
  expiry: bigint | null;
  isExpired: boolean | null;
  resolutionSource: string | null;
  lastIndexedBlock: bigint | null;
  lastIndexedAt: string | null;
};

type ApiRnsMarketplaceListing = {
  chainId: number;
  listingId: string;
  node: `0x${string}`;
  name: string;
  fqdn: string;
  seller: Address;
  price: string;
  status: string;
  buyer: Address | null;
  purchasedPrice: string | null;
  createdTxHash: `0x${string}` | null;
  createdBlock: string | null;
  createdAt: string | null;
  lastIndexedBlock: string;
  lastIndexedAt: string | null;
};

type ApiRnsPrimaryAuction = {
  chainId: number;
  auctionId: string;
  name: string;
  fqdn: string;
  duration: string;
  reservePrice: string;
  startTime: string;
  endTime: string;
  currentExtensionWindow: string | null;
  bidCount: number;
  highestBidder: Address | null;
  highestBid: string;
  status: string;
  rawStatus?: string;
  winner: Address | null;
  settledAmount: string | null;
  createdTxHash: `0x${string}` | null;
  createdBlock: string | null;
  createdAt: string | null;
  lastIndexedBlock: string;
  lastIndexedAt: string | null;
};

type ApiRnsMarketplaceAuction = {
  chainId: number;
  auctionId: string;
  node: `0x${string}`;
  name: string;
  fqdn: string;
  seller: Address;
  reservePrice: string;
  startTime: string;
  endTime: string;
  currentExtensionWindow: string | null;
  bidCount: number;
  highestBidder: Address | null;
  highestBid: string;
  status: string;
  rawStatus?: string;
  winner: Address | null;
  settledAmount: string | null;
  createdTxHash: `0x${string}` | null;
  createdBlock: string | null;
  createdAt: string | null;
  lastIndexedBlock: string;
  lastIndexedAt: string | null;
};

type ApiRnsReservedName = {
  id: number;
  chainId: number;
  label: string;
  fqdn: string;
  category: string;
  enabled: boolean;
  saleMode: RnsReservedSaleMode;
  reservePriceWei: string | null;
  fixedPriceWei: string | null;
  auctionDurationSeconds?: string;
  notes: string | null;
  displayOrder: number;
  primaryAuctionId: string | null;
  activationTxHash: `0x${string}` | null;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiNotificationSubscriptionResponse = {
  ok: boolean;
};

type ApiRnsAddressResolution = {
  chainId: number;
  address: Address;
  primaryName: string | null;
  node: Hex | null;
  expiry: string | null;
  isExpired: boolean | null;
  resolutionSource: string | null;
  lastIndexedBlock: string | null;
  lastIndexedAt: string | null;
};

function toIndexedDomain(raw: ApiRnsName): IndexedRnsDomain {
  return {
    node: raw.node,
    label: raw.label ?? '',
    fqdn: raw.fqdn ?? '',
    owner: raw.owner,
    resolver: raw.resolver,
    resolvedAddress: raw.resolvedAddress,
    registrant: raw.registrant,
    expiry: BigInt(raw.expiry),
    registeredAt: BigInt(raw.registeredAt),
    renewedAt: raw.renewedAt ? BigInt(raw.renewedAt) : null,
    releasedAt: raw.releasedAt ? BigInt(raw.releasedAt) : null,
    createdAtBlock: BigInt(raw.createdAtBlock),
    custody: raw.custody ?? 'wallet',
    seller: raw.seller ?? null,
    marketplace: raw.marketplace ?? null,
  };
}

function toNameResolution(raw: ApiRnsName): RnsNameResolution {
  return {
    ...toIndexedDomain(raw),
    name: raw.name ?? raw.fqdn ?? '',
    isExpired: Boolean(raw.isExpired),
  };
}

function toAddressResolution(raw: ApiRnsAddressResolution): RnsAddressResolution {
  return {
    chainId: raw.chainId,
    address: raw.address,
    primaryName: raw.primaryName,
    node: raw.node,
    expiry: raw.expiry ? BigInt(raw.expiry) : null,
    isExpired: raw.isExpired,
    resolutionSource: raw.resolutionSource,
    lastIndexedBlock: raw.lastIndexedBlock ? BigInt(raw.lastIndexedBlock) : null,
    lastIndexedAt: raw.lastIndexedAt,
  };
}

function toMarketplaceListing(raw: ApiRnsMarketplaceListing): RnsMarketplaceListingSummary {
  return {
    chainId: raw.chainId,
    listingId: BigInt(raw.listingId),
    node: raw.node,
    name: raw.name,
    fqdn: raw.fqdn,
    seller: raw.seller,
    price: BigInt(raw.price),
    status: raw.status,
    buyer: raw.buyer,
    purchasedPrice: raw.purchasedPrice ? BigInt(raw.purchasedPrice) : null,
    createdTxHash: raw.createdTxHash,
    createdBlock: raw.createdBlock ? BigInt(raw.createdBlock) : null,
    createdAt: raw.createdAt,
    lastIndexedBlock: BigInt(raw.lastIndexedBlock),
    lastIndexedAt: raw.lastIndexedAt,
  };
}

function toMarketplaceAuction(raw: ApiRnsMarketplaceAuction): RnsMarketplaceAuctionSummary {
  return {
    chainId: raw.chainId,
    auctionId: BigInt(raw.auctionId),
    node: raw.node,
    name: raw.name,
    fqdn: raw.fqdn,
    seller: raw.seller,
    reservePrice: BigInt(raw.reservePrice),
    startTime: BigInt(raw.startTime),
    endTime: BigInt(raw.endTime),
    currentExtensionWindow: raw.currentExtensionWindow ? BigInt(raw.currentExtensionWindow) : null,
    bidCount: raw.bidCount,
    highestBidder: raw.highestBidder,
    highestBid: BigInt(raw.highestBid),
    status: raw.status,
    rawStatus: raw.rawStatus,
    winner: raw.winner,
    settledAmount: raw.settledAmount ? BigInt(raw.settledAmount) : null,
    createdTxHash: raw.createdTxHash,
    createdBlock: raw.createdBlock ? BigInt(raw.createdBlock) : null,
    createdAt: raw.createdAt,
    lastIndexedBlock: BigInt(raw.lastIndexedBlock),
    lastIndexedAt: raw.lastIndexedAt,
  };
}

function toPrimaryAuction(raw: ApiRnsPrimaryAuction): RnsPrimaryAuctionSummary {
  return {
    chainId: raw.chainId,
    auctionId: BigInt(raw.auctionId),
    name: raw.name,
    fqdn: raw.fqdn,
    duration: BigInt(raw.duration),
    reservePrice: BigInt(raw.reservePrice),
    startTime: BigInt(raw.startTime),
    endTime: BigInt(raw.endTime),
    currentExtensionWindow: raw.currentExtensionWindow ? BigInt(raw.currentExtensionWindow) : null,
    bidCount: raw.bidCount,
    highestBidder: raw.highestBidder,
    highestBid: BigInt(raw.highestBid),
    status: raw.status,
    rawStatus: raw.rawStatus,
    winner: raw.winner,
    settledAmount: raw.settledAmount ? BigInt(raw.settledAmount) : null,
    createdTxHash: raw.createdTxHash,
    createdBlock: raw.createdBlock ? BigInt(raw.createdBlock) : null,
    createdAt: raw.createdAt,
    lastIndexedBlock: BigInt(raw.lastIndexedBlock),
    lastIndexedAt: raw.lastIndexedAt,
  };
}

function toReservedName(raw: ApiRnsReservedName): RnsReservedNameSummary {
  return {
    id: raw.id,
    chainId: raw.chainId,
    label: raw.label,
    fqdn: raw.fqdn,
    category: raw.category,
    enabled: raw.enabled,
    saleMode: raw.saleMode,
    reservePriceWei: raw.reservePriceWei ? BigInt(raw.reservePriceWei) : null,
    fixedPriceWei: raw.fixedPriceWei ? BigInt(raw.fixedPriceWei) : null,
    auctionDurationSeconds: BigInt(raw.auctionDurationSeconds ?? "259200"),
    notes: raw.notes,
    displayOrder: raw.displayOrder,
    primaryAuctionId: raw.primaryAuctionId ? BigInt(raw.primaryAuctionId) : null,
    activationTxHash: raw.activationTxHash,
    activatedAt: raw.activatedAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export async function fetchRnsIndexedDomainsForOwner(
  owner: Address,
  chainId: number,
): Promise<IndexedRnsDomain[]> {
  const params = new URLSearchParams({ chainId: String(chainId) });
  const response = await fetch(
    `${SENNA_API_URL}/api/rns/names/${owner}?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`RNS API request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { names?: ApiRnsName[] };
  return (payload.names ?? []).map(toIndexedDomain);
}

export async function fetchRnsNameResolution(input: {
  name: string;
  chainId: number;
}): Promise<RnsNameResolution | null> {
  const label = normalizeRnsLookupName(input.name);
  if (!label) return null;

  const params = new URLSearchParams({ chainId: String(input.chainId) });
  const response = await fetch(
    `${SENNA_API_URL}/api/public/rns/resolve/name/${encodeURIComponent(`${label}.rise`)}?${params.toString()}`,
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`RNS name resolution request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ApiRnsName;
  return toNameResolution(payload);
}

export async function fetchRnsPrimaryNameForAddress(input: {
  address: Address;
  chainId: number;
}): Promise<RnsAddressResolution> {
  const address = coerceAddress(input.address);
  if (!address) {
    throw new Error('Provide a valid address for RNS reverse resolution.');
  }

  const params = new URLSearchParams({ chainId: String(input.chainId) });
  const response = await fetch(
    `${SENNA_API_URL}/api/public/rns/resolve/address/${address}?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`RNS address resolution request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ApiRnsAddressResolution;
  return toAddressResolution(payload);
}

export async function resolveRnsAddressInput(input: {
  value: string;
  chainId: number;
}): Promise<Address | null> {
  const directAddress = coerceAddress(input.value);
  if (directAddress) return directAddress;

  const resolution = await fetchRnsNameResolution({
    name: input.value,
    chainId: input.chainId,
  });

  if (!resolution || resolution.isExpired || !resolution.resolvedAddress) return null;
  return coerceAddress(resolution.resolvedAddress);
}

export async function fetchRnsPriceQuote(input: {
  action: 'register' | 'renew' | 'fixed_premium_register';
  name: string;
  beneficiary: Address;
  chainId: number;
  duration: bigint;
}): Promise<RnsRegistrationQuote> {
  const response = await fetch(`${SENNA_API_URL}/api/rns/quote`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      action: input.action,
      name: input.name,
      beneficiary: input.beneficiary,
      chainId: input.chainId,
      durationSeconds: input.duration.toString(),
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(payload?.detail ?? `RNS quote request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ApiRnsQuote;
  const signedQuote: RnsSignedPriceQuote = {
    action: payload.quote.action,
    labelHash: payload.quote.labelHash,
    beneficiary: payload.quote.beneficiary,
    duration: BigInt(payload.quote.duration),
    priceWei: BigInt(payload.quote.priceWei),
    deadline: BigInt(payload.quote.deadline),
    nonce: payload.quote.nonce,
  };

  return {
    name: payload.label,
    duration: signedQuote.duration,
    price: signedQuote.priceWei,
    available: true,
    signedQuote,
    signature: payload.signature,
    display: payload.display,
  };
}

export async function fetchRnsPricing(input: {
  chainId: number;
  name?: string;
  duration?: bigint;
}): Promise<RnsPricingSummary> {
  const params = new URLSearchParams({ chainId: String(input.chainId) });
  if (input.name) params.set('name', input.name);
  if (input.duration) params.set('durationSeconds', input.duration.toString());

  const response = await fetch(`${SENNA_API_URL}/api/rns/pricing?${params.toString()}`);

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(payload?.detail ?? `RNS pricing request failed with status ${response.status}`);
  }

  return response.json() as Promise<RnsPricingSummary>;
}

export async function fetchRnsMarketplaceListings(input: {
  chainId: number;
  limit?: number;
}): Promise<RnsMarketplaceListingSummary[]> {
  const params = new URLSearchParams({ chainId: String(input.chainId) });
  if (input.limit) params.set("limit", String(input.limit));
  const response = await fetch(`${SENNA_API_URL}/api/public/rns/marketplace/listings?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`RNS marketplace listings request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { listings?: ApiRnsMarketplaceListing[] };
  return (payload.listings ?? []).map(toMarketplaceListing);
}

export async function fetchRnsPrimaryAuctions(input: {
  chainId: number;
  limit?: number;
}): Promise<RnsPrimaryAuctionSummary[]> {
  const params = new URLSearchParams({ chainId: String(input.chainId) });
  if (input.limit) params.set("limit", String(input.limit));
  const response = await fetch(`${SENNA_API_URL}/api/public/rns/auctions?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`RNS primary auctions request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { auctions?: ApiRnsPrimaryAuction[] };
  return (payload.auctions ?? []).map(toPrimaryAuction);
}

export async function fetchRnsMarketplaceAuctions(input: {
  chainId: number;
  limit?: number;
}): Promise<RnsMarketplaceAuctionSummary[]> {
  const params = new URLSearchParams({ chainId: String(input.chainId) });
  if (input.limit) params.set("limit", String(input.limit));
  const response = await fetch(`${SENNA_API_URL}/api/public/rns/marketplace/auctions?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`RNS marketplace auctions request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { auctions?: ApiRnsMarketplaceAuction[] };
  return (payload.auctions ?? []).map(toMarketplaceAuction);
}

export async function fetchRnsMarketplaceReserved(input: {
  chainId: number;
  limit?: number;
}): Promise<RnsReservedNameSummary[]> {
  const params = new URLSearchParams({ chainId: String(input.chainId) });
  if (input.limit) params.set("limit", String(input.limit));
  const response = await fetch(`${SENNA_API_URL}/api/public/rns/marketplace/reserved?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`RNS reserved inventory request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { names?: ApiRnsReservedName[] };
  return (payload.names ?? []).map(toReservedName);
}

export async function subscribeRnsMarketplaceNotifications(input: {
  chainId: number;
  scope: "marketplace_seller" | "marketplace_bidder" | "marketplace_watcher";
  email: string;
  wallet?: Address | null;
  name?: string | null;
  node?: Hex | null;
  auctionId?: bigint | null;
  listingId?: bigint | null;
}) {
  const response = await fetch(`${SENNA_API_URL}/api/rns/notifications/subscribe`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      chainId: input.chainId,
      scope: input.scope,
      email: input.email,
      wallet: input.wallet ?? undefined,
      name: input.name ?? undefined,
      node: input.node ?? undefined,
      auctionId: input.auctionId?.toString(),
      listingId: input.listingId?.toString(),
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail ?? `RNS notification subscription failed with status ${response.status}`);
  }

  return response.json() as Promise<ApiNotificationSubscriptionResponse>;
}

export async function fetchRnsAdminReservedNames(input: {
  chainId: number;
}): Promise<RnsReservedNameSummary[]> {
  const params = new URLSearchParams({ chainId: String(input.chainId) });
  const response = await fetch(`${SENNA_API_URL}/api/rns/admin/reserved?${params.toString()}`);

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail ?? `RNS admin reserved inventory request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { names?: ApiRnsReservedName[] };
  return (payload.names ?? []).map(toReservedName);
}

export async function upsertRnsAdminReservedName(input: {
  chainId: number;
  label: string;
  category?: string;
  enabled?: boolean;
  saleMode?: RnsReservedSaleMode;
  reservePriceWei?: bigint | null;
  fixedPriceWei?: bigint | null;
  auctionDurationSeconds?: bigint;
  notes?: string | null;
  displayOrder?: number;
}) {
  const response = await fetch(`${SENNA_API_URL}/api/rns/admin/reserved`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      chainId: input.chainId,
      label: input.label,
      category: input.category,
      enabled: input.enabled,
      saleMode: input.saleMode,
      reservePriceWei: input.reservePriceWei?.toString() ?? null,
      fixedPriceWei: input.fixedPriceWei?.toString() ?? null,
      auctionDurationSeconds: input.auctionDurationSeconds?.toString(),
      notes: input.notes ?? null,
      displayOrder: input.displayOrder,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail ?? `RNS admin reserved inventory update failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { ok: boolean; name: ApiRnsReservedName };
  return toReservedName(payload.name);
}

export async function activateRnsAdminReservedName(input: {
  chainId: number;
  id: number;
  txHash: Hex;
}) {
  const response = await fetch(`${SENNA_API_URL}/api/rns/admin/reserved/activate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      chainId: input.chainId,
      id: input.id,
      txHash: input.txHash,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail ?? `RNS reserved name activation failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { ok: boolean; name: ApiRnsReservedName | null };
  return payload.name ? toReservedName(payload.name) : null;
}
