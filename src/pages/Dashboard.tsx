import { Badge } from '@/components/ui/badge';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import FallbackImage from '@/components/ui/fallback-image';
import {
  LaunchpadPresaleContract,
  NFT_COLLECTION_IMAGES,
  StakingContract,
  erc20Abi,
  getNativeTokenLabel,
  getStakingContractAddress,
} from '@/config';
import { useLaunchpadPresales } from '@/lib/hooks/useLaunchpadPresales';
import { useNFTDeployments } from '@/lib/hooks/useNFTDeployments';
import { useOffchainTokenImages } from '@/lib/hooks/useOffchainProjectImages';
import { useUserNFTHoldings } from '@/lib/hooks/useUserNFTHoldings';
import { useUserDomain } from '@/lib/hooks/useUserDomain';
import { useRnsOwnedLabel } from '@/lib/hooks/rns/useRnsOwnedLabel';
import { getPrimaryLabel, setPrimaryLabel } from '@/lib/rns/primary-label';
import { useUserTokens } from '@/lib/hooks/useUserTokens';
import { useAllLocks } from '@/lib/hooks/useAllLocks';
import { useIsAdmin } from '@/lib/utils/admin';
import {
  ArrowRight,
  Globe,
  Image as ImageIcon,
  Layers,
  Lock,
  Package,
  Star,
  Wallet,
} from '@/components/ui/icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatUnits, zeroAddress, type Address } from 'viem';
import { useAccount, useBalance, useChainId, useReadContracts } from 'wagmi';

const COUNTDOWN_TICK_INTERVAL_MS = 1000;
const DASHBOARD_QUERY_STALE_TIME = 15000;
const DASHBOARD_QUERY_GC_TIME = 5 * 60 * 1000;

const ConnectWalletPlaceholder: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center text-center py-12 bg-canvas-alt rounded-3xl border border-border">
    <div className="w-16 h-16 rounded-full bg-canvas flex items-center justify-center mb-4">
      <Wallet className="w-6 h-6 text-ink-muted" />
    </div>
    <h3 className="font-display text-display-sm text-ink mb-2">Connect your wallet</h3>
    <p className="text-body text-ink-muted max-w-xs">{message}</p>
  </div>
);

function formatCountdownFromSeconds(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00h 00m 00s';

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`;
  }

  return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds
    .toString()
    .padStart(2, '0')}s`;
}

