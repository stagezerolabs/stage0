/**
 * Lightweight localStorage cache that maps namehash node → label string.
 *
 * The Goldsky subgraph stores the label by decoding transaction calldata,
 * but Rise Testnet's node doesn't expose calldata in the event context so
 * decodeLabelFromRegisterCalldata returns "". This cache supplements those
 * empty entries so the UI can show the correct name immediately after
 * registration and on subsequent page loads.
 */

const STORAGE_KEY = "rns_label_cache_v1";

type LabelCache = Record<string, string>; // node (0x…) → label (e.g. "alice")

function read(): LabelCache {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LabelCache) : {};
  } catch {
    return {};
  }
}

function write(cache: LabelCache): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Storage quota exceeded — silently ignore.
  }
}

/** Persist a node → label mapping after a successful registration. */
export function cacheRnsLabel(node: string, label: string): void {
  const cache = read();
  cache[node.toLowerCase()] = label.toLowerCase();
  write(cache);
}

/** Look up a label for a node. Returns null when not cached. */
export function getCachedRnsLabel(node: string): string | null {
  return read()[node.toLowerCase()] ?? null;
}

/**
 * Seed the cache from a list of candidate labels (e.g. the user's search
 * history). For each candidate, compute its namehash and check if it matches
 * any of the provided nodes with an empty label. This lets us recover labels
 * for domains registered before the cache was introduced.
 */
export function seedCacheFromCandidates(
  nodes: string[],
  candidates: string[],
  namehashFn: (label: string) => string,
): void {
  if (!nodes.length || !candidates.length) return;
  const nodeSet = new Set(nodes.map((n) => n.toLowerCase()));
  const cache = read();
  let dirty = false;
  for (const candidate of candidates) {
    const node = namehashFn(candidate).toLowerCase();
    if (nodeSet.has(node) && !cache[node]) {
      cache[node] = candidate.toLowerCase();
      dirty = true;
    }
  }
  if (dirty) write(cache);
}
