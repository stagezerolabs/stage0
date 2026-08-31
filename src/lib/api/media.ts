import type { Address } from 'viem';
import { SENNA_API_URL } from './base-url';

export const STAGE0_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const STAGE0_IMAGE_ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export type OffchainProjectImage = {
  imageUrl?: string;
  imageMimeType?: string;
  imageSizeBytes?: number;
  uploadedAt: string;
  description?: string;
  websiteUrl?: string;
  xUrl?: string;
  telegramUrl?: string;
  discordUrl?: string;
};

export type OffchainProjectImageMap = Record<string, OffchainProjectImage>;

type UploadProjectImageInput = {
  chainId: number;
  address: Address;
  file?: File | null;
  profile?: ProjectProfileInput;
};

export type ProjectProfileInput = {
  description?: string;
  websiteUrl?: string;
  xUrl?: string;
  telegramUrl?: string;
  discordUrl?: string;
};

function formatMaxImageSize() {
  return `${STAGE0_IMAGE_MAX_BYTES / (1024 * 1024)}MB`;
}

export function formatStage0ImageFileSize(size: number): string {
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function getStage0ImageValidationError(file: File, label = 'image'): string | null {
  if (!STAGE0_IMAGE_ACCEPTED_TYPES.has(file.type)) {
    return `Use a PNG, JPG, or WebP ${label}.`;
  }

  if (file.size > STAGE0_IMAGE_MAX_BYTES) {
    return `${label[0].toUpperCase()}${label.slice(1)} must be ${formatMaxImageSize()} or smaller.`;
  }

  return null;
}

function getUploadErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback;
  const detail = (payload as { detail?: unknown }).detail;
  return typeof detail === 'string' && detail.trim() ? detail : fallback;
}

async function uploadProjectImage(
  kind: 'collections' | 'tokens',
  input: UploadProjectImageInput,
): Promise<OffchainProjectImage> {
  if (!input.file) {
    const response = await fetch(`${SENNA_API_URL}/api/images/${kind}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chainId: input.chainId,
        address: input.address,
        ...input.profile,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { image?: OffchainProjectImage } | null;
    if (!response.ok || !payload?.image) {
      throw new Error(getUploadErrorMessage(payload, `Could not save ${kind === 'collections' ? 'collection' : 'token'} profile.`));
    }

    return payload.image;
  }

  const form = new FormData();
  form.set('chainId', String(input.chainId));
  form.set('address', input.address);
  form.set('description', input.profile?.description ?? '');
  form.set('websiteUrl', input.profile?.websiteUrl ?? '');
  form.set('xUrl', input.profile?.xUrl ?? '');
  form.set('telegramUrl', input.profile?.telegramUrl ?? '');
  form.set('discordUrl', input.profile?.discordUrl ?? '');
  form.set('image', input.file);

  const response = await fetch(`${SENNA_API_URL}/api/images/${kind}`, {
    method: 'POST',
    body: form,
  });

  const payload = (await response.json().catch(() => null)) as { image?: OffchainProjectImage } | null;
  if (!response.ok || !payload?.image) {
    throw new Error(getUploadErrorMessage(payload, `Could not upload ${kind === 'collections' ? 'collection' : 'token'} image.`));
  }

  return payload.image;
}

async function fetchProjectImages(
  kind: 'collections' | 'tokens',
  chainId: number,
  addresses: Address[],
): Promise<OffchainProjectImageMap> {
  const uniqueAddresses = Array.from(new Set(addresses.map((address) => address.toLowerCase())));
  if (uniqueAddresses.length === 0) return {};

  try {
    const params = new URLSearchParams({
      chainId: String(chainId),
      addresses: uniqueAddresses.join(','),
    });
    const response = await fetch(`${SENNA_API_URL}/api/images/${kind}?${params.toString()}`);
    if (!response.ok) return {};

    const payload = (await response.json()) as { images?: OffchainProjectImageMap };
    return payload.images ?? {};
  } catch {
    return {};
  }
}

export function uploadCollectionImage(input: UploadProjectImageInput) {
  return uploadProjectImage('collections', input);
}

export function uploadTokenImage(input: UploadProjectImageInput) {
  return uploadProjectImage('tokens', input);
}

export function fetchOffchainCollectionImages(chainId: number, addresses: Address[]) {
  return fetchProjectImages('collections', chainId, addresses);
}

export function fetchOffchainTokenImages(chainId: number, addresses: Address[]) {
  return fetchProjectImages('tokens', chainId, addresses);
}
