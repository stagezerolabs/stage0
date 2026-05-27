const REGISTRY_KEY = 'stage0.domains.registry';

export const DOMAIN_SUFFIX = '.rise';

const RESERVED_NAMES = new Set([
  'admin',
  'api',
  'www',
  'app',
  'mail',
  'ftp',
  'rise',
  'dashboard',
  'presales',
  'tools',
]);

export type DomainRegistry = Record<string, string>;

export function normalizeDomainName(input: string): string {
  return input.trim().toLowerCase().replace(/\.rise$/i, '');
}

export function validateDomainName(name: string): { valid: boolean; error?: string } {
  if (!name) {
    return { valid: false, error: 'Enter a name to search or mint.' };
  }
  if (name.length < 3) {
    return { valid: false, error: 'Names must be at least 3 characters.' };
  }
  if (name.length > 32) {
    return { valid: false, error: 'Names must be 32 characters or fewer.' };
  }
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(name)) {
    return {
      valid: false,
      error: 'Use lowercase letters, numbers, and hyphens (not at the start or end).',
    };
  }
  if (RESERVED_NAMES.has(name)) {
    return { valid: false, error: 'This name is reserved.' };
  }
  return { valid: true };
}

export function getRegistry(): DomainRegistry {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(REGISTRY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DomainRegistry;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveRegistry(registry: DomainRegistry): void {
  window.localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  window.dispatchEvent(new CustomEvent('rise:domain-updated'));
}

export function getDomainForAddress(address: string): string | null {
  const owner = address.toLowerCase();
  const registry = getRegistry();
  for (const [name, registeredOwner] of Object.entries(registry)) {
    if (registeredOwner.toLowerCase() === owner) {
      return name;
    }
  }
  return null;
}

export function isDomainAvailable(name: string): boolean {
  const normalized = normalizeDomainName(name);
  const validation = validateDomainName(normalized);
  if (!validation.valid) return false;
  return !getRegistry()[normalized];
}

export function getDomainOwner(name: string): string | null {
  const normalized = normalizeDomainName(name);
  return getRegistry()[normalized] ?? null;
}

export function formatDomainDisplay(name: string): string {
  return `${normalizeDomainName(name)}${DOMAIN_SUFFIX}`;
}

export type MintDomainResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

export function mintDomain(name: string, ownerAddress: string): MintDomainResult {
  const normalized = normalizeDomainName(name);
  const validation = validateDomainName(normalized);
  if (!validation.valid) {
    return { ok: false, error: validation.error ?? 'Invalid name.' };
  }

  const registry = getRegistry();
  if (registry[normalized]) {
    return { ok: false, error: 'This name is already taken.' };
  }

  const owner = ownerAddress.toLowerCase();
  const existing = getDomainForAddress(owner);
  if (existing) {
    return {
      ok: false,
      error: `You already own ${formatDomainDisplay(existing)}. Names are stored locally for testing.`,
    };
  }

  registry[normalized] = owner;
  saveRegistry(registry);
  return { ok: true, name: normalized };
}
