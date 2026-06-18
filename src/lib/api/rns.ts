import type { IndexedRnsDomain } from '@/lib/indexer/rns-goldsky';
import type { RnsRegistrationQuote, RnsSignedPriceQuote } from '@/lib/rns/types';
import type { Address, Hex } from 'viem';

const SENNA_API_URL =
  (import.meta.env.VITE_SENNA_CHAT_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:8788';

type ApiRnsName = {
  chainId: number;
  node: `0x${string}`;
  label: string | null;
  fqdn: string | null;
  registrant: Address;
  owner: Address;
  expiry: string;
  resolver: Address | null;
  resolvedAddress: Address | null;
  registeredTxHash: `0x${string}` | null;
  registeredAt: string;
  renewedAt: string | null;
  releasedAt: string | null;
  createdAtBlock: string;
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

export async function fetchRnsPriceQuote(input: {
  action: 'register' | 'renew';
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
