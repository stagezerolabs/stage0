export const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';
const CONTRACT_METADATA_FILENAMES = ['contract.json', 'collection.json', 'metadata.json'] as const;

function stripQueryAndHash(value: string): string {
  return value.split('#')[0].split('?')[0];
}

function extractIpfsPath(raw: string): string {
  let value = stripQueryAndHash(raw.trim());
  if (!value) return '';

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const pathname = stripQueryAndHash(url.pathname);
      const ipfsPathMatch = pathname.match(/\/ipfs\/(.+)/i);

      if (ipfsPathMatch?.[1]) {
        value = ipfsPathMatch[1];
      } else if (url.hostname.includes('.ipfs.')) {
        const cidFromHost = url.hostname.split('.ipfs.')[0];
        const path = pathname.replace(/^\/+/, '');
        value = path ? `${cidFromHost}/${path}` : cidFromHost;
      } else {
        return '';
      }
    } catch {
      return '';
    }
  }

  if (/^ipfs:\/\//i.test(value)) {
    value = value.replace(/^ipfs:\/\//i, '');
  }

  value = value
    .replace(/^ipfs\//i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

  return stripQueryAndHash(value);
}

export function normalizeContractURI(raw: string): string {
  const normalized = stripQueryAndHash(raw.trim());
  if (!normalized) return '';

  if (/^https?:\/\//i.test(normalized)) {
    const ipfsPath = extractIpfsPath(normalized);
    return ipfsPath ? `ipfs://${ipfsPath}` : normalized;
  }

  if (/^ipfs:\/\//i.test(normalized)) {
    const ipfsPath = extractIpfsPath(normalized);
    return ipfsPath ? `ipfs://${ipfsPath}` : '';
  }

  const ipfsPath = extractIpfsPath(normalized);
  return ipfsPath ? `ipfs://${ipfsPath}` : '';
}

export function contractUriToHttp(raw: string): string {
  const normalized = stripQueryAndHash(raw.trim());
  if (!normalized) return '';

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  const ipfsPath = extractIpfsPath(normalized);
  return ipfsPath ? `${IPFS_GATEWAY}${ipfsPath}` : '';
}

export function ipfsUriToHttp(raw: string): string {
  const normalized = raw.trim();
  if (!normalized) return '';

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  const path = extractIpfsPath(normalized);
  return path ? `${IPFS_GATEWAY}${path}` : normalized;
}

function looksLikeJsonPath(pathname: string): boolean {
  return /\.json$/i.test(pathname.replace(/\/+$/, ''));
}

export function getContractMetadataCandidateUrls(raw: string): string[] {
  const base = contractUriToHttp(raw).replace(/\/+$/, '');
  if (!base) return [];

  const candidates = [base];

  try {
    const url = new URL(base);
    if (!looksLikeJsonPath(url.pathname)) {
      for (const filename of CONTRACT_METADATA_FILENAMES) {
        candidates.push(`${base}/${filename}`);
      }
    }
  } catch {
    if (!looksLikeJsonPath(base)) {
      for (const filename of CONTRACT_METADATA_FILENAMES) {
        candidates.push(`${base}/${filename}`);
      }
    }
  }

  return Array.from(new Set(candidates));
}
