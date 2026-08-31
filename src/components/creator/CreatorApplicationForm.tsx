import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAccount, useChainId, useSignMessage } from 'wagmi';
import type { Address } from 'viem';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Coins,
  Image as ImageIcon,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
} from '@/components/ui/icons';
import { InlineLoading } from '@/components/ui/spinner';
import RnsAddressInput from '@/components/rns/RnsAddressInput';
import {
  formatStage0ImageFileSize,
  getStage0ImageValidationError,
} from '@/lib/api/media';
import {
  submitCreatorApplication,
  type CreatorApplicationSummary,
  type CreatorApplicationType,
  type CreatorTeamMember,
} from '@/lib/api/creator-applications';

type CreatorApplicationFormProps = {
  type: CreatorApplicationType;
  existingApplication?: CreatorApplicationSummary | null;
  onSubmitted: () => void;
};

type TeamDraft = CreatorTeamMember & { id: string };

const PROJECT_STAGES = ['Idea / concept', 'Building', 'Testnet ready', 'Launch ready', 'Already live'];
const NFT_CATEGORIES = ['Art', 'PFP', 'Gaming', 'Membership', 'Collectibles', 'Music', 'Other'];

function FieldLabel({ children, optional }: { children: ReactNode; optional?: boolean }) {
  return (
    <label className="text-sm font-semibold text-ink">
      {children}
      {optional ? <span className="ml-1 font-normal text-ink-faint">Optional</span> : <span className="ml-1 text-accent">*</span>}
    </label>
  );
}

function SocialFields(props: {
  prefix: string;
  x: string;
  telegram: string;
  discord: string;
  onX: (value: string) => void;
  onTelegram: (value: string) => void;
  onDiscord: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <FieldLabel optional>{props.prefix} X</FieldLabel>
        <input value={props.x} onChange={(event) => props.onX(event.target.value)} className="input-field" placeholder="@handle or x.com/..." maxLength={240} />
      </div>
      <div className="space-y-1.5">
        <FieldLabel optional>{props.prefix} Telegram</FieldLabel>
        <input value={props.telegram} onChange={(event) => props.onTelegram(event.target.value)} className="input-field" placeholder="@handle or t.me/..." maxLength={240} />
      </div>
      <div className="space-y-1.5">
        <FieldLabel optional>{props.prefix} Discord</FieldLabel>
        <input value={props.discord} onChange={(event) => props.onDiscord(event.target.value)} className="input-field" placeholder="handle or invite link" maxLength={240} />
      </div>
    </div>
  );
}

