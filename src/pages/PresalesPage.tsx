import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useLaunchpadPresales,
  type LaunchpadPresaleFilter,
} from '@/lib/hooks/useLaunchpadPresales';
import { formatEther, formatUnits } from 'viem';
import { NFT_COLLECTION_IMAGES } from '@/config';
import { useNFTDeployments } from '@/lib/hooks/useNFTDeployments';
import FallbackImage from '@/components/ui/fallback-image';
import { resolveNFTSaleCountdown } from '@/lib/utils/nft-sales';
import { ArrowRight, Loader2, Search } from 'lucide-react';

type StatusFilter = 'all' | 'live' | 'upcoming' | 'ended';
type TypeFilter = 'all' | 'token' | 'nft';
type SortKey = 'trending' | 'progress' | 'newest';
const COUNTDOWN_TICK_INTERVAL_MS = 1000;

function formatAmount(value: bigint | undefined, decimals: number): string {
  if (!value || value <= 0n) return '0';
  const formatted = formatUnits(value, decimals);
  if (!formatted.includes('.')) return formatted;
  return formatted.replace(/(\.\d{0,4})\d+/, '$1').replace(/\.?0+$/, '');
}

function formatCountdownSeconds(secs: number): string {
  if (secs <= 0) return '00h 00m';
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (days > 0) return `${days}d ${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`;
  const seconds = secs % 60;
  return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
}

type UnifiedLaunch = {
  key: string;
  to: string;
  type: 'token' | 'nft';
  status: 'live' | 'upcoming' | 'ended' | 'cancelled' | 'finalized';
  name: string;
  symbol: string;
  description: string;
  cover?: string;
  fallbackCover?: string;
  progress: number;
  priceLabel: string;
  capacityLabel: string;
  countdownLabel: string;
  countdownValue: string;
  countdownSeconds?: number;
  raisedLabel?: string;
  participantsLabel?: string;
  isFeaturable: boolean;
};

const PresalesPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('trending');
  const [query, setQuery] = useState('');
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, COUNTDOWN_TICK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const presaleFilter: LaunchpadPresaleFilter = statusFilter === 'all' ? 'all' : statusFilter;
  const { presales, isLoading: isPresalesLoading } = useLaunchpadPresales(presaleFilter);
  const { deployments: nftDeployments, isLoading: isNFTLoading } = useNFTDeployments();

  const filteredNFTDeployments = useMemo(() => {
    if (statusFilter === 'all') return nftDeployments;
    if (statusFilter === 'ended') return nftDeployments.filter((d) => d.status === 'ended');
    return nftDeployments.filter((d) => d.status === statusFilter);
  }, [statusFilter, nftDeployments]);

  const unifiedLaunches = useMemo<UnifiedLaunch[]>(() => {
    const tokenLaunches: UnifiedLaunch[] = (typeFilter !== 'nft' ? presales : []).map((p) => {
      const saleSymbol = p.saleTokenSymbol ?? 'TOKEN';
      const paymentSymbol = p.paymentTokenSymbol ?? 'ETH';
      const paymentDecimals = p.paymentTokenDecimals ?? 18;
      const progress = Math.min(Math.max(p.progress ?? 0, 0), 100);

      let countdownLabel = 'Status';
      let countdownValue = '—';
      let countdownSeconds: number | undefined;
      if (p.status === 'live') {
        countdownLabel = 'Ends in';
        const secs = Number(p.endTime) - nowSec;
        countdownSeconds = secs;
        countdownValue = secs > 0 ? formatCountdownSeconds(secs) : 'Closing';
      } else if (p.status === 'upcoming') {
        countdownLabel = 'Starts in';
        const secs = Number(p.startTime) - nowSec;
        countdownSeconds = secs;
        countdownValue = secs > 0 ? formatCountdownSeconds(secs) : 'Soon';
      } else if (p.status === 'ended' || p.status === 'finalized') {
        countdownLabel = 'Status';
        countdownValue = 'Ended';
      } else if (p.status === 'cancelled') {
        countdownLabel = 'Status';
        countdownValue = 'Cancelled';
      }

      return {
        key: `t-${p.address}`,
        to: `/presales/${p.address}`,
        type: 'token',
        status: p.status as UnifiedLaunch['status'],
        name: p.saleTokenName ?? saleSymbol,
        symbol: saleSymbol,
        description: 'Onchain token launch — audited contracts and transparent vesting.',
        cover: p.logo,
        progress,
        priceLabel: `1 ${paymentSymbol} = ${formatRate(p.rate)} ${saleSymbol}`,
        capacityLabel: `${formatAmount(p.totalRaised, paymentDecimals)} / ${formatAmount(p.hardCap, paymentDecimals)} ${paymentSymbol}`,
        countdownLabel,
        countdownValue,
        countdownSeconds,
        raisedLabel: `${formatAmount(p.totalRaised, paymentDecimals)} ${paymentSymbol}`,
        isFeaturable: p.status === 'live',
      };
    });

    const nftLaunches: UnifiedLaunch[] = (typeFilter !== 'token' ? filteredNFTDeployments : []).map((d) => {
      const mintedPercent =
        d.maxSupply > 0n
          ? Math.min(Number((d.totalMinted * 100n) / d.maxSupply), 100)
          : 0;
      const fallback = NFT_COLLECTION_IMAGES[d.address.toLowerCase()];
      const saleCountdown = resolveNFTSaleCountdown({
        status: d.status,
        whitelistEnabled: d.whitelistEnabled,
        whitelistStart: d.whitelistStart,
        saleStart: d.saleStart,
        saleEnd: d.saleEnd,
        nowSec,
      });

      let countdownValue = '—';
      let countdownSeconds: number | undefined;
      if (saleCountdown.targetTime !== undefined) {
        const secs = Number(saleCountdown.targetTime) - nowSec;
        countdownSeconds = secs;
        countdownValue = secs > 0 ? formatCountdownSeconds(secs) : saleCountdown.completedLabel ?? '—';
      } else {
        countdownValue = saleCountdown.stoppedMessage ?? saleCountdown.fallbackLabel ?? saleCountdown.completedLabel ?? '—';
      }

      return {
        key: `n-${d.address}`,
        to: `/nfts/${d.address}`,
        type: 'nft',
        status: d.status as UnifiedLaunch['status'],
        name: d.name,
        symbol: d.symbol,
        description: d.metadataDescription || 'Onchain NFT collection.',
        cover: d.metadataImage,
        fallbackCover: fallback,
        progress: mintedPercent,
        priceLabel: `${formatEther(d.mintPrice)} ETH`,
        capacityLabel: `${d.totalMinted.toString()} / ${d.maxSupply.toString()} minted`,
        countdownLabel: saleCountdown.label ?? 'Status',
        countdownValue,
        countdownSeconds,
        participantsLabel: `${d.totalMinted.toString()} minted`,
        isFeaturable: d.status === 'live',
      };
    });

    let combined = [...tokenLaunches, ...nftLaunches];

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      combined = combined.filter((l) =>
        l.name.toLowerCase().includes(q) || l.symbol.toLowerCase().includes(q)
      );
    }

    if (sortKey === 'progress') {
      combined.sort((a, b) => b.progress - a.progress);
    } else if (sortKey === 'newest') {
      combined.sort((a, b) => {
        const aRank = a.status === 'upcoming' ? 0 : a.status === 'live' ? 1 : 2;
        const bRank = b.status === 'upcoming' ? 0 : b.status === 'live' ? 1 : 2;
        return aRank - bRank;
      });
    } else {
      combined.sort((a, b) => {
        const aRank = a.status === 'live' ? 0 : a.status === 'upcoming' ? 1 : 2;
        const bRank = b.status === 'live' ? 0 : b.status === 'upcoming' ? 1 : 2;
        if (aRank !== bRank) return aRank - bRank;
        return b.progress - a.progress;
      });
    }

    return combined;
  }, [presales, filteredNFTDeployments, typeFilter, query, sortKey, nowSec]);

  const featured = useMemo(() => unifiedLaunches.find((l) => l.isFeaturable), [unifiedLaunches]);
  const others = useMemo(
    () => (featured ? unifiedLaunches.filter((l) => l.key !== featured.key) : unifiedLaunches),
    [unifiedLaunches, featured]
  );

  const totalLive = useMemo(
    () =>
      presales.filter((p) => p.status === 'live').length +
      nftDeployments.filter((d) => d.status === 'live').length,
    [presales, nftDeployments]
  );
  const totalUpcoming = useMemo(
    () =>
      presales.filter((p) => p.status === 'upcoming').length +
      nftDeployments.filter((d) => d.status === 'upcoming').length,
    [presales, nftDeployments]
  );
  const totalProjects = presales.length + nftDeployments.length;

  const isLoading = (typeFilter !== 'nft' && isPresalesLoading) || (typeFilter !== 'token' && isNFTLoading);
  const hasAnyResult = unifiedLaunches.length > 0;

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="eyebrow">Launchpad</div>
            <h1 className="ds-h1 mt-2">
              The launch layer for{' '}
              <span style={{ color: 'rgb(var(--color-accent))' }}>RISE</span>
            </h1>
            <p className="text-ink-muted mt-3 text-[15px] leading-relaxed">
              Discover and back the next generation of projects shipping on RISE. Audited contracts,
              transparent vesting, instant claims.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-x-8 gap-y-4 ml-auto">
            <HeroStat label="Live now" value={String(totalLive)} />
            <HeroStat label="Upcoming" value={String(totalUpcoming)} />
            <HeroStat label="Projects" value={String(totalProjects)} />
          </div>
        </div>
      </section>

      {/* Featured launch */}
      {featured && (
        <section>
          <div className="featured-hero">
            <div>
              <div className="featured-tag-row">
                <span className="pill pill-live">Featured · Live now</span>
                <span className={`pill ${featured.type === 'token' ? 'pill-token' : 'pill-nft'}`}>
                  {featured.type}
                </span>
              </div>
              <h2 className="font-display text-ink" style={{ fontSize: 'clamp(28px, 4vw, 40px)', lineHeight: 1.1, letterSpacing: '-0.015em', margin: 0 }}>
                {featured.name}
              </h2>
              <div className="font-mono text-accent mt-1">${featured.symbol}</div>
              <p className="text-ink-muted mt-3.5 text-[15px] leading-relaxed max-w-lg">
                {featured.description}
              </p>

              {featured.countdownSeconds !== undefined && featured.countdownSeconds > 0 && (
                <CountdownGrid seconds={featured.countdownSeconds} />
              )}

              <div className="flex gap-3 mt-5">
                <Link to={featured.to} className="btn-primary">
                  {featured.type === 'token' ? 'Contribute now' : 'Mint now'} <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
                <Link to={featured.to} className="btn-secondary">
                  View details
                </Link>
              </div>

              <div className="featured-stats">
                <div>
                  <div className="featured-stat-label">{featured.type === 'token' ? 'Raised' : 'Minted'}</div>
                  <div className="featured-stat-val">{featured.raisedLabel ?? featured.participantsLabel ?? '—'}</div>
                </div>
                <div>
                  <div className="featured-stat-label">{featured.type === 'token' ? 'Hard cap' : 'Supply'}</div>
                  <div className="featured-stat-val truncate">{featured.capacityLabel}</div>
                </div>
                <div>
                  <div className="featured-stat-label">Price</div>
                  <div className="featured-stat-val truncate">{featured.priceLabel}</div>
                </div>
              </div>
            </div>
            <div>
              <div className="featured-visual">
                <FallbackImage
                  src={featured.cover}
                  fallbackSrc={featured.fallbackCover}
                  alt={featured.name}
                  className="w-full h-full object-cover"
                  placeholder={
                    <div className="w-full h-full flex items-center justify-center font-display font-extrabold text-[120px] tracking-tighter" style={{ color: 'rgb(255 255 255 / 0.35)' }}>
                      {featured.name.slice(0, 1).toUpperCase()}
                    </div>
                  }
                />
              </div>
              <div className="mt-3.5">
                <div className="launch-progress-row">
                  <span>Progress</span>
                  <span className="font-mono font-bold text-ink">{featured.progress.toFixed(0)}%</span>
                </div>
                <div className="ds-progress">
                  <div className="ds-progress-fill" style={{ width: `${featured.progress}%` }} />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Filter bar */}
      <section>
        <div className="filter-bar">
          <Search className="w-4 h-4 text-ink-faint shrink-0" />
          <input
            className="search-input"
            placeholder="Search by project or symbol…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="chip-group">
            {(['all', 'live', 'upcoming', 'ended'] as StatusFilter[]).map((k) => (
              <button
                key={k}
                type="button"
                className={`chip ${statusFilter === k ? 'active' : ''}`}
                onClick={() => setStatusFilter(k)}
              >
                {k === 'all' ? 'All' : k.charAt(0).toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
          <div className="chip-group">
            {(['all', 'token', 'nft'] as TypeFilter[]).map((k) => (
              <button
                key={k}
                type="button"
                className={`chip ${typeFilter === k ? 'active-secondary' : ''}`}
                onClick={() => setTypeFilter(k)}
              >
                {k === 'all' ? 'All types' : k === 'token' ? 'Tokens' : 'NFTs'}
              </button>
            ))}
          </div>
          <select
            className="sort-dropdown"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="trending">Sort · Trending</option>
            <option value="progress">Sort · Progress</option>
            <option value="newest">Sort · Newest</option>
          </select>
        </div>
      </section>

      {/* Launch grid */}
      <section>
        {isLoading && !hasAnyResult ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-7 h-7 text-accent animate-spin" />
            <p className="text-body text-ink-muted">Loading launches…</p>
          </div>
        ) : !hasAnyResult ? (
          <div className="bg-canvas-alt border border-border rounded-3xl p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 text-accent mx-auto flex items-center justify-center">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="font-display text-display-sm text-ink mt-4">No launches match your filters</h3>
            <p className="text-body text-ink-muted mt-2 max-w-md mx-auto">
              Try clearing search, switching status, or browsing all launch types.
            </p>
          </div>
        ) : (
          <div className="launch-grid">
            {others.map((l) => (
              <LaunchCard key={l.key} launch={l} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const HeroStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="eyebrow">{label}</div>
    <div className="font-display font-bold mt-1.5 text-ink" style={{ fontSize: 28, letterSpacing: '-0.01em' }}>
      {value}
    </div>
  </div>
);

function formatRate(rate: bigint | undefined): string {
  if (!rate || rate <= 0n) return '—';
  const whole = rate / 100n;
  const fractional = rate % 100n;
  if (fractional === 0n) return whole.toString();
  return `${whole.toString()}.${fractional.toString().padStart(2, '0').replace(/0+$/, '')}`;
}

const CountdownGrid: React.FC<{ seconds: number }> = ({ seconds }) => {
  const safe = Math.max(0, seconds);
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const cells: [string, string][] = [
    [days.toString().padStart(2, '0'), 'Days'],
    [hours.toString().padStart(2, '0'), 'Hours'],
    [minutes.toString().padStart(2, '0'), 'Min'],
    [secs.toString().padStart(2, '0'), 'Sec'],
  ];
  return (
    <div className="countdown-grid">
      {cells.map(([n, l]) => (
        <div key={l} className="countdown-cell">
          <div className="countdown-num">{n}</div>
          <div className="countdown-lbl">{l}</div>
        </div>
      ))}
    </div>
  );
};

const LaunchCard: React.FC<{ launch: UnifiedLaunch }> = ({ launch }) => {
  const isUpcoming = launch.status === 'upcoming';
  const isEnded = launch.status === 'ended' || launch.status === 'finalized';
  const isCancelled = launch.status === 'cancelled';
  const statusPillKind = isCancelled
    ? 'ended'
    : launch.status === 'live'
      ? 'live'
      : isUpcoming
        ? 'upcoming'
        : 'ended';
  const statusLabel = isCancelled
    ? 'Cancelled'
    : launch.status === 'live'
      ? 'Live'
      : isUpcoming
        ? 'Upcoming'
        : 'Ended';

  const ctaLabel = isCancelled
    ? 'View'
    : isEnded
      ? 'View results'
      : isUpcoming
        ? launch.type === 'token'
          ? 'Get whitelisted'
          : 'View collection'
        : launch.type === 'token'
          ? 'Contribute'
          : 'Mint now';

  const ctaClass = isEnded || isCancelled ? 'btn-ghost' : isUpcoming ? 'btn-secondary' : 'btn-primary';

  return (
    <Link to={launch.to} className="launch-card">
      <div className="launch-cover">
        <FallbackImage
          src={launch.cover}
          fallbackSrc={launch.fallbackCover}
          alt={launch.name}
          className="w-full h-full object-cover"
          placeholder={
            <div className="launch-cover-fallback">
              {launch.name.slice(0, 1).toUpperCase()}
            </div>
          }
        />
        <span className={`pill pill-${statusPillKind}`}>{statusLabel}</span>
        <span className={`pill ${launch.type === 'token' ? 'pill-token' : 'pill-nft'}`}>
          {launch.type}
        </span>
      </div>
      <div className="launch-body">
        <div className="launch-title-row">
          <div className="min-w-0">
            <div className="launch-title truncate">{launch.name}</div>
            <div className="launch-symbol">${launch.symbol}</div>
          </div>
        </div>
        <div className="launch-desc">{launch.description}</div>

        {(launch.status === 'live' || isEnded) && (
          <div>
            <div className="launch-progress-row">
              <span>{isEnded ? 'Final' : 'Raised'}</span>
              <span className="font-mono font-bold text-ink">{launch.progress.toFixed(0)}%</span>
            </div>
            <div className="ds-progress">
              <div className="ds-progress-fill" style={{ width: `${launch.progress}%` }} />
            </div>
          </div>
        )}

        <div className="launch-stats">
          <div>
            <div className="launch-stat-lbl">Price</div>
            <div className="launch-stat-val">{launch.priceLabel}</div>
          </div>
          <div>
            <div className="launch-stat-lbl">{launch.type === 'token' ? 'Raised / Cap' : 'Supply'}</div>
            <div className="launch-stat-val">{launch.capacityLabel}</div>
          </div>
        </div>

        <div className="launch-countdown">
          <span className="launch-countdown-lbl">{launch.countdownLabel}</span>
          <span className="font-bold">{launch.countdownValue}</span>
        </div>

        <div className={`${ctaClass} launch-cta`}>
          {ctaLabel} {!isEnded && !isCancelled && <ArrowRight className="w-3.5 h-3.5 ml-1" />}
        </div>
      </div>
    </Link>
  );
};

export default PresalesPage;