function formatLockAmount(amount: string): string {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed)) return amount;
  return parsed.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function shortenAddress(addr?: string): string {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface DashboardLockItem {
  id: bigint;
  tokenSymbol: string;
  formattedAmount: string;
  unlockDate: bigint;
  withdrawn: boolean;
  name: string;
}

const Dashboard: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { displayName: domainDisplayName } = useUserDomain(address);
  const {
    allDomains: ownedDomains,
    isLoading: isDomainsLoading,
  } = useRnsOwnedLabel(address);
  const { isAdmin } = useIsAdmin(address as Address | undefined);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  // Which label the user has chosen as their primary identity.
  // Initialise from localStorage; updates trigger a re-render via state.
  const [primaryLabel, setPrimaryLabelState] = useState<string | null>(() =>
    address ? getPrimaryLabel(address) : null,
  );

  const handleSetPrimary = useCallback(
    (label: string) => {
      if (!address) return;
      setPrimaryLabel(address, label);
      setPrimaryLabelState(label);
    },
    [address],
  );
  const safeAddress = (address ?? zeroAddress) as Address;
  const chainId = useChainId();
  const nativeToken = getNativeTokenLabel(chainId);
  const stakingAddress = getStakingContractAddress(chainId);

  const { data: balance, isLoading: isBalanceLoading } = useBalance({
    address: safeAddress,
    query: {
      enabled: Boolean(address),
      staleTime: DASHBOARD_QUERY_STALE_TIME,
      gcTime: DASHBOARD_QUERY_GC_TIME,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  });

  const { presales, isLoading: isPresalesLoading } = useLaunchpadPresales('all');
  const { tokens: createdTokens, isLoading: isTokensLoading } = useUserTokens();
  const { data: tokenImages = {} } = useOffchainTokenImages(chainId, createdTokens, createdTokens.length > 0);
  const {
    deployments: myNFTDeployments,
  } = useNFTDeployments({
    creator: address as Address | undefined,
    enabled: isConnected && Boolean(address),
  });
  const {
    holdings: myNftHoldings,
    totalOwned: totalOwnedNFTs,
    isLoading: isNftHoldingsLoading,
  } = useUserNFTHoldings(address as Address | undefined, isConnected && Boolean(address));
  const { locks: rawLocks, isLoading: isLocksLoading } = useAllLocks();

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, COUNTDOWN_TICK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  // ownedDomains already has labels resolved from resolver text records (on-chain).
  // No localStorage or pending-registration merging needed.
  const domainsToDisplay = ownedDomains;

  const { data: stakingTokenData } = useReadContracts({
    contracts: [
      { address: stakingAddress, abi: StakingContract, functionName: 'stakingToken' },
    ],
    query: {
      enabled: stakingAddress !== zeroAddress,
      staleTime: DASHBOARD_QUERY_STALE_TIME,
      gcTime: DASHBOARD_QUERY_GC_TIME,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  });

  const stakingToken = stakingTokenData?.[0]?.result as Address | undefined;

  const { data: stakingData, isLoading: isStakingLoading } = useReadContracts({
    contracts: stakingToken && address
      ? ([
        { address: stakingToken, abi: erc20Abi, functionName: 'symbol' },
        { address: stakingToken, abi: erc20Abi, functionName: 'decimals' },
        { address: stakingAddress, abi: StakingContract, functionName: 'balanceOf', args: [safeAddress] },
        { address: stakingAddress, abi: StakingContract, functionName: 'pendingRewards', args: [safeAddress] },
      ] as const)
      : [],
    query: {
      enabled: Boolean(stakingToken && address),
      staleTime: DASHBOARD_QUERY_STALE_TIME,
      gcTime: DASHBOARD_QUERY_GC_TIME,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  });

  const stakingSymbol = (stakingData?.[0]?.result as string | undefined) ?? nativeToken;
  const stakingDecimalsRaw = stakingData?.[1]?.result as number | bigint | undefined;
  const stakingDecimals = typeof stakingDecimalsRaw === 'number'
    ? stakingDecimalsRaw
    : Number(stakingDecimalsRaw ?? 18);
  const stakedBalance = (stakingData?.[2]?.result as bigint | undefined) ?? 0n;
  const pendingRewards = (stakingData?.[3]?.result as bigint | undefined) ?? 0n;
  const hasStakedAllocation = stakedBalance > 0n || pendingRewards > 0n;

  const contributionQueries = useMemo(() => {
    if (!address || presales.length === 0) return [];
    return presales.flatMap((presale) => [
      {
        abi: LaunchpadPresaleContract,
        address: presale.address,
        functionName: 'contributions',
        args: [address],
      },
      {
        abi: LaunchpadPresaleContract,
        address: presale.address,
        functionName: 'purchasedTokens',
        args: [address],
      },
    ] as const);
  }, [address, presales]);

  const { data: contributionResults, isLoading: isContributionsLoading } = useReadContracts({
    contracts: contributionQueries,
    query: {
      enabled: contributionQueries.length > 0,
      staleTime: DASHBOARD_QUERY_STALE_TIME,
      gcTime: DASHBOARD_QUERY_GC_TIME,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  });

  const allocations = useMemo(() => {
    if (!address || presales.length === 0 || !contributionResults) return [];

    const results: Array<{
      presale: typeof presales[number];
      contribution: bigint;
      purchasedTokens: bigint;
    }> = [];

    for (let i = 0; i < presales.length; i += 1) {
      const contribution = (contributionResults[i * 2]?.result ?? 0n) as bigint;
      const purchasedTokens = (contributionResults[i * 2 + 1]?.result ?? 0n) as bigint;

      if (contribution > 0n || purchasedTokens > 0n) {
        results.push({ presale: presales[i], contribution, purchasedTokens });
      }
    }

    return results;
  }, [address, presales, contributionResults]);

  const nftPurchaseAllocations = useMemo(
    () => myNftHoldings.filter((holding) => holding.mintedCount > 0n),
    [myNftHoldings]
  );

  const tokenMetaQueries = useMemo(() => {
    if (createdTokens.length === 0) return [];
    return createdTokens.flatMap((token) => [
      { abi: erc20Abi, address: token, functionName: 'symbol' },
      { abi: erc20Abi, address: token, functionName: 'name' },
    ] as const);
  }, [createdTokens]);

  const { data: tokenMetaResults } = useReadContracts({
    contracts: tokenMetaQueries,
    query: {
      enabled: tokenMetaQueries.length > 0,
      staleTime: DASHBOARD_QUERY_STALE_TIME,
      gcTime: DASHBOARD_QUERY_GC_TIME,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  });

  const createdTokenList = useMemo(() => {
    if (createdTokens.length === 0) return [];

    return createdTokens.map((token, index) => {
      const symbol = tokenMetaResults?.[index * 2]?.result as string | undefined;
      const name = tokenMetaResults?.[index * 2 + 1]?.result as string | undefined;

      return {
        address: token,
        symbol: symbol ?? 'TOKEN',
        name: name ?? 'Token',
        imageUrl: tokenImages[token.toLowerCase()]?.imageUrl,
      };
    });
  }, [createdTokens, tokenMetaResults, tokenImages]);

  const createdPresales = useMemo(() => {
    if (!address) return [];
    return presales.filter((presale) => presale.owner?.toLowerCase() === address.toLowerCase());
  }, [address, presales]);

  const myLocks = useMemo(() => {
    const normalizedLocks = (rawLocks ?? []) as DashboardLockItem[];
    return [...normalizedLocks].sort((a, b) => {
      if (a.withdrawn !== b.withdrawn) return a.withdrawn ? 1 : -1;
      return Number(a.unlockDate) - Number(b.unlockDate);
    });
  }, [rawLocks]);

  const balanceDisplay = balance
    ? `${Number(balance.formatted).toLocaleString(undefined, { maximumFractionDigits: 4 })}`
    : '0';
  const balanceSymbol = balance?.symbol ?? nativeToken;

  const totalAllocations = allocations.length + nftPurchaseAllocations.length + (hasStakedAllocation ? 1 : 0);
  const unlockedLocks = myLocks.filter((lock) => !lock.withdrawn && Number(lock.unlockDate) <= nowSec).length;
  const createdAssetsCount = createdTokenList.length + createdPresales.length + myNFTDeployments.length;

  return (
    <div className="flex flex-col gap-10">
      {/* Wallet hero */}
      <section>
        <div className="wallet-header">
          <div>
            <div className="wallet-greeting">
              {isConnected ? 'Welcome back' : 'Hello, guest'}
            </div>
            <div className="wallet-addr">
              {isConnected
                ? (domainDisplayName ?? shortenAddress(address))
                : 'Connect wallet to begin'}
            </div>
            <div className="wallet-portfolio">
              <div className="wallet-portfolio-val">
                {isConnected
                  ? (isBalanceLoading ? '—' : balanceDisplay)
                  : '0.00'}
              </div>
              <div className="font-mono text-ink-muted text-sm font-semibold">
                {balanceSymbol}
              </div>
              {isConnected && hasStakedAllocation && (
                <div className="wallet-portfolio-chg">
                  {Number(formatUnits(stakedBalance, stakingDecimals)).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{' '}
                  {stakingSymbol} staked
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="eyebrow">Native balance</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stat grid */}
      <section className="stat-grid">
        <StatTile
          label="Created assets"
          value={isConnected ? String(createdAssetsCount) : '0'}
          meta={
            isConnected
              ? `${createdTokenList.length} tokens · ${myNFTDeployments.length} NFT drops`
              : 'connect wallet'
          }
          icon={<Package className="w-4 h-4" />}
          tint="rgb(var(--color-accent) / 0.14)"
          tintSolid="rgb(var(--color-accent))"
        />
        <StatTile
          label="Allocations"
          value={isConnected ? String(totalAllocations) : '0'}
          meta={totalAllocations > 0 ? 'live positions' : 'no positions yet'}
          icon={<Layers className="w-4 h-4" />}
          tint="rgb(var(--color-accent-secondary) / 0.14)"
          tintSolid="rgb(var(--color-accent-secondary))"
        />
        <StatTile
          label="NFTs owned"
          value={isConnected ? totalOwnedNFTs.toString() : '0'}
          meta={`${myNFTDeployments.length} collection${myNFTDeployments.length === 1 ? '' : 's'} created`}
          icon={<ImageIcon className="w-4 h-4" />}
          tint="rgb(var(--color-accent-violet) / 0.16)"
          tintSolid="rgb(var(--color-accent-violet))"
        />
        <StatTile
          label="Token locks"
          value={isConnected ? String(myLocks.length) : '0'}
          meta={unlockedLocks > 0 ? `${unlockedLocks} unlockable now` : 'all locked'}
          icon={<Lock className="w-4 h-4" />}
          tint="rgb(var(--color-accent-sky) / 0.16)"
          tintSolid="rgb(var(--color-accent-sky))"
        />
      </section>

      {/* Identity + Builder carousel */}
      <section className="order-4 space-y-6">
        <div className="section-head">
          <div>
            <div className="eyebrow">Builder</div>
            <h2 className="ds-h2 mt-1.5">My creations</h2>
          </div>
        </div>

        {!isConnected ? (
          <ConnectWalletPlaceholder message="Connect your wallet to manage names, created tokens, launches, and locks." />
        ) : (
          <DashboardCarousel>
            <CreationCard
              eyebrow="ERC-20"
              title="Created tokens"
              count={isTokensLoading ? '…' : String(createdTokenList.length)}
              accent="rgb(var(--color-accent))"
              empty={
                isTokensLoading && createdTokenList.length === 0
                  ? 'Loading tokens…'
                  : createdTokenList.length === 0
                    ? "You haven't deployed a token yet."
                    : null
              }
              cta={{
                label: createdTokenList.length > 0 ? 'Manage tokens' : 'Create token',
                to: createdTokenList.length > 0 ? '/tokens' : isAdmin ? '/create/token' : '/tools',
              }}
            >
              {createdTokenList.slice(0, 5).map((token) => (
                <Link
                  key={token.address}
                  to="/tokens"
                  className="group flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-b-0 hover:text-accent transition-colors"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 rounded-md overflow-hidden bg-accent/10 flex items-center justify-center shrink-0">
                      <FallbackImage
                        src={token.imageUrl}
                        alt={`${token.symbol} token image`}
                        className="w-full h-full object-cover"
                        placeholder={
                          <span className="font-mono text-[11px] font-bold uppercase text-accent">
                            {token.symbol.slice(0, 2)}
                          </span>
                        }
                      />
                    </span>
                    <span className="font-medium text-[13px] text-ink truncate">{token.symbol}</span>
                  </span>
                  <span className="font-mono text-[11px] text-ink-faint shrink-0">
                    {shortenAddress(token.address)}
                  </span>
                </Link>
              ))}
            </CreationCard>

            <CreationCard
              eyebrow="Presales"
              title="Created launches"
              count={isPresalesLoading ? '…' : String(createdPresales.length)}
              accent="rgb(var(--color-accent-secondary))"
              empty={
                isPresalesLoading && createdPresales.length === 0
                  ? 'Loading launches…'
                  : createdPresales.length === 0
                    ? 'Launch your next presale or manage existing ones.'
                    : null
              }
              cta={{
                label: createdPresales.length > 0 ? 'Create another' : 'Create launch',
                to: isAdmin ? '/create/presale' : '/tools',
              }}
            >
              {createdPresales.slice(0, 5).map((presale) => {
                const statusVariant =
                  presale.status === 'live'
                    ? 'live'
                    : presale.status === 'upcoming'
                      ? 'upcoming'
                      : 'closed';
                const symbol = presale.saleTokenSymbol ?? 'TKN';
                return (
                  <Link
                    key={presale.address}
                    to={`/presales/manage/${presale.address}`}
                    className="group flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-b-0 hover:text-accent transition-colors"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-7 h-7 rounded-md flex items-center justify-center font-mono text-[11px] font-bold uppercase shrink-0"
                        style={{
                          background: 'rgb(var(--color-accent-secondary) / 0.14)',
                          color: 'rgb(var(--color-accent-secondary))',
                        }}
                      >
                        {symbol.slice(0, 2)}
                      </span>
                      <span className="font-medium text-[13px] text-ink truncate">{symbol}</span>
                    </span>
                    <Badge variant={statusVariant}>{presale.status}</Badge>
                  </Link>
                );
              })}
            </CreationCard>

            <CreationCard
              eyebrow="Timelock"
              title="Token locks"
              count={isLocksLoading ? '…' : String(myLocks.length)}
              accent="rgb(var(--color-accent-violet))"
              empty={
                isLocksLoading && myLocks.length === 0
                  ? 'Loading locks…'
                  : myLocks.length === 0
                    ? 'No token locks yet.'
                    : null
              }
              cta={{
                label: myLocks.length > 0 ? 'Manage locks' : 'Create lock',
                to: isAdmin ? '/tools/token-locker' : '/tools',
              }}
            >
              {myLocks.slice(0, 5).map((lock) => {
                const secondsUntilUnlock = Number(lock.unlockDate) - nowSec;
                const isUnlockable = !lock.withdrawn && secondsUntilUnlock <= 0;
                const timerLabel = lock.withdrawn
                  ? 'Withdrawn'
                  : isUnlockable
                    ? 'Ready'
                    : formatCountdownFromSeconds(secondsUntilUnlock);

                return (
                  <Link
                    key={lock.id.toString()}
                    to={`/locks/${lock.id.toString()}`}
                    className="group flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-b-0 hover:text-accent transition-colors"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-[13px] text-ink">
                        {lock.name?.trim() ? lock.name : `Lock #${lock.id.toString()}`}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-ink-muted mt-0.5">
                        {formatLockAmount(lock.formattedAmount)} {lock.tokenSymbol}
                      </span>
                    </span>
                    <span
                      className={`font-mono text-[11px] whitespace-nowrap uppercase tracking-wider shrink-0 ${lock.withdrawn
                        ? 'text-ink-faint'
                        : isUnlockable
                          ? 'text-status-live'
                          : 'text-status-upcoming'
                        }`}
                    >
                      {timerLabel}
                    </span>
                  </Link>
                );
              })}
            </CreationCard>

            <CreationCard
              eyebrow="Identity"
              title="My Names"
              count={isDomainsLoading ? '…' : String(domainsToDisplay.length)}
              accent="rgb(var(--color-accent-sky))"
              empty={
                isDomainsLoading && domainsToDisplay.length === 0
                  ? 'Loading names…'
                  : domainsToDisplay.length === 0
                    ? "You don't own any .rise names yet."
                    : null
              }
              cta={{
                label: domainsToDisplay.length > 0 ? 'Manage names' : 'Register a name',
                to: '/domains',
              }}
            >
              {domainsToDisplay.slice(0, 5).map((domain) => {
                const label = domain.label || '';
                const effectivePrimary = primaryLabel ?? (domainsToDisplay[0].label || '');
                const isPrimary = label !== '' && label === effectivePrimary;
                const expiryDate = domain.expiry
                  ? new Date(Number(domain.expiry) * 1000).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                  : '—';

                return (
                  <div
                    key={domain.node}
                    className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-b-0"
                  >
                    <Link
                      to={`/domains?q=${label}`}
                      className="flex items-center gap-3 min-w-0 flex-1 hover:text-accent transition-colors"
                    >
                      <span
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                        style={{ background: 'rgb(var(--color-accent-sky) / 0.14)' }}
                      >
                        <Globe className="w-3.5 h-3.5" style={{ color: 'rgb(var(--color-accent-sky))' }} />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium text-[13px] text-ink truncate">
                          {label || <span className="text-ink-muted font-mono text-[12px]">{domain.node.slice(0, 10)}…</span>}
                          {label && <span className="text-ink-muted">.rise</span>}
                        </span>
                        <span className="block font-mono text-[11px] text-ink-muted mt-0.5">
                          Expires {expiryDate}
                        </span>
                      </span>
                    </Link>
                    {!isPrimary && label ? (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(label)}
                        className="text-[11px] font-medium text-ink-muted hover:text-accent transition-colors shrink-0 flex items-center gap-1"
                        title={`Set ${label}.rise as primary identity`}
                      >
                        <Star className="w-3 h-3" />
                      </button>
                    ) : (
                      <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                        style={{ background: 'rgb(var(--color-accent-sky) / 0.14)', color: 'rgb(var(--color-accent-sky))' }}
                      >
                        <Star className="w-2.5 h-2.5" />
                        main
                      </span>
                    )}
                  </div>
                );
              })}
            </CreationCard>
          </DashboardCarousel>
        )}
      </section>

      {/* Allocations */}
      <section className="order-3">
        <div className="section-head">
          <div>
            <div className="eyebrow">My positions</div>
            <h2 className="ds-h2 mt-1.5">Allocations</h2>
          </div>
        </div>

        {!isConnected ? (
          <ConnectWalletPlaceholder message="Connect your wallet to view your launch allocations." />
        ) : allocations.length === 0 &&
          nftPurchaseAllocations.length === 0 &&
          !hasStakedAllocation &&
          !isPresalesLoading &&
          !isContributionsLoading &&
          !isNftHoldingsLoading ? (
          <div className="alloc-table">
            <div className="px-6 py-12 text-center text-ink-muted">
              <p>No allocations yet.</p>
              <Link to="/presales" className="btn-secondary btn-sm mt-4 inline-flex">
                Browse launchpad <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="alloc-table">
            <div className="alloc-row head">
              <div>Project</div>
              <div>Contributed</div>
              <div>Purchased / Held</div>
              <div>Type</div>
              <div>Status</div>
              <div style={{ textAlign: 'right' }}>Action</div>
            </div>
            {allocations.map(({ presale, contribution, purchasedTokens }) => {
              const paymentSymbol = presale.isPaymentETH
                ? nativeToken
                : presale.paymentTokenSymbol ?? 'TOKEN';
              const saleSymbol = presale.saleTokenSymbol ?? 'TOKEN';
              const contributionValue = formatUnits(contribution, presale.paymentTokenDecimals ?? 18);
              const purchasedValue = formatUnits(purchasedTokens, presale.saleTokenDecimals ?? 18);

              return (
                <Link key={presale.address} to={`/presales/${presale.address}`} className="alloc-row">
                  <div className="asset">
                    <div className="asset-icon">
                      {presale.logo ? (
                        <img src={presale.logo} alt={saleSymbol} />
                      ) : (
                        saleSymbol.slice(0, 1)
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="asset-name">{presale.saleTokenName ?? saleSymbol}</div>
                      <div className="asset-sym">${saleSymbol}</div>
                    </div>
                  </div>
                  <div className="alloc-cell-hide-mobile">
                    <div className="num">
                      {Number(contributionValue).toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
                      {paymentSymbol}
                    </div>
                    <div className="num-sub">at presale</div>
                  </div>
                  <div className="alloc-cell-hide-mobile">
                    <div className="num">
                      {Number(purchasedValue).toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
                      {saleSymbol}
                    </div>
                    <div className="num-sub">
                      {presale.status === 'live' ? 'pending' : 'available'}
                    </div>
                  </div>
                  <div className="alloc-cell-hide-mobile">
                    <span className="pill pill-token">Token</span>
                  </div>
                  <div className="alloc-cell-hide-mobile">
                    <Badge
                      variant={
                        presale.status === 'live'
                          ? 'live'
                          : presale.status === 'upcoming'
                            ? 'upcoming'
                            : 'closed'
                      }
                    >
                      {presale.status}
                    </Badge>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="btn-secondary btn-sm inline-flex">View</span>
                  </div>
                </Link>
              );
            })}

            {nftPurchaseAllocations.map((holding) => (
              <Link key={`nft-${holding.address}`} to={`/nfts/${holding.address}`} className="alloc-row">
                <div className="asset">
                  <div className="asset-icon">
                    <FallbackImage
                      src={holding.metadataImage}
                      fallbackSrc={NFT_COLLECTION_IMAGES[holding.address.toLowerCase()]}
                      alt={holding.name}
                      className="w-full h-full object-cover"
                      placeholder={<ImageIcon className="w-4 h-4 text-ink-muted" />}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="asset-name">{holding.name}</div>
                    <div className="asset-sym">${holding.symbol}</div>
                  </div>
                </div>
                <div className="alloc-cell-hide-mobile">
                  <div className="num">
                    {holding.mintedCount.toString()} NFT{holding.mintedCount === 1n ? '' : 's'}
                  </div>
                  <div className="num-sub">minted</div>
                </div>
                <div className="alloc-cell-hide-mobile">
                  <div className="num">{holding.ownedCount.toString()}</div>
                  <div className="num-sub">held</div>
                </div>
                <div className="alloc-cell-hide-mobile">
                  <span className="pill pill-nft">NFT</span>
                </div>
                <div className="alloc-cell-hide-mobile">
                  <Badge
                    variant={
                      holding.status === 'live'
                        ? 'live'
                        : holding.status === 'upcoming'
                          ? 'upcoming'
                          : 'closed'
                    }
                  >
                    {holding.status}
                  </Badge>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="btn-secondary btn-sm inline-flex">View</span>
                </div>
              </Link>
            ))}

            {hasStakedAllocation && !isStakingLoading && (
              <div className="alloc-row" style={{ background: 'rgb(var(--color-canvas) / 0.3)' }}>
                <div className="asset">
                  <div className="asset-icon">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="asset-name">Staked tokens</div>
                    <div className="asset-sym">${stakingSymbol}</div>
                  </div>
                </div>
                <div className="alloc-cell-hide-mobile">
                  <div className="num">
                    {Number(formatUnits(stakedBalance, stakingDecimals)).toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}{' '}
                    {stakingSymbol}
                  </div>
                  <div className="num-sub">staked</div>
                </div>
                <div className="alloc-cell-hide-mobile">
                  <div className="num">
                    {pendingRewards > 0n
                      ? Number(formatUnits(pendingRewards, stakingDecimals)).toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })
                      : '—'}
                  </div>
                  <div className="num-sub">rewards</div>
                </div>
                <div className="alloc-cell-hide-mobile">
                  <span className="pill pill-soon">Stake</span>
                </div>
                <div className="alloc-cell-hide-mobile">
                  <Badge variant="live">staked</Badge>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="text-[11px] uppercase tracking-wider text-ink-faint">Auto-compounding</span>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

    </div>
  );
};

type StatTileProps = {
  label: string;
  value: string;
  meta: string;
  icon: React.ReactNode;
  tint: string;
  tintSolid: string;
};

const StatTile: React.FC<StatTileProps> = ({ label, value, meta, icon, tint, tintSolid }) => (
  <div className="stat-tile" style={{ ['--stat-tint' as unknown as string]: tint }}>
    <div className="stat-tile-icon" style={{ background: tint, color: tintSolid }}>
      {icon}
    </div>
    <div className="stat-tile-label">{label}</div>
    <div className="stat-tile-value">{value}</div>
    <div className="stat-tile-meta">{meta}</div>
  </div>
);

const DashboardCarousel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Carousel
    opts={{
      align: 'start',
      slidesToScroll: 1,
    }}
    className="dashboard-carousel"
  >
    <CarouselContent>
      {React.Children.toArray(children).map((child, index) => (
        <CarouselItem key={index} className="basis-full md:basis-1/3">
          <div className="h-full">{child}</div>
        </CarouselItem>
      ))}
    </CarouselContent>
    <div className="mt-4 flex justify-end gap-2">
      <CarouselPrevious className="static translate-x-0 translate-y-0" />
      <CarouselNext className="static translate-x-0 translate-y-0" />
    </div>
  </Carousel>
);

type CreationCardProps = {
  eyebrow: string;
  title: string;
  count: string;
  accent: string;
  empty: string | null;
  cta: { label: string; to: string };
  children?: React.ReactNode;
};

const CreationCard: React.FC<CreationCardProps> = ({ eyebrow, title, count, accent, empty, cta, children }) => (
  <div className="relative bg-canvas-alt border border-border rounded-3xl p-5 flex h-full flex-col gap-4 overflow-hidden">
    <div
      aria-hidden
      className="absolute top-0 left-5 h-[3px] w-10 rounded-b-full"
      style={{ background: accent }}
    />
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div
          className="text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: accent }}
        >
          {eyebrow}
        </div>
        <h3 className="font-display font-bold text-[20px] text-ink leading-tight mt-1.5 tracking-tight">
          {title}
        </h3>
      </div>
      <span
        className="font-mono text-[12px] font-bold px-2.5 py-1 rounded-full shrink-0"
        style={{ background: 'rgb(var(--color-ink) / 0.06)', color: 'rgb(var(--color-ink))' }}
      >
        {count}
      </span>
    </div>

    {empty ? (
      <p className="text-[13px] text-ink-muted leading-relaxed">{empty}</p>
    ) : (
      <div className="flex flex-col max-h-44 overflow-auto no-scrollbar">{children}</div>
    )}

    <Link to={cta.to} className="btn-secondary btn-sm w-full mt-auto">
      {cta.label}
    </Link>
  </div>
);

export default Dashboard;
