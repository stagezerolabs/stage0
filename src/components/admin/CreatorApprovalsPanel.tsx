import { useEffect, useState } from 'react';
import { useAccount, useChainId, useSignMessage } from 'wagmi';
import type { Address } from 'viem';
import { toast } from 'sonner';
import RnsAddressInput from '@/components/rns/RnsAddressInput';
import {
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  RefreshCcw,
  Rocket,
  ShieldCheck,
  ShieldX,
  Users,
} from '@/components/ui/icons';
import { InlineLoading } from '@/components/ui/spinner';
import {
  fetchAdminCreatorApplications,
  fetchCreatorAccess,
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

function TypeBadge({ type }: { type: CreatorApplicationType }) {
  const Icon = type === 'nft' ? ImageIcon : Rocket;
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-canvas px-2.5 py-1 text-xs font-semibold text-ink"><Icon className="h-3.5 w-3.5" />{type === 'nft' ? 'NFT' : 'Presale'}</span>;
}

export default function CreatorApprovalsPanel() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const [manualInput, setManualInput] = useState('');
  const [manualAddress, setManualAddress] = useState<Address | null>(null);
  const [manualAccess, setManualAccess] = useState<CreatorAccess | null>(null);
  const [applications, setApplications] = useState<CreatorApplication[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

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

  const loadApplications = async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const next = await fetchAdminCreatorApplications({
        chainId,
        adminAddress: address,
        signMessage: signMessageAsync,
      });
      setApplications(next);
      setHasLoaded(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load applications.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateApproval = async (input: {
    walletAddress: Address;
    type: CreatorApplicationType;
    approved: boolean;
    applicationId?: string;
    notes?: string;
  }) => {
    if (!address) return;
    const key = `${input.applicationId ?? input.walletAddress}:${input.type}`;
    setBusyKey(key);
    try {
      await setAdminCreatorApproval({
        chainId,
        adminAddress: address,
        applicationType: input.type,
        walletAddress: input.walletAddress,
        approved: input.approved,
        applicationId: input.applicationId,
        notes: input.notes,
        signMessage: signMessageAsync,
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

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-label uppercase tracking-wider text-ink-faint">Creator access</p>
          <h2 className="font-display text-display-md text-ink">Project applications</h2>
          <p className="mt-1 max-w-2xl text-body text-ink-muted">Review incoming teams and control NFT and token launch permissions independently.</p>
        </div>
        <button type="button" onClick={loadApplications} disabled={isLoading} className="btn-secondary inline-flex items-center gap-2 self-start md:self-auto">
          {isLoading ? <InlineLoading label="Sign to load" /> : <><RefreshCcw className="h-4 w-4" /> {hasLoaded ? 'Refresh applications' : 'Load applications'}</>}
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
                  <div className="mb-3 flex items-center justify-between gap-2"><TypeBadge type={type} /><span className={approved ? 'text-xs font-semibold text-status-live' : 'text-xs text-ink-faint'}>{approved ? 'Approved' : 'Not approved'}</span></div>
                  <button type="button" disabled={!manualAddress || busyKey === key} onClick={() => manualAction(type, !approved)} className={approved ? 'btn-secondary w-full' : 'btn-primary w-full'}>
                    {busyKey === key ? <InlineLoading label="Sign update" /> : approved ? 'Revoke access' : 'Grant access'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {hasLoaded ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between"><p className="text-sm font-semibold text-ink">{applications.length} application{applications.length === 1 ? '' : 's'}</p><span className="rounded-full bg-status-upcoming/10 px-3 py-1 text-xs font-semibold text-status-upcoming">{pendingCount} pending</span></div>
          {applications.length === 0 ? <div className="glass-card rounded-3xl p-10 text-center text-ink-muted">No creator applications yet.</div> : applications.map((application) => {
            const actionKey = `${application.id}:${application.applicationType}`;
            const website = safeLink(application.projectWebsiteUrl);
            return (
              <article key={application.id} className="glass-card overflow-hidden rounded-3xl">
                <div className="grid lg:grid-cols-[15rem_minmax(0,1fr)]">
                  <div className="min-h-56 bg-canvas">
                    {application.imageUrl ? <img src={application.imageUrl} alt={application.projectName} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImageIcon className="h-10 w-10 text-ink-faint" /></div>}
                  </div>
                  <div className="space-y-5 p-5 sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div><div className="mb-2 flex flex-wrap items-center gap-2"><TypeBadge type={application.applicationType} /><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${application.status === 'approved' ? 'bg-status-live/10 text-status-live' : application.status === 'rejected' ? 'bg-status-error/10 text-status-error' : 'bg-status-upcoming/10 text-status-upcoming'}`}>{application.status}</span></div><h3 className="font-display text-2xl text-ink">{application.projectName}</h3><p className="mt-1 text-xs text-ink-faint">Submitted {new Date(application.submittedAt).toLocaleString()}</p></div>
                      {website ? <a href={website} target="_blank" rel="noreferrer" className="btn-ghost inline-flex items-center gap-2 self-start">Website <ExternalLink className="h-4 w-4" /></a> : null}
                    </div>
                    <p className="text-sm leading-6 text-ink-muted">{application.projectDescription}</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="creator-review-item"><span>Founder</span><strong>{application.founderName} · {application.founderRole}</strong></div>
                      <div className="creator-review-item"><span>Wallet / name supplied</span><strong className="break-all">{application.founderAddressInput}<br /><small className="font-mono text-ink-muted">{shortAddress(application.applicantWallet)}</small></strong></div>
                      <div className="creator-review-item"><span>Contact</span><strong className="break-all">{application.founderEmail}</strong></div>
                      <div className="creator-review-item"><span>Stage</span><strong>{application.projectStage}</strong></div>
                      {Object.entries(application.projectDetails).filter(([, value]) => value).map(([key, value]) => <div key={key} className="creator-review-item"><span>{key.replace(/([a-z])([A-Z])/g, '$1 $2')}</span><strong>{value}</strong></div>)}
                    </div>
                    <div className="rounded-2xl border border-border bg-canvas/40 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-ink"><Users className="h-4 w-4" /> Team & socials</p><p className="mt-2 text-xs leading-5 text-ink-muted">Project: {[application.projectX, application.projectTelegram, application.projectDiscord].filter(Boolean).join(' · ') || 'No project handles supplied'}<br />Founder: {[application.founderX, application.founderTelegram, application.founderDiscord].filter(Boolean).join(' · ') || 'No founder handles supplied'}</p>{application.teamMembers.length ? <ul className="mt-2 space-y-1 text-xs text-ink-muted">{application.teamMembers.map((member, index) => <li key={`${member.name}-${index}`}>{member.name} — {member.role}{[member.x, member.telegram, member.discord].filter(Boolean).length ? ` · ${[member.x, member.telegram, member.discord].filter(Boolean).join(' · ')}` : ''}</li>)}</ul> : null}</div>
                    <div className="text-xs text-ink-faint">Delivery: {application.notificationStatus}{application.notificationError ? ' · notification needs attention' : ''}</div>
                    {application.status === 'pending' ? <div className="space-y-3 border-t border-border pt-4"><textarea value={reviewNotes[application.id] ?? ''} onChange={(event) => setReviewNotes((current) => ({ ...current, [application.id]: event.target.value }))} className="input-field min-h-20 resize-y" placeholder="Optional review note (included if rejected)" maxLength={1000} /><div className="flex flex-wrap gap-3"><button type="button" disabled={busyKey === actionKey} onClick={() => updateApproval({ walletAddress: application.applicantWallet, type: application.applicationType, approved: true, applicationId: application.id, notes: reviewNotes[application.id] })} className="btn-primary inline-flex items-center gap-2">{busyKey === actionKey ? <InlineLoading label="Sign approval" /> : <><ShieldCheck className="h-4 w-4" /> Approve {application.applicationType === 'nft' ? 'NFT creator' : 'presale creator'}</>}</button><button type="button" disabled={busyKey === actionKey} onClick={() => updateApproval({ walletAddress: application.applicantWallet, type: application.applicationType, approved: false, applicationId: application.id, notes: reviewNotes[application.id] })} className="btn-secondary inline-flex items-center gap-2 text-status-error"><ShieldX className="h-4 w-4" /> Request changes</button></div></div> : <div className="flex items-center gap-2 text-sm text-ink-muted">{application.status === 'approved' ? <CheckCircle2 className="h-4 w-4 text-status-live" /> : <ShieldX className="h-4 w-4 text-status-error" />} Reviewed {application.reviewedAt ? new Date(application.reviewedAt).toLocaleString() : ''}</div>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">Sign a read-only admin message to load full application details.</div>
      )}
    </section>
  );
}
