import React from 'react';
import { Link } from 'react-router-dom';
import { useChainId } from 'wagmi';
import { getExplorerUrl } from '@/config';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from '@/components/ui/icons';
import { useCreateTokenSigner } from './signers/useCreateTokenSigner';
import { useLockTokenSigner } from './signers/useLockTokenSigner';
import { useAirdropSigner } from './signers/useAirdropSigner';
import { useBuyNameSigner } from './signers/useBuyNameSigner';
import type { SennaActionDraft, SignerState } from './types';

const TITLES: Record<SennaActionDraft['actionType'], string> = {
  create_token: 'Create Token',
  create_nft: 'Create NFT',
  create_presale: 'Create Launch',
  lock_token: 'Lock Tokens',
  airdrop_tokens: 'Airdrop',
  buy_name: 'Register .rise Name',
  open_launchpad: 'Open Launchpad',
  open_dashboard: 'Open Dashboard',
  open_route: 'Open Page',
};

function PrefillTable({ draft }: { draft: SennaActionDraft }) {
  const rows = formatPrefill(draft);
  if (rows.length === 0) return null;
  return (
    <dl className="senna-card-fields">
      {rows.map(([label, value]) => (
        <div key={label} className="senna-card-row">
          <dt>{label}</dt>
          <dd title={value}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatPrefill(draft: SennaActionDraft): Array<[string, string]> {
  const p = draft.prefill || {};
  if (draft.actionType === 'create_token') {
    return [
      ['Name', p.name || '—'],
      ['Symbol', p.symbol || '—'],
      ['Type', formatTokenType(p.tokenType)],
      ['Supply', p.initialSupply ? Number(p.initialSupply).toLocaleString() : '—'],
      ['Decimals', p.decimals || '18'],
    ];
  }
  if (draft.actionType === 'lock_token') {
    return [
      ['Token', short(p.token)],
      ['Amount', p.amount ? Number(p.amount).toLocaleString() : '—'],
      ['Duration', p.duration ? `${p.duration} day${p.duration === '1' ? '' : 's'}` : '—'],
      ['Name', p.name || 'Token Lock'],
    ];
  }
  if (draft.actionType === 'airdrop_tokens') {
    const isNative = p.nativeToken === 'true';
    const recipientCount = (p.recipientsData || '').split(/\r?\n/).filter(Boolean).length;
    return [
      ['Asset', isNative ? 'Native ETH' : short(p.token)],
      ['Recipients', `${recipientCount}`],
    ];
  }
  if (draft.actionType === 'buy_name') {
    return [
      ['Name', p.name ? `${p.name}.rise` : '—'],
      ['Duration', '1 year'],
    ];
  }
  return Object.entries(p).slice(0, 6).map(([k, v]) => [k, v || '—']);
}

function short(addr: string | undefined): string {
  if (!addr || addr.length < 10) return addr || '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatTokenType(raw: string | undefined): string {
  switch ((raw || 'plain').toLowerCase()) {
    case 'mintable': return 'Mintable';
    case 'burnable': return 'Burnable';
    case 'taxable': return 'Taxable';
    case 'nonmintable':
    case 'non_mintable':
    case 'non-mintable':
      return 'Non-mintable';
    default: return 'Plain';
  }
}

function useSignerForDraft(draft: SennaActionDraft): SignerState | null {
  const create = useCreateTokenSigner(draft);
  const lock = useLockTokenSigner(draft);
  const airdrop = useAirdropSigner(draft);
  const buyName = useBuyNameSigner(draft);

  switch (draft.actionType) {
    case 'create_token': return create;
    case 'lock_token': return lock;
    case 'airdrop_tokens': return airdrop;
    case 'buy_name': return buyName;
    default: return null;
  }
}

export const SennaSignCard: React.FC<{ draft: SennaActionDraft }> = ({ draft }) => {
  const chainId = useChainId();
  const signer = useSignerForDraft(draft);

  const isSignable = signer !== null;
  const phase = signer?.phase ?? 'idle';
  const explorerLink = (hash?: `0x${string}` | null) =>
    hash ? `${getExplorerUrl(chainId)}/tx/${hash}` : '';

  return (
    <div className="senna-card">
      <div className="senna-card-head">
        <div className="senna-card-badge">
          <span className="senna-card-dot" />
          <span>RISE Testnet</span>
        </div>
        <div className="senna-card-title">{TITLES[draft.actionType] || 'Action'}</div>
        <p className="senna-card-summary">{draft.summary}</p>
      </div>

      <PrefillTable draft={draft} />

      {isSignable && signer && (
        <>
          {signer.step && (
            <div className="senna-card-steps" data-step={signer.step}>
              <div className="senna-card-step" data-active={signer.step === 'approve'} data-done={phase === 'awaiting_signature' && signer.step !== 'approve'}>
                <span>1</span> Approve
              </div>
              <div className="senna-card-step-divider" />
              <div className="senna-card-step" data-active={signer.step === 'action'}>
                <span>2</span> Sign
              </div>
            </div>
          )}

          <button
            type="button"
            className="senna-card-primary"
            data-phase={phase}
            onClick={signer.primary}
            disabled={signer.busy || (!signer.ready && phase !== 'needs_wallet' && phase !== 'needs_chain' && phase !== 'error')}
          >
            {signer.busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {phase === 'success' && <CheckCircle2 className="h-4 w-4" />}
            <span>{signer.primaryLabel}</span>
          </button>

          {signer.errorMessage && (
            <p className="senna-card-error">
              <AlertTriangle className="h-3.5 w-3.5" />
              {signer.errorMessage}
            </p>
          )}

          {(signer.approveHash || signer.actionHash) && (
            <div className="senna-card-receipts">
              {signer.approveHash && (
                <a className="senna-card-receipt" href={explorerLink(signer.approveHash)} target="_blank" rel="noreferrer">
                  Approve tx <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {signer.actionHash && (
                <a className="senna-card-receipt" href={explorerLink(signer.actionHash)} target="_blank" rel="noreferrer">
                  Action tx <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {phase === 'success' && signer.createdAddress && (
            <div className="senna-card-result">
              <span>New address</span>
              <code>{signer.createdAddress}</code>
            </div>
          )}
        </>
      )}

      {!isSignable && draft.targetRoute && (
        <Link to={draft.targetRoute} className="senna-card-primary">
          <span>Open in Stage0</span>
          <ExternalLink className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
};

export default SennaSignCard;
