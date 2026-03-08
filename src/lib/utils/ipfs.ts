export const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

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
        value = pathname.replace(/^\/+/, '');
      }
    } catch {
      value = value.replace(/^https?:\/\//i, '');
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

function extractContractCid(raw: string): string {
  let path = extractIpfsPath(raw);
  if (!path) return '';

  path = path
    .replace(/\/(?:contract|collection|metadata)\.json$/i, '')
    .replace(/\/+$/, '');

  const [cid] = path.split('/');
  return cid || '';
}

export function normalizeContractURI(raw: string): string {
  const cid = extractContractCid(raw);
  return cid ? `ipfs://${cid}` : '';
}

export function contractUriToHttp(raw: string): string {
  const cid = extractContractCid(raw);
  return cid ? `${IPFS_GATEWAY}${cid}` : '';
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
