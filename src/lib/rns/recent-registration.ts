/**
 * Persists recently registered domains so the UI can show them immediately
 * while the Goldsky subgraph indexes the transaction (can take 30s–several min).
 */

const KEY = 'rns_recent_reg_v1';
const TTL_MS = 60 * 60 * 1000; // 1 hour

export interface RecentRegistration {
  address: string;
  label: string;
  node: string;
  /** Estimated expiry (unix seconds). Defaults to now + 1 year. */
  expiry: number;
  registeredAt: number;
}

function readAll(): RecentRegistration[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentRegistration[]) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: RecentRegistration[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // localStorage may be unavailable (private mode, quota, etc.) — safe to ignore.
  }
}

export const RNS_RECENT_REGISTRATION_EVENT = 'rns:recent-registration-changed';

/** Save a just-registered domain. Deduplicates by (address, label). */
export function saveRecentRegistration(
  address: string,
  label: string,
  node: string,
): void {
  const expiry = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
  const entry: RecentRegistration = {
    address: address.toLowerCase(),
    label: label.toLowerCase(),
    node: node.toLowerCase(),
    expiry,
    registeredAt: Date.now(),
  };
  const existing = readAll().filter(
    (r) => !(r.address === entry.address && r.label === entry.label),
  );
  writeAll([entry, ...existing]);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RNS_RECENT_REGISTRATION_EVENT));
  }
}

/** Get recent registrations for a given address, excluding expired TTL entries. */
export function getRecentRegistrations(address: string): RecentRegistration[] {
  const cutoff = Date.now() - TTL_MS;
  return readAll().filter(
    (r) =>
      r.address.toLowerCase() === address.toLowerCase() &&
      r.registeredAt > cutoff,
  );
}

/** Remove a registration once the subgraph has indexed it. */
export function removeRecentRegistration(address: string, label: string): void {
  const next = readAll().filter(
    (r) =>
      !(
        r.address.toLowerCase() === address.toLowerCase() &&
        r.label.toLowerCase() === label.toLowerCase()
      ),
  );
  writeAll(next);
}
