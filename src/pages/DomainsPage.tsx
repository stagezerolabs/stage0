import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { formatEther } from 'viem';
import { useAccount, useBalance, useChainId, useSwitchChain } from 'wagmi';
import { getExplorerUrl, riseTestnet } from '@/config';
import {
  formatDomainDisplay,
  normalizeDomainName,
  validateDomainName
} from '@/lib/domains/storage';
import { RESERVED_NAMES } from '@/lib/rns/constants';
import {
  useRnsExpiry,
  useRnsNameStatus,
  useRnsOwnedLabel,
  useRnsRegister,
  useRnsRegistrationQuote,
  useRnsRelease,
  useRnsRenew,
} from '@/lib/hooks/rns';
import {
  AlertTriangle,
  ExternalLink,
  Search,
  Wallet,
  X,
  Sparkles,
  Trash2,
  ArrowRight,
  History
} from 'lucide-react';

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const SUGGESTIONS = ['stage0', 'rise', 'rns', 'antigravity', 'testnet'];

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
  const [hintLabel, setHintLabel] = useState<string | null>(null);

  const {
    label: ownedLabel,
    displayName: ownedDisplayName,
    refetch: refetchOwned,
    expiry: ownedExpiry,
    isLoading: isOwnedLoading,
  } = useRnsOwnedLabel(address, hintLabel ?? undefined);

  // Search Queries
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  // Search History State (localStorage backed)
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('rns_search_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Offer Modal State
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);



  // Availability & Suffix Hook Logic
  const normalized = useMemo(() => normalizeDomainName(submittedQuery), [submittedQuery]);
  const validation = useMemo(() => validateDomainName(normalized), [normalized]);

  const nameStatusEnabled = validation.valid && Boolean(normalized);
  const {
    available: onChainAvailable,
    owner: onChainOwner,
    isTaken: onChainIsTaken,
    isLoading: isStatusLoading,
    refetch: refetchStatus,
  } = useRnsNameStatus(normalized, { enabled: nameStatusEnabled });

  const isReserved = useMemo(() => {
    if (!normalized) return false;
    return RESERVED_NAMES.has(normalized);
  }, [normalized]);

  const available = useMemo(() => {
    if (isReserved) return false;
    return onChainAvailable;
  }, [isReserved, onChainAvailable]);

  const takenBy = useMemo(() => {
    if (isReserved) return '0x0000000000000000000000000000000000000000';
    return onChainOwner;
  }, [isReserved, onChainOwner]);

  const isTaken = useMemo(() => {
    if (isReserved) return true;
    return onChainIsTaken;
  }, [isReserved, onChainIsTaken]);

  const {
    price: registerPrice = 0n,
    isLoading: isRegisterQuoteLoading,
  } = useRnsRegistrationQuote(normalized, { enabled: nameStatusEnabled && available });

  const { price: renewPrice = 0n, isLoading: isRenewQuoteLoading } = useRnsRegistrationQuote(
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

  const { expiry: searchExpiry = 0n } = useRnsExpiry(normalized, {
    enabled: validation.valid && Boolean(normalized) && isTaken && !available,
  });

  const isRegistering = isRegisterPending || isRegisterConfirming;
  const isRenewing = isRenewPending || isRenewConfirming;
  const isReleasing = isReleasePending || isReleaseConfirming;

  // Search History Handlers
  const addToHistory = (name: string) => {
    if (!name || name.trim() === '') return;
    const clean = name.trim().toLowerCase();
    setSearchHistory((prev) => {
      const filtered = prev.filter((item) => item !== clean);
      const next = [clean, ...filtered].slice(0, 5);
      localStorage.setItem('rns_search_history', JSON.stringify(next));
      return next;
    });
  };

  const clearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchHistory([]);
    localStorage.removeItem('rns_search_history');
    toast.success('Search history cleared');
  };

  const handleSearchSubmit = () => {
    if (!query || query.trim() === '') return;
    const cleanQuery = query.trim().toLowerCase();
    setSubmittedQuery(cleanQuery);
    addToHistory(cleanQuery);
  };

  const handleSearchHistoryClick = (name: string) => {
    setQuery(name);
    setSubmittedQuery(name);
    addToHistory(name);
  };



  // Submit Offer Modal Handler
  const handleOfferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerAmount || Number(offerAmount) <= 0) {
      toast.error('Please enter a valid offer amount');
      return;
    }
    setIsSubmittingOffer(true);
    setTimeout(() => {
      setIsSubmittingOffer(false);
      setIsOfferModalOpen(false);
      toast.success(`Offer of ${offerAmount} ETH submitted to the owner of ${formatDomainDisplay(normalized)}!`);
      setOfferAmount('');
    }, 1200);
  };

  useEffect(() => {
    if (!isRegisterSuccess || !address || !normalized) return;
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

  // Mock USD Conversion for aesthetics
  const usdValue = useMemo(() => {
    if (!registerPrice) return '0.00';
    return (Number(formatEther(registerPrice)) * 3000).toFixed(2);
  }, [registerPrice]);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      className="space-y-10 max-w-6xl mx-auto px-4"
    >
      {/* Page Hero banner */}
      <motion.section variants={itemVariants} className="space-y-3 text-left">
        <h1 className="font-display text-display-lg text-ink">
          Names
        </h1>
        <p className="text-body-lg text-ink-muted max-w-2xl">
          Your identity on RISE — powered by RNS.
        </p>
      </motion.section>

      {!isConnected ? (
        <motion.div
          variants={itemVariants}
          className="tool-surface-card p-12 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-canvas-alt mx-auto mb-6 flex items-center justify-center border border-border">
            <Wallet className="w-6 h-6 text-ink-muted" />
          </div>
          <h3 className="font-display text-display-sm text-ink mb-2">Connect your wallet</h3>
          <p className="text-body text-ink-muted max-w-xs mx-auto mb-6">
            Connect your wallet to browse, register, and manage your RNS domain names.
          </p>
          <p className="text-body-xs text-ink-faint max-w-sm mx-auto">
            Names are claimed on Rise Testnet through the RNS registrar contract.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-8">
          {/* Currently Owned Name Section (For Management) */}
          {ownedLabel ? (
            <motion.div
              variants={itemVariants}
              className="glass-card rounded-3xl p-6 md:p-8 border border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
            >
              <div className="space-y-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase border border-accent/40 bg-accent/10 text-accent">
                  Your active name
                </span>
                <h3 className="font-mono text-display-sm text-ink">{ownedDisplayName}</h3>
                {ownedExpirySec > 0 ? (
                  <p className="text-body-sm text-ink-muted">
                    {isOwnedExpired ? (
                      <span className="text-status-error font-semibold">Expired — renew to keep this identity.</span>
                    ) : (
                      <>
                        Expires{' '}
                        <span className="font-mono text-ink">
                          {new Date(ownedExpirySec * 1000).toLocaleDateString(undefined, {
                            dateStyle: 'medium',
                          })}
                        </span>
                      </>
                    )}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-3 w-full md:w-auto shrink-0">
                <button
                  type="button"
                  onClick={handleRenew}
                  disabled={isRenewing || isRenewQuoteLoading}
                  className="btn-primary py-2.5 px-6 disabled:opacity-60 text-body-sm flex-1 md:flex-initial"
                >
                  {isRenewing
                    ? 'Renewing…'
                    : `Renew (${formatEther(renewPrice)} ETH)`}
                </button>
                <button
                  type="button"
                  onClick={handleRelease}
                  disabled={isReleasing}
                  className="btn-secondary py-2.5 px-6 disabled:opacity-60 text-body-sm flex-1 md:flex-initial"
                >
                  {isReleasing ? 'Releasing…' : 'Release'}
                </button>
              </div>
            </motion.div>
          ) : null}

          {/* Search Inputs Container */}
          <motion.div variants={itemVariants} className="space-y-6">
            <div className="relative w-full max-w-2xl mx-auto space-y-2">
              <div className="relative bg-border hover:bg-accent p-[1.5px] rounded-2xl shadow-float hover:shadow-float-hover transition-all duration-300">
                <div className="bg-canvas-alt rounded-[14px] flex items-center px-4 py-1.5 w-full">
                  <Search className="w-5 h-5 text-accent pointer-events-none mr-3 shrink-0" />
                  <input
                    id="domain-search"
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      if (e.target.value === '') {
                        setSubmittedQuery('');
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearchSubmit();
                      }
                    }}
                    placeholder="Search a domain"
                    className="w-full bg-transparent border-0 text-ink focus:outline-none focus:ring-0 font-mono text-body-sm py-2 px-0"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={handleSearchSubmit}
                      className="btn-primary py-2 px-5 bg-accent hover:bg-accent-hover text-accent-foreground rounded-xl flex items-center gap-1.5 font-display text-[13px] font-semibold tracking-tight shadow-md"
                    >
                      <Sparkles className="w-4 h-4" />
                      Search
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {/* Search History & Recommendations (Only shown when not showing search results) */}
              {!submittedQuery ? (
                <motion.div
                  key="history-panel"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="w-full max-w-2xl mx-auto space-y-6"
                >
                  {searchHistory.length > 0 ? (
                    <div className="glass-card rounded-2xl p-5 border border-border space-y-4">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-ink-muted font-semibold tracking-wider uppercase">Search History</span>
                        <button
                          onClick={clearHistory}
                          className="text-accent hover:text-accent-hover font-semibold transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Clear All
                        </button>
                      </div>
                      <div className="space-y-1">
                        {searchHistory.map((histItem) => (
                          <button
                            key={histItem}
                            onClick={() => handleSearchHistoryClick(histItem)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-body-sm font-mono text-ink hover:bg-canvas/60 hover:text-accent transition-all group border border-transparent hover:border-border/30"
                          >
                            <span className="flex items-center gap-3">
                              <History className="w-4 h-4 text-ink-faint group-hover:text-accent transition-colors shrink-0" />
                              <span>{histItem}</span>
                            </span>
                            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 text-accent transition-all shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    // Suggested searches if history is empty to make it look rich
                    <div className="glass-card rounded-2xl p-5 border border-border space-y-3">
                      <p className="text-xs font-mono text-ink-muted font-semibold tracking-wider uppercase">
                        Recommended Keywords
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {SUGGESTIONS.map((item) => (
                          <button
                            key={item}
                            onClick={() => handleSearchHistoryClick(item)}
                            className="px-3.5 py-1.5 rounded-full border border-border/80 text-body-xs font-mono text-ink hover:text-accent hover:border-accent/40 bg-canvas/30 hover:bg-canvas/80 transition-all duration-200"
                          >
                            #{item}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                /* Exact Result Cards */
                <motion.div
                  key="result-panel"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="w-full max-w-2xl mx-auto space-y-4"
                >
                  <h3 className="font-display text-lg font-bold text-ink mb-2">Exact Result</h3>

                  {isStatusLoading ? (
                    <div className="glass-card rounded-2xl p-10 border border-border text-center text-ink-muted">
                      <div className="h-5 w-5 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      Checking availability…
                    </div>
                  ) : validation.valid ? (
                    available ? (
                      /* AVAILABLE CARD */
                      <div className="relative overflow-hidden glass-card rounded-3xl p-6 md:p-8 border border-accent/20 hover:border-accent/40 shadow-float flex flex-col justify-between gap-6">
                        {/* Top row: Badge on left, Price & Conversion on right */}
                        <div className="flex justify-between items-center w-full">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-[4px] text-xs font-semibold tracking-wide uppercase border border-[#4CD6FF] text-[#4CD6FF] bg-[#4CD6FF]/5 shadow-sm">
                            Available
                          </span>

                          <div className="flex items-center gap-2 select-none">
                            <span className="font-display text-lg md:text-xl font-bold text-ink font-mono">
                              {formatEther(registerPrice)} ETH
                            </span>
                          </div>
                        </div>

                        {/* Bottom row: Name on left, Buttons on right */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 w-full">
                          <div className="font-display text-2xl md:text-3xl font-bold text-ink break-all max-w-md flex flex-wrap items-baseline gap-0.5">
                            <span>{normalized}</span>
                            <span className="text-ink-faint font-semibold">.rise</span>
                          </div>

                          <div className="flex items-center gap-4 shrink-0 w-full md:w-auto mt-4 md:mt-0 justify-end">
                            {!isCorrectChain ? (
                              <button
                                type="button"
                                onClick={() => switchChain({ chainId: riseTestnet.id })}
                                disabled={isSwitchingChain}
                                className="btn-secondary w-full md:w-auto flex items-center justify-center gap-2 text-status-error border-status-error disabled:opacity-60 disabled:cursor-not-allowed text-body-sm font-semibold py-2.5 px-6"
                              >
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                {isSwitchingChain ? 'Switching…' : 'Switch Network'}
                              </button>
                            ) : (
                              <>
                                {!hasSufficientBalance && !isRegisterQuoteLoading && registerPrice > 0n ? (
                                  <div className="text-right space-y-1 mr-2">
                                    <p className="text-[11px] text-status-error flex items-center gap-1 font-semibold">
                                      <AlertTriangle className="w-3.5 h-3.5" /> Insufficient ETH
                                    </p>
                                    <p className="text-[10px] text-ink-faint font-mono">
                                      Need {formatEther(registerPrice)} ETH (Have {formatEther(userBalance)} ETH)
                                    </p>
                                  </div>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={handleRegister}
                                  disabled={
                                    isRegistering ||
                                    isOwnedLoading ||
                                    !hasSufficientBalance ||
                                    isRegisterQuoteLoading
                                  }
                                  className="btn-primary py-2.5 px-6 bg-[#A5F95A] hover:bg-[#92E446] text-black font-semibold rounded-xl text-body-sm shadow-md shadow-[#A5F95A]/10 active:scale-98 transition-all flex items-center gap-2 flex-1 md:flex-initial"
                                >
                                  {isRegistering ? (
                                    <>
                                      <div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin shrink-0" />
                                      Confirming…
                                    </>
                                  ) : isRegisterQuoteLoading ? (
                                    'Loading…'
                                  ) : (
                                    `Register`
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* REGISTERED CARD */
                      <div className="relative overflow-hidden glass-card rounded-3xl p-6 md:p-8 border border-status-error/20 hover:border-status-error/40 shadow-float flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="space-y-1 w-full max-w-md">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border border-status-error/30 bg-status-error/10 text-status-error shadow-sm mb-1.5">
                            Registered
                          </span>
                          <div className="font-display text-2xl font-bold text-ink-muted flex items-baseline">
                            <span>{normalized}</span>
                            <span className="text-ink-faint">.rise</span>
                          </div>

                          {/* Aesthetic Gray Placeholder bar to match mockups */}
                          <div className="h-2.5 bg-border-strong/40 rounded-full w-40 mt-3.5 animate-pulse" />

                          {takenBy ? (
                            <p className="text-body-xs text-ink-muted mt-2.5">
                              Owned by:{' '}
                              <a
                                href={`${explorerUrl}/address/${takenBy}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-ink hover:text-accent underline transition-colors"
                              >
                                {takenBy.slice(0, 6)}…{takenBy.slice(-4)}
                              </a>
                              {searchExpiry > 0n ? (
                                <>
                                  {' '}· Expires:{' '}
                                  <span className="font-mono text-ink-faint">
                                    {new Date(Number(searchExpiry) * 1000).toLocaleDateString(undefined, {
                                      dateStyle: 'short',
                                    })}
                                  </span>
                                </>
                              ) : null}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-4 shrink-0 w-full md:w-auto mt-4 md:mt-0 justify-end">
                          <button
                            type="button"
                            disabled
                            className="btn-secondary py-2.5 px-6 font-display font-semibold flex items-center justify-center gap-2 bg-ink/5 text-ink-muted border-border cursor-not-allowed opacity-50 w-full md:w-auto text-body-sm shadow-sm"
                          >
                            Make Offer <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="rounded-2xl border border-status-error/20 bg-status-error/5 p-4 text-center">
                      <p className="text-body-sm text-status-error font-medium">{validation.error}</p>
                    </div>
                  )}

                  {registerHash ? (
                    <a
                      href={`${explorerUrl}/tx/${registerHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 text-body-sm text-accent hover:underline mt-4 font-medium"
                    >
                      View transaction
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      {/* MAKE OFFER GLASSMORPHISM MODAL */}
      <AnimatePresence>
        {isOfferModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop layer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOfferModalOpen(false)}
              className="absolute inset-0 bg-canvas/80 backdrop-blur-sm"
            />
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.5, bounce: 0.15 }}
              className="relative w-full max-w-md bg-canvas-alt border border-border shadow-float rounded-3xl p-6 overflow-hidden backdrop-blur-md"
            >
              {/* Corner ambient glows */}
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent-secondary/10 blur-xl pointer-events-none" />
              <div className="absolute -left-10 -bottom-10 h-28 w-28 rounded-full bg-accent/10 blur-xl pointer-events-none" />

              <button
                onClick={() => setIsOfferModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-canvas transition-colors text-ink-muted hover:text-ink"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>

              <form onSubmit={handleOfferSubmit} className="space-y-5 relative z-10 text-left">
                <div className="space-y-1">
                  <h3 className="font-display text-xl font-bold text-ink">Make an Offer</h3>
                  <p className="text-body-xs text-ink-muted">
                    Submit your bid to register the domain <span className="font-mono text-ink font-semibold">{formatDomainDisplay(normalized)}</span>. Offers will be reviewed by the owner.
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="offer-amount" className="block text-body-xs font-mono text-ink-muted">
                    Offer Amount (ETH)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-body-sm text-ink-muted select-none">
                      Ξ
                    </span>
                    <input
                      id="offer-amount"
                      type="number"
                      step="0.001"
                      min="0.001"
                      required
                      value={offerAmount}
                      onChange={(e) => setOfferAmount(e.target.value)}
                      placeholder="e.g. 0.05"
                      className="input-field pl-9 w-full font-mono text-body-sm"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-canvas/60 p-4 border border-border/50 text-[11px] text-ink-faint leading-relaxed">
                  ⚠️ Note: Bids are mock transactions simulating offchain offers. If accepted, the owner will contact you or execute a transfer onchain. No real funds are locked at this stage.
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOfferModalOpen(false)}
                    className="btn-secondary flex-1 py-2 text-body-sm font-semibold border-border hover:border-ink-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingOffer}
                    className="btn-primary flex-1 py-2 text-body-sm font-semibold flex items-center justify-center gap-2"
                  >
                    {isSubmittingOffer ? (
                      <>
                        <div className="h-4 w-4 border-2 border-accent-foreground border-t-transparent rounded-full animate-spin shrink-0" />
                        Submitting…
                      </>
                    ) : (
                      'Submit Offer'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


    </motion.div>
  );
};

export default DomainsPage;
