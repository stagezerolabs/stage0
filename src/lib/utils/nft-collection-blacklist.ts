import type { Address } from 'viem';

const BLACKLISTED_COLLECTION_LABELS = new Set(['HGFHGG']);

type CollectionIdentity = {
  address?: Address;
  name?: string;
  symbol?: string;
};

function normalizeLabel(value?: string): string {
  return (value ?? '').trim().toUpperCase();
}

export function isBlacklistedNFTCollection(collection: CollectionIdentity): boolean {
  const name = normalizeLabel(collection.name);
  const symbol = normalizeLabel(collection.symbol);

  return BLACKLISTED_COLLECTION_LABELS.has(name) || BLACKLISTED_COLLECTION_LABELS.has(symbol);
}
