import { getExplorerUrl, riseTestnet } from '@/config';
import {
  formatDomainDisplay,
  normalizeDomainName,
  validateDomainName
} from '@/lib/domains/storage';
import {
  useRnsExpiry,
  useRnsNameStatus,
  useRnsOwnedLabel,
  useRnsRegister,
  useRnsRegistrationQuote,
  useRnsRelease,
  useRnsRenew,
} from '@/lib/hooks/rns';
import { motion } from 'framer-motion';
import { AlertTriangle, Check, ExternalLink, Search, Wallet, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { formatEther } from 'viem';
import { useAccount, useBalance, useChainId, useSwitchChain } from 'wagmi';

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
  const chainId = useChainId();
  const isCorrectChain = chainId === riseTestnet.id;
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const explorerUrl = getExplorerUrl(chainId);

  const { data: balanceData } = useBalance({
    address,
    query: { enabled: isConnected && Boolean(address) },
  });

  // Local hint: lets us show a just-registered name while the subgraph indexes it.
  // This is React state only — nothing touches localStorage.
  const [hintLabel, setHintLabel] = useState<string | null>(null);

  const {
    label: ownedLabel,
    displayName: ownedDisplayName,
    refetch: refetchOwned,
    expiry: ownedExpiry,
    isLoading: isOwnedLoading,
  } = useRnsOwnedLabel(address, hintLabel ?? undefined);

  const [query, setQuery] = useState('');
  const searchText = ownedLabel ?? query;

  const normalized = useMemo(() => normalizeDomainName(searchText), [searchText]);
  const validation = useMemo(() => validateDomainName(normalized), [normalized]);

  const nameStatusEnabled = validation.valid && Boolean(normalized) && !ownedLabel;
  const {
    available,
    owner: takenBy,
    isOwnedByUser,
    isTaken,
    isLoading: isStatusLoading,
    refetch: refetchStatus,
  } = useRnsNameStatus(normalized, { enabled: nameStatusEnabled });

  const {
    price: registerPrice,
    isLoading: isRegisterQuoteLoading,
  } = useRnsRegistrationQuote(normalized, { enabled: nameStatusEnabled && available });

  const { price: renewPrice, isLoading: isRenewQuoteLoading } = useRnsRegistrationQuote(
    ownedLabel ?? '',
    { enabled: Boolean(ownedLabel) },
  );

  const {
    register,
    hash: registerHash,
    isPending: isRegisterPending,
    isConfirming: isRegisterConfirming,
    isSuccess: isRegisterSuccess,
    error: registerError,
    reset: resetRegister,
  } = useRnsRegister();

  const {
    renew,
    isPending: isRenewPending,
    isConfirming: isRenewConfirming,
    isSuccess: isRenewSuccess,
    error: renewError,
  } = useRnsRenew();

  const {
    release,
    isPending: isReleasePending,
    isConfirming: isReleaseConfirming,
    isSuccess: isReleaseSuccess,
    error: releaseError,
  } = useRnsRelease();

  const { expiry: searchExpiry } = useRnsExpiry(normalized, {
    enabled: validation.valid && Boolean(normalized) && isTaken && !available,
  });

  const isRegistering = isRegisterPending || isRegisterConfirming;
  const isRenewing = isRenewPending || isRenewConfirming;
  const isReleasing = isReleasePending || isReleaseConfirming;

  useEffect(() => {
    if (!isRegisterSuccess || !address || !normalized) return;
    // Set hint so the UI shows the new name while the subgraph indexes the tx
    setHintLabel(normalized);
    void refetchOwned();
    void refetchStatus();
    toast.success(`Registered ${formatDomainDisplay(normalized)}`);
    resetRegister();
  }, [
    address,
    isRegisterSuccess,
    normalized,
    refetchOwned,
    refetchStatus,
    resetRegister,
  ]);

  // Clear hint once the subgraph has confirmed the label onchain
  useEffect(() => {
    if (ownedLabel && hintLabel && ownedLabel === hintLabel) {
      setHintLabel(null);
    }
  }, [ownedLabel, hintLabel]);

  useEffect(() => {
    if (registerError) {
      toast.error(registerError.message.split('\n')[0] ?? 'Registration failed.');
    }
  }, [registerError]);

  useEffect(() => {
    if (isRenewSuccess) {
      toast.success('Name renewed.');
      void refetchOwned();
    }
  }, [isRenewSuccess, refetchOwned]);

  useEffect(() => {
    if (renewError) {
      toast.error(renewError.message.split('\n')[0] ?? 'Renewal failed.');
    }
  }, [renewError]);

  useEffect(() => {
    if (isReleaseSuccess) {
      toast.success('Name released.');
      setHintLabel(null);
      void refetchOwned();
    }
  }, [isReleaseSuccess, refetchOwned]);

  useEffect(() => {
    if (releaseError) {
      toast.error(releaseError.message.split('\n')[0] ?? 'Release failed.');
    }
  }, [releaseError]);

  const handleRegister = () => {
    if (!isConnected || !address) {
      toast.error('Connect your wallet to register a name.');
      return;
    }
    if (!validation.valid || !available) return;

    register({
      name: normalized,
      value: registerPrice,
    });
  };

  const handleRenew = () => {
    if (!ownedLabel) return;
    renew({ name: ownedLabel, value: renewPrice });
  };

  const handleRelease = () => {
    if (!ownedLabel) return;
    if (!window.confirm(`Release ${ownedDisplayName}? This cannot be undone.`)) return;
    release({ name: ownedLabel });
  };

  const userBalance = balanceData?.value ?? 0n;
  const hasSufficientBalance = registerPrice === 0n || userBalance >= registerPrice;

  const nowSec = Math.floor(Date.now() / 1000);
  const ownedExpirySec = Number(ownedExpiry);
  const isOwnedExpired = ownedExpirySec > 0 && ownedExpirySec < nowSec;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      className="space-y-10 max-w-2xl mx-auto"
    >
      <motion.section variants={itemVariants} className="space-y-2">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-display text-display-lg text-ink">Names</h1>
            <p className="text-body text-ink-muted">Your identity on Rise — powered by RNS.</p>
          </div>
        </div>
      </motion.section>

      {!isConnected ? (
        <motion.div
          variants={itemVariants}
          className="glass-card rounded-3xl p-8 text-center border border-border"
        >
          <div className="w-14 h-14 rounded-full bg-canvas-alt mx-auto mb-4 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-ink-muted" />
          </div>
          <p className="text-body text-ink-muted mb-2">Connect your wallet to register a name.</p>
          <p className="text-body-sm text-ink-faint">
            Names are registered on Rise Testnet through the RNS registrar contract.
          </p>
        </motion.div>
      ) : (
        <>
          {ownedLabel ? (
            <motion.div
              variants={itemVariants}
              className="glass-card rounded-3xl p-6 border border-border space-y-4"
            >
              <p className="form-label">Your name</p>
              <p className="font-mono text-body-lg text-ink">{ownedDisplayName}</p>
              {ownedExpirySec > 0 ? (
                <p className="text-body-sm text-ink-muted">
                  {isOwnedExpired ? (
                    <span className="text-status-error">Expired — renew to keep this name.</span>
                  ) : (
                    <>
                      Expires{' '}
                      {new Date(ownedExpirySec * 1000).toLocaleDateString(undefined, {
                        dateStyle: 'medium',
                      })}
                    </>
                  )}
                </p>
              ) : null}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleRenew}
                  disabled={isRenewing || isRenewQuoteLoading}
                  className="btn-primary flex-1 disabled:opacity-60"
                >
                  {isRenewing
                    ? 'Renewing…'
                    : `Renew (${formatEther(renewPrice)} ETH)`}
                </button>
                <button
                  type="button"
                  onClick={handleRelease}
                  disabled={isReleasing}
                  className="btn-secondary flex-1 disabled:opacity-60"
                >
                  {isReleasing ? 'Releasing…' : 'Release name'}
                </button>
              </div>
            </motion.div>
          ) : null}

          <motion.div
            variants={itemVariants}
            className="glass-card rounded-3xl p-6 border border-border space-y-5"
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" />
              <input
                id="domain-search"
                type="text"
                value={ownedLabel ? query : searchText}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search for a name${ownedLabel ? ' or enter a new one' : ''}`}
                className="input-field w-full pl-11 font-mono text-body-sm"
                autoComplete="off"
                spellCheck={false}
                disabled={Boolean(ownedLabel) && !query}
              />
            </div>

            {(ownedLabel ? query : searchText).trim() ? (
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
                  ) : isStatusLoading ? (
                    <p className="text-body-sm text-ink-muted">Checking availability…</p>
                  ) : available ? (
                    <p className="flex items-center gap-2 text-body-sm text-status-live">
                      <Check className="w-4 h-4 shrink-0" />
                      Available — {formatEther(registerPrice)} ETH / year
                    </p>
                  ) : (
                    <p className="flex items-center gap-2 text-body-sm text-status-error">
                      <X className="w-4 h-4 shrink-0" />
                      Not available
                      {takenBy ? (
                        <span className="font-mono text-ink-faint">
                          ({takenBy.slice(0, 6)}…{takenBy.slice(-4)})
                        </span>
                      ) : null}
                      {searchExpiry > 0n ? (
                        <span className="text-ink-faint">
                          · expires{' '}
                          {new Date(Number(searchExpiry) * 1000).toLocaleDateString(undefined, {
                            dateStyle: 'short',
                          })}
                        </span>
                      ) : null}
                    </p>
                  )
                ) : (
                  <p className="text-body-sm text-status-error">{validation.error}</p>
                )}
              </div>
            ) : null}

            {!ownedLabel ? (
              <>
                {!isCorrectChain && isConnected ? (
                  <button
                    type="button"
                    onClick={() => switchChain({ chainId: riseTestnet.id })}
                    disabled={isSwitchingChain}
                    className="btn-secondary w-full flex items-center justify-center gap-2 text-status-error border-status-error disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {isSwitchingChain ? 'Switching…' : 'Switch to Rise Testnet to register'}
                  </button>
                ) : (
                  <>
                    {!hasSufficientBalance && available && !isRegisterQuoteLoading && registerPrice > 0n ? (
                      <p className="flex items-center gap-2 text-body-sm text-status-error">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        Insufficient balance — need {formatEther(registerPrice)} ETH, have{' '}
                        {formatEther(userBalance)} ETH
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleRegister}
                      disabled={
                        isRegistering ||
                        isOwnedLoading ||
                        !validation.valid ||
                        !available ||
                        isStatusLoading ||
                        isRegisterQuoteLoading ||
                        !isCorrectChain ||
                        !hasSufficientBalance ||
                        !(ownedLabel ? query : searchText).trim()
                      }
                      className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isRegistering
                        ? 'Confirm in wallet…'
                        : isRegisterQuoteLoading
                          ? 'Loading price…'
                          : `Register for ${formatEther(registerPrice)} ETH`}
                    </button>
                  </>
                )}
              </>
            ) : null}

            {registerHash ? (
              <a
                href={`${explorerUrl}/tx/${registerHash}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 text-body-sm text-accent hover:underline"
              >
                View transaction
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : null}
          </motion.div>

        </>
      )}
    </motion.div>
  );
};

export default DomainsPage;
