import type { Address } from 'viem';

const GOLDSKY_ENDPOINT = import.meta.env.VITE_GOLDSKY_RISE_SUBGRAPH_URL?.trim() ?? '';
const PAGE_SIZE = 200;
const MAX_ITEMS = 5000;

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type RawPresale = {
  id: string;
  creator: string;
  saleToken: string;
  paymentToken: string;
  isPaymentETH: boolean;
  requiresWhitelist: boolean;
  startTime: string;
  endTime: string;
  rate: string;
  softCap: string;
  hardCap: string;
  minContribution: string;
  maxContribution: string;
  totalRaised: string;
  committedTokens: string;
  totalTokensDeposited: string;
  successfulFinalization: boolean;
  claimEnabled: boolean;
  refundsEnabled: boolean;
  owner: string;
  saleTokenSymbol?: string | null;
  saleTokenName?: string | null;
  saleTokenDecimals?: number | null;
  paymentTokenSymbol?: string | null;
  paymentTokenName?: string | null;
  paymentTokenDecimals?: number | null;
};

type RawNftCollection = {
  id: string;
  creator: string;
  owner: string;
  payoutWallet: string;
  is721A: boolean;
  name: string;
  symbol: string;
  contractURI: string;
  maxSupply: string;
  totalMinted: string;
  remaining: string;
  mintPrice: string;
  walletLimit: number;
  saleStart: string;
  saleEnd: string;
  whitelistEnabled?: boolean | null;
  whitelistStart?: string | null;
  whitelistPrice?: string | null;
};

export type IndexedPresale = {
  address: Address;
  creator: Address;
  saleToken: Address;
  paymentToken: Address;
  isPaymentETH: boolean;
  requiresWhitelist: boolean;
  startTime: bigint;
  endTime: bigint;
  rate: bigint;
  softCap: bigint;
  hardCap: bigint;
  minContribution: bigint;
  maxContribution: bigint;
  totalRaised: bigint;
  committedTokens: bigint;
  totalTokensDeposited: bigint;
  successfulFinalization: boolean;
  claimEnabled: boolean;
  refundsEnabled: boolean;
  owner: Address;
  saleTokenSymbol?: string;
  saleTokenName?: string;
  saleTokenDecimals?: number;
  paymentTokenSymbol?: string;
  paymentTokenName?: string;
  paymentTokenDecimals?: number;
};

export type IndexedNftCollection = {
  address: Address;
  creator: Address;
  owner: Address;
  payoutWallet: Address;
  is721A: boolean;
  name: string;
  symbol: string;
  contractURI: string;
  maxSupply: bigint;
  totalMinted: bigint;
  remaining: bigint;
  mintPrice: bigint;
  walletLimit: number;
  saleStart: bigint;
  saleEnd: bigint;
  whitelistEnabled?: boolean;
  whitelistStart?: bigint;
  whitelistPrice?: bigint;
};

const PRESALES_QUERY = /* GraphQL */ `
  query Presales($first: Int!, $skip: Int!) {
    presales(first: $first, skip: $skip, orderBy: createdAtBlock, orderDirection: desc) {
      id
      creator
      saleToken
      paymentToken
      isPaymentETH
      requiresWhitelist
      startTime
      endTime
      rate
      softCap
      hardCap
      minContribution
      maxContribution
      totalRaised
      committedTokens
      totalTokensDeposited
      successfulFinalization
      claimEnabled
      refundsEnabled
      owner
      saleTokenSymbol
      saleTokenName
      saleTokenDecimals
      paymentTokenSymbol
      paymentTokenName
      paymentTokenDecimals
    }
  }
`;

const NFT_COLLECTIONS_QUERY = /* GraphQL */ `
  query NftCollections($first: Int!, $skip: Int!) {
    nftCollections(first: $first, skip: $skip, orderBy: createdAtBlock, orderDirection: desc) {
      id
      creator
      owner
      payoutWallet
      is721A
      name
      symbol
      contractURI
      maxSupply
      totalMinted
      remaining
      mintPrice
      walletLimit
      saleStart
      saleEnd
    }
  }
`;

const NFT_COLLECTIONS_BY_CREATOR_QUERY = /* GraphQL */ `
  query NftCollectionsByCreator($first: Int!, $skip: Int!, $creator: Bytes!) {
    nftCollections(
      first: $first
      skip: $skip
      orderBy: createdAtBlock
      orderDirection: desc
      where: { creator: $creator }
    ) {
      id
      creator
      owner
      payoutWallet
      is721A
      name
      symbol
      contractURI
      maxSupply
      totalMinted
      remaining
      mintPrice
      walletLimit
      saleStart
      saleEnd
    }
  }
`;

