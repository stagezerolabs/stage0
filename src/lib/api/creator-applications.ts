import type { Address, Hex } from 'viem';
import { SENNA_API_URL } from './base-url';

export type CreatorApplicationType = 'nft' | 'presale';
export type CreatorApplicationStatus = 'pending' | 'approved' | 'rejected';

export type CreatorTeamMember = {
  name: string;
  role: string;
  x?: string;
  telegram?: string;
  discord?: string;
};

export type CreatorApplicationInput = {
  chainId: number;
  applicationType: CreatorApplicationType;
  applicantWallet: Address;
  founderAddressInput: string;
  founderName: string;
  founderRole: string;
  founderEmail: string;
  founderX?: string;
  founderTelegram?: string;
  founderDiscord?: string;
  projectName: string;
  projectDescription: string;
  projectStage: string;
  projectWebsiteUrl?: string;
  projectX?: string;
  projectTelegram?: string;
  projectDiscord?: string;
  projectDetails: Record<string, string>;
  teamMembers: CreatorTeamMember[];
  image: File;
};

export type CreatorApplicationSummary = {
  id: string;
  applicationType: CreatorApplicationType;
  projectName: string;
  status: CreatorApplicationStatus;
  submittedAt: string;
  reviewNotes?: string | null;
};

export type CreatorAccess = Record<CreatorApplicationType, {
  approved: boolean;
  application: CreatorApplicationSummary | null;
}>;

export type CreatorApplication = {
  id: string;
  chainId: number;
  applicationType: CreatorApplicationType;
  applicantWallet: Address;
  founderAddressInput: string;
  founderName: string;
  founderRole: string;
  founderEmail: string;
  founderX?: string;
  founderTelegram?: string;
  founderDiscord?: string;
  projectName: string;
  projectDescription: string;
  projectStage: string;
  projectWebsiteUrl?: string;
  projectX?: string;
  projectTelegram?: string;
  projectDiscord?: string;
  projectDetails: Record<string, string>;
  teamMembers: CreatorTeamMember[];
  imageUrl?: string;
  imageMimeType?: string;
  imageSizeBytes?: number;
  status: CreatorApplicationStatus;
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  notificationStatus: 'pending' | 'sent' | 'partial' | 'failed' | 'skipped';
  notificationError?: string;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
};

type SignMessage = (input: { message: string }) => Promise<Hex>;

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

function nullable(value: string | undefined) {
  return value?.trim() || null;
}

function normalizeTeamMembers(members: CreatorTeamMember[]) {
  return members.map((member) => ({
    name: member.name.trim(),
    role: member.role.trim(),
    ...(member.x?.trim() ? { x: member.x.trim() } : {}),
    ...(member.telegram?.trim() ? { telegram: member.telegram.trim() } : {}),
    ...(member.discord?.trim() ? { discord: member.discord.trim() } : {}),
  }));
}

