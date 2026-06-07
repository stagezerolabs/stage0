import type { IndexedRnsDomain } from '@/lib/indexer/rns-goldsky';
import type { Address } from 'viem';

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