function toAddress(value: string): Address {
  return value as Address;
}

function toBigInt(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  return BigInt(value);
}

async function goldskyRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!GOLDSKY_ENDPOINT) {
    throw new Error('Goldsky endpoint is not configured');
  }

  const response = await fetch(GOLDSKY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Goldsky request failed with ${response.status}`);
  }

  const json = (await response.json()) as GraphQLResponse<T>;
  if (json.errors?.length) {
    throw new Error(json.errors.map((err) => err.message).join('; '));
  }

  if (!json.data) {
    throw new Error('Goldsky returned an empty response');
  }

  return json.data;
}

export function isGoldskyIndexerConfigured(): boolean {
  return GOLDSKY_ENDPOINT.length > 0;
}

export async function fetchIndexedPresales(): Promise<IndexedPresale[]> {
  const rows: RawPresale[] = [];

  for (let skip = 0; skip < MAX_ITEMS; skip += PAGE_SIZE) {
    const data = await goldskyRequest<{ presales: RawPresale[] }>(PRESALES_QUERY, {
      first: PAGE_SIZE,
      skip,
    });

    const page = data.presales ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows.map((row) => ({
    address: toAddress(row.id),
    creator: toAddress(row.creator),
    saleToken: toAddress(row.saleToken),
    paymentToken: toAddress(row.paymentToken),
    isPaymentETH: row.isPaymentETH,
    requiresWhitelist: row.requiresWhitelist,
    startTime: toBigInt(row.startTime),
    endTime: toBigInt(row.endTime),
    rate: toBigInt(row.rate),
    softCap: toBigInt(row.softCap),
    hardCap: toBigInt(row.hardCap),
    minContribution: toBigInt(row.minContribution),
    maxContribution: toBigInt(row.maxContribution),
    totalRaised: toBigInt(row.totalRaised),
    committedTokens: toBigInt(row.committedTokens),
    totalTokensDeposited: toBigInt(row.totalTokensDeposited),
    successfulFinalization: row.successfulFinalization,
    claimEnabled: row.claimEnabled,
    refundsEnabled: row.refundsEnabled,
    owner: toAddress(row.owner),
    saleTokenSymbol: row.saleTokenSymbol ?? undefined,
    saleTokenName: row.saleTokenName ?? undefined,
    saleTokenDecimals: row.saleTokenDecimals ?? undefined,
    paymentTokenSymbol: row.paymentTokenSymbol ?? undefined,
    paymentTokenName: row.paymentTokenName ?? undefined,
    paymentTokenDecimals: row.paymentTokenDecimals ?? undefined,
  }));
}

export async function fetchIndexedNftCollections(creator?: Address): Promise<IndexedNftCollection[]> {
  const rows: RawNftCollection[] = [];
  const query = creator ? NFT_COLLECTIONS_BY_CREATOR_QUERY : NFT_COLLECTIONS_QUERY;

  for (let skip = 0; skip < MAX_ITEMS; skip += PAGE_SIZE) {
    const data = await goldskyRequest<{ nftCollections: RawNftCollection[] }>(query, {
      first: PAGE_SIZE,
      skip,
      ...(creator ? { creator: creator.toLowerCase() } : {}),
    });

    const page = data.nftCollections ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows.map((row) => ({
    address: toAddress(row.id),
    creator: toAddress(row.creator),
    owner: toAddress(row.owner),
    payoutWallet: toAddress(row.payoutWallet),
    is721A: row.is721A,
    name: row.name,
    symbol: row.symbol,
    contractURI: row.contractURI,
    maxSupply: toBigInt(row.maxSupply),
    totalMinted: toBigInt(row.totalMinted),
    remaining: toBigInt(row.remaining),
    mintPrice: toBigInt(row.mintPrice),
    walletLimit: Number(row.walletLimit ?? 0),
    saleStart: toBigInt(row.saleStart),
    saleEnd: toBigInt(row.saleEnd),
    whitelistEnabled: row.whitelistEnabled ?? undefined,
    whitelistStart: row.whitelistStart ? toBigInt(row.whitelistStart) : undefined,
    whitelistPrice: row.whitelistPrice ? toBigInt(row.whitelistPrice) : undefined,
  }));
}