export default function CreatorApplicationForm({
  type,
  existingApplication,
  onSubmitted,
}: CreatorApplicationFormProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [editingPending, setEditingPending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectStage, setProjectStage] = useState('Building');
  const [projectWebsiteUrl, setProjectWebsiteUrl] = useState('');
  const [projectX, setProjectX] = useState('');
  const [projectTelegram, setProjectTelegram] = useState('');
  const [projectDiscord, setProjectDiscord] = useState('');
  const [founderAddressInput, setFounderAddressInput] = useState(address ?? '');
  const [founderResolvedAddress, setFounderResolvedAddress] = useState<Address | null>(address ?? null);
  const [founderName, setFounderName] = useState('');
  const [founderRole, setFounderRole] = useState('Founder');
  const [founderEmail, setFounderEmail] = useState('');
  const [founderX, setFounderX] = useState('');
  const [founderTelegram, setFounderTelegram] = useState('');
  const [founderDiscord, setFounderDiscord] = useState('');
  const [team, setTeam] = useState<TeamDraft[]>([]);
  const [nftCategory, setNftCategory] = useState('Art');
  const [collectionSize, setCollectionSize] = useState('');
  const [artReadiness, setArtReadiness] = useState('In progress');
  const [mintTimeline, setMintTimeline] = useState('');
  const [nftUtility, setNftUtility] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [raiseTarget, setRaiseTarget] = useState('');
  const [launchTimeline, setLaunchTimeline] = useState('');
  const [useOfFunds, setUseOfFunds] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const isPending = existingApplication?.status === 'pending';
  const isRejected = existingApplication?.status === 'rejected';
  const showReceipt = isPending && !editingPending;
  const title = type === 'nft' ? 'NFT creator application' : 'Token launch application';
  const eyebrow = type === 'nft' ? 'Create an NFT · Creator access' : null;
  const Icon = type === 'nft' ? ImageIcon : Coins;

  useEffect(() => {
    if (address && !founderAddressInput) {
      setFounderAddressInput(address);
      setFounderResolvedAddress(address);
    }
  }, [address, founderAddressInput]);

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const projectDetails = useMemo<Record<string, string>>(() => {
    if (type === 'nft') {
      return {
        category: nftCategory,
        expectedCollectionSize: collectionSize,
        artReadiness,
        targetMintTimeline: mintTimeline,
        utility: nftUtility,
      } as Record<string, string>;
    }
    return {
      tokenName,
      tokenSymbol,
      tokenAddress,
      targetRaise: raiseTarget,
      targetLaunchTimeline: launchTimeline,
      useOfFunds,
    } as Record<string, string>;
  }, [
        artReadiness,
        collectionSize,
        launchTimeline,
        mintTimeline,
        nftCategory,
        nftUtility,
        raiseTarget,
        tokenAddress,
        tokenName,
        tokenSymbol,
        type,
        useOfFunds,
      ]);

  const setProjectImage = (file: File | undefined) => {
    if (!file) return;
    const error = getStage0ImageValidationError(file, 'project image');
    if (error) {
      toast.error(error);
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const validateStep = (nextStep: number) => {
    if (step === 0) {
      if (!projectName.trim() || projectDescription.trim().length < 40 || !projectStage || !image) {
        toast.error('Add the project name, a description of at least 40 characters, its stage, and an image.');
        return false;
      }
      if (type === 'nft' && (!collectionSize.trim() || !mintTimeline.trim())) {
        toast.error('Add the expected collection size and mint timeline.');
        return false;
      }
      if (type === 'presale' && (!tokenName.trim() || !tokenSymbol.trim() || !raiseTarget.trim() || !launchTimeline.trim())) {
        toast.error('Add the token name, ticker, target raise, and launch timeline.');
        return false;
      }
    }
    if (step === 1) {
      if (!founderName.trim() || !founderRole.trim() || !founderEmail.trim() || !founderResolvedAddress) {
        toast.error('Complete the founder name, role, email, and wallet or .rise name.');
        return false;
      }
      if (!address || founderResolvedAddress.toLowerCase() !== address.toLowerCase()) {
        toast.error('The founder address must resolve to the connected wallet so you can sign the application.');
        return false;
      }
      if (team.some((member) => !member.name.trim() || !member.role.trim())) {
        toast.error('Every team member needs a name and role, or remove the incomplete entry.');
        return false;
      }
    }
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  };

  const addTeamMember = () => {
    if (team.length >= 10) return;
    setTeam((current) => [
      ...current,
      { id: crypto.randomUUID(), name: '', role: '', x: '', telegram: '', discord: '' },
    ]);
  };

  const updateTeamMember = (id: string, field: keyof CreatorTeamMember, value: string) => {
    setTeam((current) => current.map((member) => member.id === id ? { ...member, [field]: value } : member));
  };

  const handleSubmit = async () => {
    if (!address || !founderResolvedAddress || !image || !confirmed) {
      toast.error('Confirm the application details before submitting.');
      return;
    }
    if (founderResolvedAddress.toLowerCase() !== address.toLowerCase()) {
      toast.error('Connect the founder wallet supplied in this application.');
      return;
    }
    setIsSubmitting(true);
    try {
      await submitCreatorApplication({
        chainId,
        applicationType: type,
        applicantWallet: founderResolvedAddress,
        founderAddressInput,
        founderName,
        founderRole,
        founderEmail,
        founderX,
        founderTelegram,
        founderDiscord,
        projectName,
        projectDescription,
        projectStage,
        projectWebsiteUrl,
        projectX,
        projectTelegram,
        projectDiscord,
        projectDetails,
        teamMembers: team.map((member) => ({
          name: member.name,
          role: member.role,
          x: member.x,
          telegram: member.telegram,
          discord: member.discord,
        })),
        image,
        signMessage: signMessageAsync,
      });
      toast.success('Application received. Stage0 will review it shortly.');
      setEditingPending(false);
      onSubmitted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit the application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showReceipt) {
    return (
      <div className="creator-application-shell">
        <section className="creator-application-receipt">
          <div className="creator-application-success-icon"><CheckCircle2 className="h-8 w-8" /></div>
          <p className="eyebrow">Application received</p>
          <h1 className="ds-h1">Thanks — we’ve got {existingApplication.projectName}.</h1>
          <p className="max-w-xl text-center text-ink-muted">
            The Stage0 team has been notified by Slack and email. Once approved, this page automatically becomes your {type === 'nft' ? 'NFT collection' : 'token launch'} builder.
          </p>
          <div className="rounded-2xl border border-border bg-canvas/50 px-5 py-4 text-sm text-ink-muted">
            Submitted {new Date(existingApplication.submittedAt).toLocaleString()} · Status: <strong className="text-status-upcoming">Pending review</strong>
          </div>
          <button type="button" className="btn-secondary" onClick={() => setEditingPending(true)}>
            Update application
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="creator-application-shell">
      <header className="creator-application-header">
        <div className="creator-application-mark"><Icon className="h-6 w-6" /></div>
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="ds-h1 mt-2">{title}</h1>
          <p className="mt-3 max-w-2xl text-ink-muted">
            Tell us what you’re building to get approved to launch on RISE Mainnet.
          </p>
        </div>
      </header>

      {isRejected ? (
        <div className="rounded-2xl border border-status-error/30 bg-status-error/5 p-4 text-sm text-ink-muted">
          <strong className="text-status-error">Previous application needs changes.</strong>{' '}
          {existingApplication?.reviewNotes || 'Update the details below and submit again.'}
        </div>
      ) : null}

      <div className="creator-application-progress" aria-label={`Step ${step + 1} of 3`}>
        {['Project', 'Founder & team', 'Review'].map((label, index) => (
          <div key={label} className={index <= step ? 'is-active' : ''}>
            <span>{index + 1}</span><small>{label}</small>
          </div>
        ))}
      </div>

      {step === 0 ? (
        <section className="creator-question-card">
          <div className="creator-question-number">01</div>
          <div className="space-y-2">
            <h2 className="font-display text-2xl text-ink">Start with the project</h2>
            <p className="text-sm text-ink-muted">A clear overview helps us understand the product, readiness, and audience.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel>Project or collection name</FieldLabel>
              <input value={projectName} onChange={(event) => setProjectName(event.target.value)} className="input-field" placeholder={type === 'nft' ? 'e.g. Rise Pioneers' : 'e.g. Pioneer Protocol'} maxLength={160} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel>What are you building?</FieldLabel>
              <textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} className="input-field min-h-36 resize-y" placeholder="Share the idea, what makes it useful or distinct, and who it is for." maxLength={3000} />
              <p className="text-right text-xs text-ink-faint">{projectDescription.length}/3000</p>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Current stage</FieldLabel>
              <select value={projectStage} onChange={(event) => setProjectStage(event.target.value)} className="input-field">
                {PROJECT_STAGES.map((stage) => <option key={stage}>{stage}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel optional>Website</FieldLabel>
              <input type="url" value={projectWebsiteUrl} onChange={(event) => setProjectWebsiteUrl(event.target.value)} className="input-field" placeholder="https://project.xyz" maxLength={2048} />
            </div>
          </div>

          <SocialFields prefix="Project" x={projectX} telegram={projectTelegram} discord={projectDiscord} onX={setProjectX} onTelegram={setProjectTelegram} onDiscord={setProjectDiscord} />

          {type === 'nft' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><FieldLabel>Category</FieldLabel><select value={nftCategory} onChange={(event) => setNftCategory(event.target.value)} className="input-field">{NFT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></div>
              <div className="space-y-1.5"><FieldLabel>Expected collection size</FieldLabel><input value={collectionSize} onChange={(event) => setCollectionSize(event.target.value)} className="input-field" placeholder="e.g. 2,500" maxLength={80} /></div>
              <div className="space-y-1.5"><FieldLabel>Art readiness</FieldLabel><select value={artReadiness} onChange={(event) => setArtReadiness(event.target.value)} className="input-field"><option>Concept only</option><option>In progress</option><option>Complete</option><option>Metadata ready</option></select></div>
              <div className="space-y-1.5"><FieldLabel>Target mint timeline</FieldLabel><input value={mintTimeline} onChange={(event) => setMintTimeline(event.target.value)} className="input-field" placeholder="e.g. October 2026" maxLength={120} /></div>
              <div className="space-y-1.5 sm:col-span-2"><FieldLabel optional>Utility or holder benefits</FieldLabel><textarea value={nftUtility} onChange={(event) => setNftUtility(event.target.value)} className="input-field min-h-24 resize-y" placeholder="Membership, game access, rewards, IP rights, or other utility." maxLength={500} /></div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><FieldLabel>Token name</FieldLabel><input value={tokenName} onChange={(event) => setTokenName(event.target.value)} className="input-field" placeholder="Pioneer Token" maxLength={120} /></div>
              <div className="space-y-1.5"><FieldLabel>Token ticker</FieldLabel><input value={tokenSymbol} onChange={(event) => setTokenSymbol(event.target.value.toUpperCase())} className="input-field" placeholder="PNR" maxLength={20} /></div>
              <div className="space-y-1.5"><FieldLabel optional>Token contract</FieldLabel><input value={tokenAddress} onChange={(event) => setTokenAddress(event.target.value)} className="input-field font-mono" placeholder="0x... if already deployed" maxLength={120} /></div>
              <div className="space-y-1.5"><FieldLabel>Target raise</FieldLabel><input value={raiseTarget} onChange={(event) => setRaiseTarget(event.target.value)} className="input-field" placeholder="e.g. 50 ETH" maxLength={120} /></div>
              <div className="space-y-1.5"><FieldLabel>Target launch timeline</FieldLabel><input value={launchTimeline} onChange={(event) => setLaunchTimeline(event.target.value)} className="input-field" placeholder="e.g. Q4 2026" maxLength={120} /></div>
              <div className="space-y-1.5"><FieldLabel optional>Use of funds</FieldLabel><input value={useOfFunds} onChange={(event) => setUseOfFunds(event.target.value)} className="input-field" placeholder="Product, liquidity, growth..." maxLength={500} /></div>
            </div>
          )}

          <div className="space-y-2">
            <FieldLabel>Project image</FieldLabel>
            <div
              className={`creator-application-dropzone ${dragActive ? 'is-dragging' : ''}`}
              onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => { event.preventDefault(); setDragActive(false); setProjectImage(event.dataTransfer.files[0]); }}
            >
              <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => setProjectImage(event.target.files?.[0])} />
              {imagePreview ? <img src={imagePreview} alt="Project preview" /> : <div className="creator-application-upload-icon"><Upload className="h-6 w-6" /></div>}
              <div><p className="font-semibold text-ink">{image ? image.name : 'Drop a logo or hero image here'}</p><p className="mt-1 text-xs text-ink-faint">PNG, JPG, or WebP · up to 2MB{image ? ` · ${formatStage0ImageFileSize(image.size)}` : ''}</p></div>
              <button type="button" className="btn-secondary" onClick={() => inputRef.current?.click()}>{image ? 'Replace' : 'Choose image'}</button>
            </div>
          </div>

          <div className="flex justify-end"><button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => validateStep(1)}>Founder details <ArrowRight className="h-4 w-4" /></button></div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="creator-question-card">
          <div className="creator-question-number">02</div>
          <div className="space-y-2"><h2 className="font-display text-2xl text-ink">Who is behind it?</h2><p className="text-sm text-ink-muted">The founder wallet will receive access and must sign this application.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><FieldLabel>Founder name</FieldLabel><input value={founderName} onChange={(event) => setFounderName(event.target.value)} className="input-field" placeholder="Full name" maxLength={120} /></div>
            <div className="space-y-1.5"><FieldLabel>Role</FieldLabel><input value={founderRole} onChange={(event) => setFounderRole(event.target.value)} className="input-field" placeholder="Founder / Creative director" maxLength={120} /></div>
            <div className="space-y-1.5 sm:col-span-2"><FieldLabel>Email</FieldLabel><input type="email" value={founderEmail} onChange={(event) => setFounderEmail(event.target.value)} className="input-field" placeholder="founder@project.xyz" maxLength={320} /></div>
            <RnsAddressInput label="Founder wallet or .rise name" value={founderAddressInput} onChange={setFounderAddressInput} onResolvedAddressChange={setFounderResolvedAddress} required className="sm:col-span-2" hint="This must resolve to the wallet currently connected." />
          </div>
          <SocialFields prefix="Founder" x={founderX} telegram={founderTelegram} discord={founderDiscord} onX={setFounderX} onTelegram={setFounderTelegram} onDiscord={setFounderDiscord} />

          <div className="border-t border-border pt-6">
            <div className="flex items-center justify-between gap-4"><div><h3 className="flex items-center gap-2 font-display text-xl text-ink"><Users className="h-5 w-5" /> Team</h3><p className="mt-1 text-sm text-ink-muted">Optional — add up to 10 core contributors.</p></div><button type="button" onClick={addTeamMember} className="btn-secondary inline-flex items-center gap-2"><Plus className="h-4 w-4" /> Add member</button></div>
            <div className="mt-4 space-y-4">
              {team.map((member, index) => (
                <div key={member.id} className="rounded-2xl border border-border bg-canvas/40 p-4">
                  <div className="mb-4 flex items-center justify-between"><p className="text-sm font-semibold text-ink">Team member {index + 1}</p><button type="button" onClick={() => setTeam((current) => current.filter((entry) => entry.id !== member.id))} className="p-2 text-ink-faint hover:text-status-error" aria-label={`Remove team member ${index + 1}`}><Trash2 className="h-4 w-4" /></button></div>
                  <div className="grid gap-3 sm:grid-cols-2"><input value={member.name} onChange={(event) => updateTeamMember(member.id, 'name', event.target.value)} className="input-field" placeholder="Name" maxLength={120} /><input value={member.role} onChange={(event) => updateTeamMember(member.id, 'role', event.target.value)} className="input-field" placeholder="Role" maxLength={120} /></div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3"><input value={member.x ?? ''} onChange={(event) => updateTeamMember(member.id, 'x', event.target.value)} className="input-field" placeholder="X (optional)" maxLength={240} /><input value={member.telegram ?? ''} onChange={(event) => updateTeamMember(member.id, 'telegram', event.target.value)} className="input-field" placeholder="Telegram (optional)" maxLength={240} /><input value={member.discord ?? ''} onChange={(event) => updateTeamMember(member.id, 'discord', event.target.value)} className="input-field" placeholder="Discord (optional)" maxLength={240} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3"><button type="button" className="btn-ghost inline-flex items-center gap-2" onClick={() => setStep(0)}><ArrowLeft className="h-4 w-4" /> Back</button><button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => validateStep(2)}>Review <ArrowRight className="h-4 w-4" /></button></div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="creator-question-card">
          <div className="creator-question-number">03</div>
          <div className="space-y-2"><h2 className="font-display text-2xl text-ink">Review and apply</h2><p className="text-sm text-ink-muted">Your wallet signature proves the founder controls the address being approved. It does not create a transaction or cost gas.</p></div>
          <div className="creator-application-review">
            {imagePreview ? <img src={imagePreview} alt="Project" /> : null}
            <div><p className="eyebrow">{type === 'nft' ? 'NFT collection' : 'Token launch'}</p><h3 className="mt-1 font-display text-2xl text-ink">{projectName}</h3><p className="mt-2 text-sm leading-6 text-ink-muted">{projectDescription}</p></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="creator-review-item"><span>Founder</span><strong>{founderName} · {founderRole}</strong></div>
            <div className="creator-review-item"><span>Wallet</span><strong className="break-all font-mono text-xs">{founderResolvedAddress}</strong></div>
            <div className="creator-review-item"><span>Stage</span><strong>{projectStage}</strong></div>
            <div className="creator-review-item"><span>Team</span><strong>{team.length ? `${team.length + 1} people` : 'Solo founder'}</strong></div>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-canvas/40 p-4"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-[rgb(var(--color-accent))]" /><span className="text-sm leading-6 text-ink-muted">I confirm these details are accurate and I control the founder wallet listed above.</span></label>
          <div className="rounded-2xl bg-accent/10 p-4 text-sm text-ink-muted"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" /><p>Submitting stores the application in Stage0, sends it to the internal Slack channel, and emails the Stage0 project account for review.</p></div></div>
          <div className="flex items-center justify-between gap-3"><button type="button" className="btn-ghost inline-flex items-center gap-2" onClick={() => setStep(1)} disabled={isSubmitting}><ArrowLeft className="h-4 w-4" /> Back</button><button type="button" className="btn-primary min-w-44" onClick={handleSubmit} disabled={!confirmed || isSubmitting}>{isSubmitting ? <InlineLoading label="Sign & submit" /> : 'Sign & submit application'}</button></div>
        </section>
      ) : null}
    </div>
  );
}
