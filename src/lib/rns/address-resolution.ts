import { getAddress, isAddress, type Address } from 'viem';

const RNS_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function coerceAddress(value: string | null | undefined): Address | null {
  const trimmed = value?.trim();
  if (!trimmed || !isAddress(trimmed)) return null;

  try {
    return getAddress(trimmed) as Address;
  } catch {
    return null;
  }
}

export function normalizeRnsLookupName(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed || coerceAddress(trimmed)) return null;
  if (trimmed.includes('.') && !trimmed.endsWith('.rise')) return null;

  const label = trimmed.replace(/\.rise$/i, '');
  if (label.length < 1 || label.length > 32) return null;
  if (!RNS_LABEL_RE.test(label)) return null;

  return label;
}

export function looksLikeRnsLookup(value: string | null | undefined): boolean {
  return Boolean(normalizeRnsLookupName(value));
}

export function formatRnsLookupName(value: string): string {
  const label = normalizeRnsLookupName(value);
  return label ? `${label}.rise` : value;
}

export function shortAddress(value: string | null | undefined): string {
  if (!value) return '';
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}
