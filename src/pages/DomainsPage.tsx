import { getExplorerUrl, riseTestnet } from '@/config';
import {
  formatDomainDisplay,
  normalizeDomainName,
  validateDomainName
} from '@/lib/domains/storage';
import {
  useRnsApproveForAll,
  useRnsContracts,
  useRnsExpiry,
  useRnsIsApproved,
  useRnsNameStatus,
  useRnsOwnedLabel,
  useRnsRegister,
  useRnsRegistrationQuote,
  useRnsRelease,
  useRnsRenew,
} from '@/lib/hooks/rns';
import { RNSResolver } from '@/lib/rns/abis';
import { RESERVED_NAMES } from '@/lib/rns/constants';
import { setPrimaryLabel } from '@/lib/rns/primary-label';
import { saveRecentRegistration } from '@/lib/rns/recent-registration';
import { rnsNamehash } from '@/lib/rns/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  History,
  Search,
  Star,
  Trash2,
  Wallet,
  X,
} from '@/components/ui/icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { formatEther } from 'viem';
import { useAccount, useBalance, useChainId, useSwitchChain, useWriteContract } from 'wagmi';

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
  const { resolver: resolverAddress } = useRnsContracts();
  const { writeContract: writeResolverText } = useWriteContract();

  const { data: balanceData } = useBalance({
    address,
    chainId: riseTestnet.id,
    query: { enabled: isConnected && Boolean(address) },
  });

  // Local hint: lets us show a just-registered name while the subgraph indexes it.
  const [hintLabel, setHintLabel] = useState<string | null>(null);
  // Survives renders and potential wallet-triggered page reloads within the same session.
  const lastRegisteredRef = useRef<string>('');
  // Prevents the post-register label write from firing more than once.
  const setTextFiredRef = useRef(false);

  const {
    label: ownedLabel,
    displayName: ownedDisplayName,
    refetch: refetchOwned,
    expiry: ownedExpiry,
    isLoading: isOwnedLoading,
    allDomains: ownedDomains,
  } = useRnsOwnedLabel(address, hintLabel ?? undefined);

  // Search Queries
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQueryName = useMemo(() => {
    const raw = (searchParams.get('name') ?? searchParams.get('q'))?.trim().toLowerCase() ?? '';
    if (!raw) return '';
    return /^[a-z0-9_-]{3,32}$/.test(raw) ? raw : '';
  }, [searchParams]);
  const [query, setQuery] = useState(initialQueryName);
  const [submittedQuery, setSubmittedQuery] = useState(initialQueryName);

  useEffect(() => {
    if (!initialQueryName) return;
    setQuery(initialQueryName);
    setSubmittedQuery(initialQueryName);
    // Drop the param so the next user-typed query doesn't get fought by the URL
    const next = new URLSearchParams(searchParams);
    next.delete('name');
    next.delete('q');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQueryName]);

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

  // True when the searched name is owned by the connected wallet (but isn't their primary)
  const isOwnedByMe = useMemo(() => {
    if (!normalized || !address || !isTaken) return false;
    return ownedDomains.some((d) => d.label === normalized);
  }, [normalized, address, isTaken, ownedDomains]);

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

  const { isApproved, refetch: refetchApproval } = useRnsIsApproved(address);

  const {
    approve,
    isPending: isApprovePending,
    isConfirming: isApproveConfirming,
    isSuccess: isApproveSuccess,
    error: approveError,
    reset: resetApprove,
  } = useRnsApproveForAll();

  // Name to register once approval TX confirms (two-step flow).
  const pendingRegisterAfterApproval = useRef<string>('');

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

  const isApproving = isApprovePending || isApproveConfirming;
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
    if (!isRegisterSuccess || !address) return;
    if (setTextFiredRef.current) return;
    setTextFiredRef.current = true;

    // Recover the name from the ref or localStorage in case React state was
    // cleared by a wallet-triggered page reload after TX confirmation.
    const registeredName =
      normalized ||
      lastRegisteredRef.current ||
      localStorage.getItem('rns_pending_reg') ||
      '';
    if (!registeredName) return;

    localStorage.removeItem('rns_pending_reg');
    lastRegisteredRef.current = '';

    const node = rnsNamehash(registeredName);
    saveRecentRegistration(address, registeredName, node);
    // Set as primary immediately so Dashboard shows it while the API index catches up.
    setPrimaryLabel(address, registeredName);
    writeResolverText({
      address: resolverAddress,
      abi: RNSResolver,
      functionName: "setText",
      args: [node, "label", registeredName],
    });
    setHintLabel(registeredName);
    void refetchOwned();
    void refetchStatus();
    toast.success(`Registered ${formatDomainDisplay(registeredName)}`);
    resetRegister();
  }, [
    address,
    isRegisterSuccess,
    normalized,
    refetchOwned,
    refetchStatus,
    resetRegister,
    resolverAddress,
    writeResolverText,
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

  // When the approval TX confirms, proceed to register automatically.
  useEffect(() => {
    if (!isApproveSuccess) return;
    const nameToRegister = pendingRegisterAfterApproval.current;
    pendingRegisterAfterApproval.current = '';
    resetApprove();
    void refetchApproval();
    if (!nameToRegister) return;
    lastRegisteredRef.current = nameToRegister;
    localStorage.setItem('rns_pending_reg', nameToRegister);
    register({ name: nameToRegister, value: registerPrice });
  }, [isApproveSuccess, register, registerPrice, refetchApproval, resetApprove]);

  useEffect(() => {
    if (approveError) {
      pendingRegisterAfterApproval.current = '';
      toast.error(approveError.message.split('\n')[0] ?? 'Approval failed.');
    }
  }, [approveError]);

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

    setTextFiredRef.current = false;

    if (!isApproved) {
      // Step 1: approve the registrar as an operator so it can call
      // resolver.setAddr(node, user) on our behalf during registration.
      pendingRegisterAfterApproval.current = normalized;
      approve();
      return;
    }

    // Registrar already approved — go straight to register.
    lastRegisteredRef.current = normalized;
    localStorage.setItem('rns_pending_reg', normalized);

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

  const handleSetPrimary = (label: string) => {
    if (!address) return;
    setPrimaryLabel(address, label);
    void refetchOwned();
    toast.success(`${formatDomainDisplay(label)} set as your primary name.`);
  };

  const userBalance = balanceData?.value ?? 0n;
  const hasSufficientBalance = !balanceData || registerPrice === 0n || userBalance >= registerPrice;

  const nowSec = Math.floor(Date.now() / 1000);
  const ownedExpirySec = Number(ownedExpiry);
  const isOwnedExpired = ownedExpirySec > 0 && ownedExpirySec < nowSec;
  const TWO_MONTHS_SEC = 60 * 24 * 60 * 60; // 60 days
  const isWithinRenewalWindow =
    ownedExpirySec > 0 && ownedExpirySec - nowSec <= TWO_MONTHS_SEC;

  // Mock USD Conversion for aesthetics (optional, unused)
  // const usdValue = useMemo(() => {
  //   if (!registerPrice) return '0.00';
  //   return (Number(formatEther(registerPrice)) * 3000).toFixed(2);
  // }, [registerPrice]);

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
          Your custom username on the RISE network.
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Search & Register */}
          <div className="lg:col-span-7 space-y-6">
            {/* Search Input Card */}
            <div className="rounded-3xl border border-border bg-canvas-alt p-6 space-y-4">
              <h3 className="font-display text-lg font-bold text-ink">Find a name</h3>
              <div className="relative bg-border hover:bg-accent p-[1.5px] rounded-2xl transition-colors duration-200">
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
                      className="btn-primary py-2 px-5 bg-accent hover:bg-accent-hover text-accent-foreground rounded-xl flex items-center gap-1.5 font-display text-[13px] font-semibold tracking-tight shadow-none"
                    >
                      Search
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Panel */}
            <AnimatePresence mode="wait">
              {!submittedQuery ? (
                <motion.div
                  key="history-panel"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {searchHistory.length > 0 ? (
                    <div className="glass-card rounded-3xl p-6 border border-border space-y-4">
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
                    <div className="glass-card rounded-3xl p-6 border border-border space-y-4">
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
                <motion.div
                  key="result-panel"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <h3 className="font-display text-sm font-semibold tracking-wider uppercase text-ink-muted">Search Result</h3>

                  {isStatusLoading ? (
                    <div className="glass-card rounded-3xl p-12 border border-border text-center text-ink-muted">
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
                                    isApproving ||
                                    isRegistering ||
                                    isOwnedLoading ||
                                    Boolean(balanceData && !hasSufficientBalance) ||
                                    isRegisterQuoteLoading
                                  }
                                  className="btn-primary py-2.5 px-6 bg-[#A5F95A] hover:bg-[#92E446] text-black font-semibold rounded-xl text-body-sm shadow-md shadow-[#A5F95A]/10 active:scale-98 transition-all flex items-center gap-2 flex-1 md:flex-initial"
                                >
                                  {isApproving ? (
                                    <>
                                      <div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin shrink-0" />
                                      Approving…
                                    </>
                                  ) : isRegistering ? (
                                    <>
                                      <div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin shrink-0" />
                                      Confirming…
                                    </>
                                  ) : isRegisterQuoteLoading ? (
                                    'Loading…'
                                  ) : !isApproved ? (
                                    'Approve & Register'
                                  ) : (
                                    'Register'
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : isOwnedByMe ? (
                      /* YOU OWN THIS CARD */
                      <div className="relative overflow-hidden glass-card rounded-3xl p-6 md:p-8 border border-accent/20 hover:border-accent/40 shadow-float flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="space-y-1 w-full max-w-md">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-[4px] text-[10px] font-bold tracking-wider uppercase border border-accent/40 bg-accent/10 text-accent shadow-sm mb-1.5">
                            You own this
                          </span>
                          <div className="font-display text-2xl font-bold text-ink flex items-baseline">
                            <span>{normalized}</span>
                            <span className="text-ink-faint">.rise</span>
                          </div>
                          {searchExpiry > 0n ? (
                            <p className="text-body-xs text-ink-muted mt-1">
                              Expires{' '}
                              <span className="font-mono text-ink font-semibold">
                                {new Date(Number(searchExpiry) * 1000).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                              </span>
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 w-full md:w-auto mt-4 md:mt-0 justify-end">
                          {normalized !== ownedLabel ? (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(normalized)}
                              className="btn-primary py-2.5 px-6 font-semibold text-body-sm flex items-center gap-2"
                            >
                              <Star className="w-4 h-4" />
                              Set as Primary
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-accent/40 bg-accent/10 text-accent text-[11px] font-semibold">
                              <Star className="w-3.5 h-3.5" /> Primary
                            </span>
                          )}
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
          </div>

          {/* RIGHT COLUMN: Your Active Identity & Details */}
          <div className="lg:col-span-5 space-y-6">
            {/* Primary Identity Manager */}
            {ownedLabel ? (
              <motion.div
                variants={itemVariants}
                className="glass-card rounded-3xl border border-accent/20 p-6 md:p-8 flex flex-col justify-between gap-6 relative overflow-hidden"
              >
                {/* Accent glow behind name badge */}
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-accent/5 blur-2xl pointer-events-none" />

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[4px] text-[10px] font-bold tracking-wider uppercase border border-accent/40 bg-accent/10 text-accent">
                      <Star className="w-3 h-3" /> primary
                    </span>
                    {ownedDomains.length > 1 && (
                      <span className="text-[10px] font-mono text-ink-faint">
                        {ownedDomains.length} names
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-mono text-display-sm text-ink break-all">{ownedDisplayName}</h3>
                    {ownedExpirySec > 0 ? (
                      <p className="text-body-sm text-ink-muted">
                        {isOwnedExpired ? (
                          <span className="text-status-error font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4 shrink-0" /> Expired — renew to keep this identity.
                          </span>
                        ) : (
                          <>
                            Expires{' '}
                            <span className="font-mono text-ink font-semibold">
                              {new Date(ownedExpirySec * 1000).toLocaleDateString(undefined, {
                                dateStyle: 'medium',
                              })}
                            </span>
                          </>
                        )}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex gap-3 w-full mt-2 shrink-0">
                  {isWithinRenewalWindow && (
                    <button
                      type="button"
                      onClick={handleRenew}
                      disabled={isRenewing || isRenewQuoteLoading}
                      className="btn-primary py-2.5 px-6 disabled:opacity-60 text-body-sm flex-1 font-semibold"
                    >
                      {isRenewing
                        ? 'Renewing…'
                        : `Renew (${formatEther(renewPrice)} ETH)`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleRelease}
                    disabled={isReleasing}
                    className="btn-secondary py-2.5 px-6 disabled:opacity-60 text-body-sm flex-1 font-semibold"
                  >
                    {isReleasing ? 'Releasing…' : 'Release'}
                  </button>
                </div>
              </motion.div>
            ) : null}

            {/* All Owned Names List (shown when user has more than 1) */}
            {ownedDomains.length > 1 && (
              <motion.div
                variants={itemVariants}
                className="glass-card rounded-3xl border border-border p-5 space-y-3"
              >
                <p className="text-xs font-mono text-ink-muted font-semibold tracking-wider uppercase">
                  All your names
                </p>
                <div className="space-y-1">
                  {ownedDomains.map((d) => {
                    const isPrimary = d.label === ownedLabel;
                    const expirySec = Number(d.expiry);
                    return (
                      <div
                        key={d.node}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${isPrimary
                          ? 'border-accent/30 bg-accent/5'
                          : 'border-transparent hover:border-border/40 hover:bg-canvas/40'
                          }`}
                      >
                        <div className="min-w-0">
                          <span className="font-mono text-body-sm text-ink truncate block">
                            {d.label || '…'}<span className="text-ink-faint">.rise</span>
                          </span>
                          {expirySec > 0 && (
                            <span className="text-[10px] text-ink-faint font-mono">
                              exp {new Date(expirySec * 1000).toLocaleDateString(undefined, { dateStyle: 'short' })}
                            </span>
                          )}
                        </div>
                        {isPrimary ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase border border-accent/40 bg-accent/10 text-accent shrink-0 ml-2">
                            <Star className="w-2.5 h-2.5" /> primary
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => d.label && handleSetPrimary(d.label)}
                            disabled={!d.label}
                            className="shrink-0 ml-2 text-[10px] font-semibold text-ink-muted hover:text-accent disabled:opacity-40 transition-colors px-2 py-1 rounded-lg hover:bg-canvas/60"
                          >
                            Set primary
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </div>
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
