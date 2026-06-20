import type { Address, Hex } from "viem";

const RNS_ENDPOINT =
  import.meta.env.VITE_RNS_SUBGRAPH_URL?.trim() ?? "";

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

// ─── Raw subgraph shapes ──────────────────────────────────────────────────────

type RawRnsDomain = {
  id: string;
  label: string;
  fqdn: string;
  owner: string;
  resolver: string | null;
  resolvedAddress: string | null;
  registrant: string;
  expiry: string;
  registeredAt: string;
  renewedAt: string | null;
  releasedAt: string | null;
  createdAtBlock: string;
};

type RawRnsReverseRecord = {
  id: string;
  domain: RawRnsDomain;
};

// ─── Public types ─────────────────────────────────────────────────────────────

export type IndexedRnsDomain = {
  node: Hex;
  label: string;
  fqdn: string;
  owner: Address;
  resolver: Address | null;
  resolvedAddress: Address | null;
  registrant: Address;
  expiry: bigint;
  registeredAt: bigint;
  renewedAt: bigint | null;
  releasedAt: bigint | null;
  createdAtBlock: bigint;
  custody?: "wallet" | "marketplace_listing" | "marketplace_auction";
  seller?: Address | null;
  marketplace?: IndexedRnsMarketplaceSummary | null;
};

export type IndexedRnsMarketplaceSummary =
  | {
      kind: "listing";
      listingId: string;
      status: string;
      seller: Address;
      price: string;
      buyer: Address | null;
      purchasedPrice: string | null;
    }
  | {
      kind: "auction";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toAddress(v: string): Address {
  return v as Address;
}

function toBigInt(v: string | null | undefined): bigint {
  return v ? BigInt(v) : 0n;
}

function toNullableBigInt(v: string | null | undefined): bigint | null {
  return v ? BigInt(v) : null;
}

function toDomain(raw: RawRnsDomain): IndexedRnsDomain {
  return {
    node: raw.id as Hex,
    label: raw.label,
    fqdn: raw.fqdn,
    owner: toAddress(raw.owner),
    resolver: raw.resolver ? toAddress(raw.resolver) : null,
    resolvedAddress: raw.resolvedAddress
      ? toAddress(raw.resolvedAddress)
      : null,
    registrant: toAddress(raw.registrant),
    expiry: toBigInt(raw.expiry),
    registeredAt: toBigInt(raw.registeredAt),
    renewedAt: toNullableBigInt(raw.renewedAt),
    releasedAt: toNullableBigInt(raw.releasedAt),
    createdAtBlock: toBigInt(raw.createdAtBlock),
  };
}

async function rnsRequest<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  if (!RNS_ENDPOINT) {
    throw new Error("RNS subgraph endpoint is not configured (VITE_RNS_SUBGRAPH_URL)");
  }

  const res = await fetch(RNS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`RNS subgraph request failed with status ${res.status}`);
  }

  const json = (await res.json()) as GraphQLResponse<T>;

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  if (!json.data) {
    throw new Error("RNS subgraph returned an empty response");
  }

  return json.data;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

const DOMAIN_FRAGMENT = /* GraphQL */ `
  id
  label
  fqdn
  owner
  resolver
  resolvedAddress
  registrant
  expiry
  registeredAt
  renewedAt
  releasedAt
  createdAtBlock
`;

/** Fetch one domain by its namehash node (hex). Returns null if not indexed yet. */
export async function fetchRnsDomainByNode(
  node: Hex
): Promise<IndexedRnsDomain | null> {
  const data = await rnsRequest<{ rnsDomain: RawRnsDomain | null }>(
    /* GraphQL */ `
      query RnsDomainByNode($id: ID!) {
        rnsDomain(id: $id) { ${DOMAIN_FRAGMENT} }
      }
    `,
    { id: node.toLowerCase() }
  );

  return data.rnsDomain ? toDomain(data.rnsDomain) : null;
}

/** Fetch one domain by label (e.g. "alice"). Returns null if not found. */
export async function fetchRnsDomainByLabel(
  label: string
): Promise<IndexedRnsDomain | null> {
  const normalized = label.toLowerCase().replace(/\.rise$/i, "");
  const data = await rnsRequest<{ rnsDomains: RawRnsDomain[] }>(
    /* GraphQL */ `
      query RnsDomainByLabel($label: String!) {
        rnsDomains(first: 1, where: { label: $label }) { ${DOMAIN_FRAGMENT} }
      }
    `,
    { label: normalized }
  );

  return data.rnsDomains?.[0] ? toDomain(data.rnsDomains[0]) : null;
}

/** Fetch all active (non-released) domains owned by an address. */
export async function fetchRnsDomainsForOwner(
  owner: Address
): Promise<IndexedRnsDomain[]> {
  const PAGE = 100;
  const rows: RawRnsDomain[] = [];

  for (let skip = 0; ; skip += PAGE) {
    const data = await rnsRequest<{ rnsDomains: RawRnsDomain[] }>(
      /* GraphQL */ `
        query RnsDomainsByOwner($owner: Bytes!, $first: Int!, $skip: Int!) {
          rnsDomains(
            first: $first
            skip: $skip
            orderBy: registeredAt
            orderDirection: desc
            where: { owner: $owner, releasedAt: null }
          ) { ${DOMAIN_FRAGMENT} }
        }
      `,
      { owner: owner.toLowerCase(), first: PAGE, skip }
    );

    const page = data.rnsDomains ?? [];
    rows.push(...page);
    if (page.length < PAGE) break;
  }

  return rows.map(toDomain);
}

/** Reverse lookup: address → primary domain. Returns null if none set. */
export async function fetchRnsReverseRecord(
  address: Address
): Promise<IndexedRnsDomain | null> {
  const data = await rnsRequest<{
    rnsReverseRecord: RawRnsReverseRecord | null;
  }>(
    /* GraphQL */ `
      query RnsReverseRecord($id: ID!) {
        rnsReverseRecord(id: $id) {
          id
          domain { ${DOMAIN_FRAGMENT} }
        }
      }
    `,
    { id: address.toLowerCase() }
  );

  return data.rnsReverseRecord
    ? toDomain(data.rnsReverseRecord.domain)
    : null;
}

export function isRnsSubgraphConfigured(): boolean {
  return RNS_ENDPOINT.length > 0;
}
