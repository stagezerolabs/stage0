import {
  DOMAIN_SUFFIX,
  formatDomainDisplay,
  getDomainOwner,
  isDomainAvailable,
  normalizeDomainName,
  validateDomainName,
} from '@/lib/domains/storage';
import { useUserDomain } from '@/lib/hooks/useUserDomain';
import { motion } from 'framer-motion';
import { Check, Search, Wallet, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAccount } from 'wagmi';

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const DomainsPage: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { domain, mintDomain } = useUserDomain(address);
  const [query, setQuery] = useState('');
  const [isMinting, setIsMinting] = useState(false);
  const searchText = domain ?? query;

  const normalized = useMemo(() => normalizeDomainName(searchText), [searchText]);
  const validation = useMemo(() => validateDomainName(normalized), [normalized]);
  const available = useMemo(
    () => validation.valid && isDomainAvailable(normalized),
    [normalized, validation.valid],
  );
  const takenBy = useMemo(
    () => (validation.valid && !available ? getDomainOwner(normalized) : null),
    [available, normalized, validation.valid],
  );
  const isOwnedByUser =
    Boolean(domain && normalized === domain) ||
    Boolean(takenBy && address && takenBy.toLowerCase() === address.toLowerCase());

  const handleMint = () => {
    if (!isConnected || !address) {
      toast.error('Connect your wallet to mint a name.');
      return;
    }
    setIsMinting(true);
    const result = mintDomain(searchText);
    setIsMinting(false);
    if (result.ok) {
      toast.success(`Minted ${formatDomainDisplay(result.name)}`);
      return;
    }
    toast.error(result.error);
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      className="space-y-8 max-w-3xl mx-auto"
    >
      <motion.section variants={itemVariants} className="page-hero-card">
        <div className="flex items-center gap-3">
          <div>
            <div className="eyebrow">Identity</div>
            <h1 className="ds-h1 mt-2">Names</h1>
            <p className="text-body text-ink-muted mt-3 max-w-xl">
              Your identity on Rise.
            </p>
          </div>
        </div>
      </motion.section>

      {!isConnected ? (
        <motion.div
          variants={itemVariants}
          className="tool-surface-card p-8 text-center"
        >
          <div className="w-14 h-14 rounded-full bg-canvas-alt mx-auto mb-4 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-ink-muted" />
          </div>
          <p className="text-body text-ink-muted mb-2">Connect your wallet to mint a name.</p>
          <p className="text-body-sm text-ink-faint">
            Names are saved in local storage only. This is for testing, not onchain DNS.
          </p>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants} className="tool-surface-card p-6 space-y-5">
          <label htmlFor="domain-search" className="form-label">
            Find a name
          </label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" />
            <input
              id="domain-search"
              type="text"
              value={searchText}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`my-project${DOMAIN_SUFFIX}`}
              className="input-field w-full pl-11 font-mono text-body-sm"
              autoComplete="off"
              spellCheck={false}
              disabled={Boolean(domain)}
            />
          </div>

          {searchText.trim() ? (
            <div className="rounded-2xl border border-border bg-canvas-alt/80 p-4 space-y-2">
              <p className="text-body-sm text-ink-muted">
                Preview:{' '}
                <span className="font-mono text-ink">
                  {validation.valid ? formatDomainDisplay(normalized) : '—'}
                </span>
              </p>
              {validation.valid ? (
                isOwnedByUser ? (
                  <p className="flex items-center gap-2 text-body-sm text-status-live">
                    <Check className="w-4 h-4 shrink-0" />
                    You own this name.
                  </p>
                ) : available ? (
                  <p className="flex items-center gap-2 text-body-sm text-status-live">
                    <Check className="w-4 h-4 shrink-0" />
                    Name available.
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-body-sm text-status-error">
                    <X className="w-4 h-4 shrink-0" />
                    Already taken
                    {takenBy ? (
                      <span className="font-mono text-ink-faint">
                        ({takenBy.slice(0, 6)}…{takenBy.slice(-4)})
                      </span>
                    ) : null}
                  </p>
                )
              ) : (
                <p className="text-body-sm text-status-error">{validation.error}</p>
              )}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleMint}
            disabled={
              isMinting ||
              Boolean(domain) ||
              !validation.valid ||
              !available ||
              !searchText.trim()
            }
            className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {domain ? 'Name already minted' : isMinting ? 'Minting…' : `Mint${DOMAIN_SUFFIX} name`}
          </button>
        </motion.div>
      )}
    </motion.div>
  );
};

export default DomainsPage;