async function sha256File(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return `0x${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function applicationPayload(input: CreatorApplicationInput, imageSha256: string) {
  return {
    applicationType: input.applicationType,
    applicantWallet: input.applicantWallet.toLowerCase(),
    founderAddressInput: input.founderAddressInput.trim(),
    founderName: input.founderName.trim(),
    founderRole: input.founderRole.trim(),
    founderEmail: input.founderEmail.trim().toLowerCase(),
    founderX: nullable(input.founderX),
    founderTelegram: nullable(input.founderTelegram),
    founderDiscord: nullable(input.founderDiscord),
    projectName: input.projectName.trim(),
    projectDescription: input.projectDescription.trim(),
    projectStage: input.projectStage.trim(),
    projectWebsiteUrl: nullable(input.projectWebsiteUrl),
    projectX: nullable(input.projectX),
    projectTelegram: nullable(input.projectTelegram),
    projectDiscord: nullable(input.projectDiscord),
    projectDetails: Object.fromEntries(
      Object.entries(input.projectDetails).map(([key, value]) => [key, value.trim()]),
    ),
    teamMembers: normalizeTeamMembers(input.teamMembers),
    imageSha256: imageSha256.toLowerCase(),
  };
}

function creatorApplicationMessage(input: { chainId: number; timestamp: number; payload: unknown }) {
  return [
    'Stage0 creator application',
    `Network: RISE Mainnet (${input.chainId})`,
    `Timestamp: ${input.timestamp}`,
    `Payload: ${stableJson(input.payload)}`,
  ].join('\n');
}

function creatorAdminMessage(input: {
  action: 'list_creator_applications' | 'set_creator_approval';
  chainId: number;
  timestamp: number;
  payload: unknown;
}) {
  return [
    'Stage0 creator access administration',
    `Network: RISE Mainnet (${input.chainId})`,
    `Action: ${input.action}`,
    `Timestamp: ${input.timestamp}`,
    `Payload: ${stableJson(input.payload)}`,
  ].join('\n');
}

function errorDetail(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback;
  const detail = (payload as { detail?: unknown }).detail;
  return typeof detail === 'string' && detail ? detail : fallback;
}

export async function fetchCreatorAccess(wallet: Address, chainId: number): Promise<CreatorAccess> {
  const params = new URLSearchParams({ wallet, chainId: String(chainId) });
  const response = await fetch(`${SENNA_API_URL}/api/creator-access?${params.toString()}`, {
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as { access?: CreatorAccess } | null;
  if (!response.ok || !payload?.access) {
    throw new Error(errorDetail(payload, 'Could not check creator access.'));
  }
  return payload.access;
}

export async function submitCreatorApplication(input: CreatorApplicationInput & {
  signMessage: SignMessage;
}): Promise<CreatorApplicationSummary> {
  const imageSha256 = await sha256File(input.image);
  const payload = applicationPayload(input, imageSha256);
  const timestamp = Date.now();
  const signature = await input.signMessage({
    message: creatorApplicationMessage({ chainId: input.chainId, timestamp, payload }),
  });

  const form = new FormData();
  form.set('chainId', String(input.chainId));
  form.set('applicationType', input.applicationType);
  form.set('applicantWallet', input.applicantWallet);
  form.set('founderAddressInput', input.founderAddressInput.trim());
  form.set('founderName', input.founderName.trim());
  form.set('founderRole', input.founderRole.trim());
  form.set('founderEmail', input.founderEmail.trim());
  form.set('founderX', input.founderX?.trim() ?? '');
  form.set('founderTelegram', input.founderTelegram?.trim() ?? '');
  form.set('founderDiscord', input.founderDiscord?.trim() ?? '');
  form.set('projectName', input.projectName.trim());
  form.set('projectDescription', input.projectDescription.trim());
  form.set('projectStage', input.projectStage.trim());
  form.set('projectWebsiteUrl', input.projectWebsiteUrl?.trim() ?? '');
  form.set('projectX', input.projectX?.trim() ?? '');
  form.set('projectTelegram', input.projectTelegram?.trim() ?? '');
  form.set('projectDiscord', input.projectDiscord?.trim() ?? '');
  form.set('projectDetails', JSON.stringify(payload.projectDetails));
  form.set('teamMembers', JSON.stringify(payload.teamMembers));
  form.set('imageSha256', imageSha256);
  form.set('authAddress', input.applicantWallet);
  form.set('authTimestamp', String(timestamp));
  form.set('authSignature', signature);
  form.set('image', input.image);

  const response = await fetch(`${SENNA_API_URL}/api/creator-applications`, {
    method: 'POST',
    body: form,
  });
  const responsePayload = await response.json().catch(() => null) as {
    application?: CreatorApplicationSummary;
  } | null;
  if (!response.ok || !responsePayload?.application) {
    throw new Error(errorDetail(responsePayload, 'Could not submit your creator application.'));
  }
  return responsePayload.application;
}

export async function fetchAdminCreatorApplications(input: {
  chainId: number;
  adminAddress: Address;
  signMessage: SignMessage;
  status?: CreatorApplicationStatus;
  limit?: number;
}): Promise<CreatorApplication[]> {
  const limit = input.limit ?? 100;
  const payload = { chainId: input.chainId, status: input.status ?? null, limit };
  const timestamp = Date.now();
  const signature = await input.signMessage({
    message: creatorAdminMessage({
      action: 'list_creator_applications',
      chainId: input.chainId,
      timestamp,
      payload,
    }),
  });
  const params = new URLSearchParams({
    chainId: String(input.chainId),
    limit: String(limit),
    address: input.adminAddress,
    timestamp: String(timestamp),
    signature,
  });
  if (input.status) params.set('status', input.status);
  const response = await fetch(`${SENNA_API_URL}/api/admin/creator-applications?${params.toString()}`, {
    cache: 'no-store',
  });
  const responsePayload = await response.json().catch(() => null) as {
    applications?: CreatorApplication[];
  } | null;
  if (!response.ok || !responsePayload?.applications) {
    throw new Error(errorDetail(responsePayload, 'Could not load creator applications.'));
  }
  return responsePayload.applications;
}

export async function setAdminCreatorApproval(input: {
  chainId: number;
  adminAddress: Address;
  applicationType: CreatorApplicationType;
  walletAddress: Address;
  approved: boolean;
  applicationId?: string | null;
  notes?: string | null;
  signMessage: SignMessage;
}) {
  const payload = {
    chainId: input.chainId,
    applicationType: input.applicationType,
    walletAddress: input.walletAddress.toLowerCase(),
    approved: input.approved,
    applicationId: input.applicationId ?? null,
    notes: input.notes?.trim() || null,
  };
  const timestamp = Date.now();
  const signature = await input.signMessage({
    message: creatorAdminMessage({
      action: 'set_creator_approval',
      chainId: input.chainId,
      timestamp,
      payload,
    }),
  });
  const response = await fetch(`${SENNA_API_URL}/api/admin/creator-approvals`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      auth: { address: input.adminAddress, timestamp, signature },
    }),
  });
  const responsePayload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(errorDetail(responsePayload, 'Could not update creator access.'));
  }
  return responsePayload;
}
