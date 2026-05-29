/**
 * Per-address primary `.rise` label preference stored in localStorage.
 * When set, this overrides the default "first domain" returned by the subgraph.
 */

const STORAGE_KEY = "rns_primary_label_v1";

type PrimaryMap = Record<string, string>; // address (lowercase) → label

function read(): PrimaryMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PrimaryMap) : {};
  } catch {
    return {};
  }
}

function write(map: PrimaryMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

export function getPrimaryLabel(address: string): string | null {
  return read()[address.toLowerCase()] ?? null;
}

export function setPrimaryLabel(address: string, label: string): void {
  const map = read();
  map[address.toLowerCase()] = label.toLowerCase();
  write(map);
}

export function clearPrimaryLabel(address: string): void {
  const map = read();
  delete map[address.toLowerCase()];
  write(map);
}
