import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId, useSignMessage } from 'wagmi';
import type { Address } from 'viem';
import { toast } from 'sonner';
import RnsAddressInput from '@/components/rns/RnsAddressInput';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import {
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  RefreshCcw,
  Rocket,
  ShieldCheck,
  ShieldX,
  Unlock,
  Users,
} from '@/components/ui/icons';
import { InlineLoading } from '@/components/ui/spinner';
import {
  createCreatorAdminSession,
  CreatorAdminSessionRequiredError,
  fetchAdminCreatorApplications,
  fetchCreatorAccess,
  restoreCreatorAdminSession,
  setAdminCreatorApproval,
  type CreatorAccess,
  type CreatorApplication,
  type CreatorApplicationType,
} from '@/lib/api/creator-applications';

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function safeLink(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function detailLabel(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (character) => character.toUpperCase());
}

function TypeBadge({ type }: { type: CreatorApplicationType }) {
  const Icon = type === 'nft' ? ImageIcon : Rocket;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-canvas px-2.5 py-1 text-xs font-semibold text-ink">
      <Icon className="h-3.5 w-3.5" />
      {type === 'nft' ? 'NFT' : 'Presale'}
    </span>
  );
}

function StatusBadge({ status }: { status: CreatorApplication['status'] }) {
  const className = status === 'approved'
    ? 'bg-status-live/10 text-status-live'
    : status === 'rejected'
      ? 'bg-status-error/10 text-status-error'
      : 'bg-status-upcoming/10 text-status-upcoming';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${className}`}>{status}</span>;
}

export default function CreatorApprovalsPanel() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const [manualInput, setManualInput] = useState('');
  const [manualAddress, setManualAddress] = useState<Address | null>(null);
  const [manualAccess, setManualAccess] = useState<CreatorAccess | null>(null);
  const [applications, setApplications] = useState<CreatorApplication[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [sessionRequired, setSessionRequired] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const selectedApplication = useMemo(
    () => applications.find((application) => application.id === selectedApplicationId) ?? null,
    [applications, selectedApplicationId],
  );

  useEffect(() => {
    let cancelled = false;
    if (!manualAddress) {
      setManualAccess(null);
      return undefined;
    }
    void fetchCreatorAccess(manualAddress, chainId)
      .then((access) => { if (!cancelled) setManualAccess(access); })
      .catch(() => { if (!cancelled) setManualAccess(null); });
    return () => { cancelled = true; };
  }, [chainId, manualAddress]);

  const loadApplications = useCallback(async (authenticate = false, quiet = false) => {
    if (!address) return;
    setIsLoading(true);
    try {
      if (authenticate) {
        await createCreatorAdminSession({ chainId, adminAddress: address, signMessage: signMessageAsync });
      } else {
        await restoreCreatorAdminSession();
      }
      const next = await fetchAdminCreatorApplications({ chainId });
      setApplications(next);
      setHasLoaded(true);
      setSessionRequired(false);
    } catch (error) {
      if (error instanceof CreatorAdminSessionRequiredError) {
        setSessionRequired(true);
        setApplications([]);
        setHasLoaded(false);
        setSelectedApplicationId(null);
        if (!quiet && authenticate) toast.error(error.message);
      } else if (!quiet) {
        toast.error(error instanceof Error ? error.message : 'Could not load applications.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [address, chainId, signMessageAsync]);

  useEffect(() => {
    setApplications([]);
    setHasLoaded(false);
    setSessionRequired(false);
    setSelectedApplicationId(null);
    if (address) void loadApplications(false, true);
  }, [address, chainId, loadApplications]);

  const updateApproval = async (input: {
    walletAddress: Address;
    type: CreatorApplicationType;
    approved: boolean;
    applicationId?: string;
    notes?: string;
  }) => {
    const key = `${input.applicationId ?? input.walletAddress}:${input.type}`;
    setBusyKey(key);
    try {
      await setAdminCreatorApproval({
        chainId,
        applicationType: input.type,
        walletAddress: input.walletAddress,
        approved: input.approved,
        applicationId: input.applicationId,
        notes: input.notes,
      });
      if (input.applicationId) {
        setApplications((current) => current.map((application) => application.id === input.applicationId
          ? {
              ...application,
              status: input.approved ? 'approved' : 'rejected',
              reviewNotes: input.notes || undefined,
              reviewedAt: new Date().toISOString(),
            }
          : application));
      }
      if (manualAddress?.toLowerCase() === input.walletAddress.toLowerCase()) {
        setManualAccess((current) => current ? {
          ...current,
          [input.type]: { ...current[input.type], approved: input.approved },
        } : current);
      }
      toast.success(`${input.type === 'nft' ? 'NFT' : 'Presale'} creator access ${input.approved ? 'granted' : 'removed'}.`);
    } catch (error) {
      if (error instanceof CreatorAdminSessionRequiredError) {
        setSessionRequired(true);
        setApplications([]);
        setHasLoaded(false);
        setSelectedApplicationId(null);
      }
      toast.error(error instanceof Error ? error.message : 'Could not update creator access.');
    } finally {
      setBusyKey(null);
    }
  };

  const manualAction = (type: CreatorApplicationType, approved: boolean) => {
    if (!manualAddress) {
      toast.error('Enter a valid wallet address or active .rise name.');
      return;
    }
    void updateApproval({ walletAddress: manualAddress, type, approved });
  };

  const pendingCount = applications.filter((application) => application.status === 'pending').length;
  const selectedActionKey = selectedApplication
    ? `${selectedApplication.id}:${selectedApplication.applicationType}`
    : null;
  const selectedWebsite = safeLink(selectedApplication?.projectWebsiteUrl);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-label uppercase tracking-wider text-ink-faint">Creator access</p>
          <h2 className="font-display text-display-md text-ink">Project applications</h2>
          <p className="mt-1 max-w-2xl text-body text-ink-muted">Review incoming teams and control NFT and token launch permissions independently.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadApplications(sessionRequired)}
          disabled={isLoading || !address}
          className="btn-secondary inline-flex items-center gap-2 self-start md:self-auto"
        >
          {isLoading
            ? <InlineLoading label={sessionRequired ? 'Verifying' : 'Loading'} />
            : sessionRequired
              ? <><Unlock className="h-4 w-4" /> Verify admin</>
              : <><RefreshCcw className="h-4 w-4" /> {hasLoaded ? 'Refresh applications' : 'Load applications'}</>}
        </button>
      </div>

      <div className="glass-card rounded-3xl p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)] lg:items-end">
          <RnsAddressInput
            label="Whitelist a founder wallet or .rise name"
            value={manualInput}
            onChange={setManualInput}
            onResolvedAddressChange={setManualAddress}
            hint="Access is stored for the resolved RISE Mainnet wallet."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {(['nft', 'presale'] as const).map((type) => {
              const approved = manualAccess?.[type].approved ?? false;
              const key = `${manualAddress ?? ''}:${type}`;
              return (
                <div key={type} className="rounded-2xl border border-border bg-canvas/45 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <TypeBadge type={type} />
                    <span className={approved ? 'text-xs font-semibold text-status-live' : 'text-xs text-ink-faint'}>{approved ? 'Approved' : 'Not approved'}</span>
                  </div>
                  <button
                    type="button"
                    disabled={!manualAddress || busyKey === key || !hasLoaded || sessionRequired}
                    onClick={() => manualAction(type, !approved)}
                    className={approved ? 'btn-secondary w-full' : 'btn-primary w-full'}
                  >
                    {busyKey === key ? <InlineLoading label="Updating access" /> : approved ? 'Revoke access' : 'Grant access'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {hasLoaded ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">{applications.length} application{applications.length === 1 ? '' : 's'}</p>
            <span className="rounded-full bg-status-upcoming/10 px-3 py-1 text-xs font-semibold text-status-upcoming">{pendingCount} pending</span>
          </div>
          {applications.length === 0 ? (
            <div className="glass-card rounded-3xl p-10 text-center text-ink-muted">No creator applications yet.</div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-border bg-canvas-alt/70 shadow-card">
              {applications.map((application, index) => (
                <button
                  key={application.id}
                  type="button"
                  onClick={() => setSelectedApplicationId(application.id)}
                  className={`group grid w-full grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-canvas/70 sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:px-5 ${index > 0 ? 'border-t border-border' : ''}`}
                >
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-border bg-canvas p-1.5 sm:h-16 sm:w-16">
                    {application.imageUrl
                      ? <img src={application.imageUrl} alt="" className="h-full w-full rounded-xl object-contain" />
                      : <ImageIcon className="h-6 w-6 text-ink-faint" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-display text-lg text-ink sm:text-xl">{application.projectName}</h3>
                      <TypeBadge type={application.applicationType} />
                      <StatusBadge status={application.status} />
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-ink-muted">{application.projectDescription}</p>
                    <p className="mt-1 text-xs text-ink-faint">{application.founderName} · {application.projectStage} · {new Date(application.submittedAt).toLocaleDateString()}</p>
                  </div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink-muted transition group-hover:border-border-strong group-hover:text-ink">
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
          {sessionRequired
            ? 'Admin verification is required to protect applicant details and approval controls.'
            : 'Loading applications from the Stage0 database…'}
        </div>
      )}

      <ResponsiveDialog
        open={Boolean(selectedApplication)}
        onOpenChange={(open) => { if (!open) setSelectedApplicationId(null); }}
        title={selectedApplication?.projectName ?? 'Project application'}
        description={selectedApplication
          ? `${selectedApplication.applicationType === 'nft' ? 'NFT collection' : 'Token launch'} · Submitted ${new Date(selectedApplication.submittedAt).toLocaleString()}`
          : undefined}
        className="max-w-[920px]"
      >
        {selectedApplication ? (
          <div className="space-y-6">
            <div className="grid gap-5 md:grid-cols-[15rem_minmax(0,1fr)]">
              <div className="flex min-h-52 items-center justify-center overflow-hidden rounded-3xl border border-border bg-canvas p-4">
                {selectedApplication.imageUrl
                  ? <img src={selectedApplication.imageUrl} alt={selectedApplication.projectName} className="max-h-64 w-full object-contain" />
                  : <ImageIcon className="h-10 w-10 text-ink-faint" />}
              </div>
              <div className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-center gap-2"><TypeBadge type={selectedApplication.applicationType} /><StatusBadge status={selectedApplication.status} /></div>
                <p className="text-sm leading-6 text-ink-muted">{selectedApplication.projectDescription}</p>
                <div className="flex flex-wrap gap-3">
                  {selectedWebsite ? <a href={selectedWebsite} target="_blank" rel="noreferrer" className="btn-secondary inline-flex items-center gap-2">Website <ExternalLink className="h-4 w-4" /></a> : null}
                  {selectedApplication.imageUrl ? <a href={selectedApplication.imageUrl} target="_blank" rel="noreferrer" className="btn-ghost inline-flex items-center gap-2">Open image <ExternalLink className="h-4 w-4" /></a> : null}
                </div>
              </div>
            </div>

            <section>
              <h4 className="mb-3 text-sm font-semibold text-ink">Founder & project</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="creator-review-item"><span>Founder</span><strong>{selectedApplication.founderName} · {selectedApplication.founderRole}</strong></div>
                <div className="creator-review-item"><span>Wallet / name supplied</span><strong className="break-all">{selectedApplication.founderAddressInput}<br /><small className="font-mono text-ink-muted">{shortAddress(selectedApplication.applicantWallet)}</small></strong></div>
                <div className="creator-review-item"><span>Contact</span><strong className="break-all">{selectedApplication.founderEmail}</strong></div>
                <div className="creator-review-item"><span>Stage</span><strong>{selectedApplication.projectStage}</strong></div>
                {Object.entries(selectedApplication.projectDetails).filter(([, value]) => value).map(([key, value]) => (
                  <div key={key} className="creator-review-item"><span>{detailLabel(key)}</span><strong>{value}</strong></div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-canvas/40 p-4">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-ink"><Users className="h-4 w-4" /> Team & socials</h4>
              <p className="mt-3 text-xs leading-5 text-ink-muted">
                Project: {[selectedApplication.projectX, selectedApplication.projectTelegram, selectedApplication.projectDiscord].filter(Boolean).join(' · ') || 'No project handles supplied'}<br />
                Founder: {[selectedApplication.founderX, selectedApplication.founderTelegram, selectedApplication.founderDiscord].filter(Boolean).join(' · ') || 'No founder handles supplied'}
              </p>
              {selectedApplication.teamMembers.length ? (
                <ul className="mt-3 space-y-2 border-t border-border pt-3 text-xs text-ink-muted">
                  {selectedApplication.teamMembers.map((member, index) => (
                    <li key={`${member.name}-${index}`}><strong className="text-ink">{member.name}</strong> — {member.role}{[member.x, member.telegram, member.discord].filter(Boolean).length ? ` · ${[member.x, member.telegram, member.discord].filter(Boolean).join(' · ')}` : ''}</li>
                  ))}
                </ul>
              ) : null}
            </section>

            <div className="rounded-2xl border border-border bg-canvas/40 px-4 py-3 text-xs text-ink-muted">
              Notification delivery: <strong className="capitalize text-ink">{selectedApplication.notificationStatus}</strong>
              {selectedApplication.notificationError ? <p className="mt-1 break-words text-status-error">{selectedApplication.notificationError}</p> : null}
            </div>

            {selectedApplication.status === 'pending' ? (
              <div className="space-y-3 border-t border-border pt-5">
                <textarea
                  value={reviewNotes[selectedApplication.id] ?? ''}
                  onChange={(event) => setReviewNotes((current) => ({ ...current, [selectedApplication.id]: event.target.value }))}
                  className="input-field min-h-20 resize-y"
                  placeholder="Optional review note (included if rejected)"
                  maxLength={1000}
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={busyKey === selectedActionKey}
                    onClick={() => void updateApproval({ walletAddress: selectedApplication.applicantWallet, type: selectedApplication.applicationType, approved: true, applicationId: selectedApplication.id, notes: reviewNotes[selectedApplication.id] })}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    {busyKey === selectedActionKey ? <InlineLoading label="Approving" /> : <><ShieldCheck className="h-4 w-4" /> Approve {selectedApplication.applicationType === 'nft' ? 'NFT creator' : 'presale creator'}</>}
                  </button>
                  <button
                    type="button"
                    disabled={busyKey === selectedActionKey}
                    onClick={() => void updateApproval({ walletAddress: selectedApplication.applicantWallet, type: selectedApplication.applicationType, approved: false, applicationId: selectedApplication.id, notes: reviewNotes[selectedApplication.id] })}
                    className="btn-secondary inline-flex items-center gap-2 text-status-error"
                  >
                    <ShieldX className="h-4 w-4" /> Request changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 border-t border-border pt-5 text-sm text-ink-muted">
                {selectedApplication.status === 'approved' ? <CheckCircle2 className="h-4 w-4 text-status-live" /> : <ShieldX className="h-4 w-4 text-status-error" />}
                Reviewed {selectedApplication.reviewedAt ? new Date(selectedApplication.reviewedAt).toLocaleString() : ''}
              </div>
            )}
          </div>
        ) : null}
      </ResponsiveDialog>
    </section>
  );
}
