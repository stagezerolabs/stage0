import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  useLaunchpadPresales,
  type LaunchpadPresaleFilter,
} from '@/lib/hooks/useLaunchpadPresales';
import { formatEther, formatUnits } from 'viem';
import { NFT_COLLECTION_IMAGES } from '@/config';
import { useNFTDeployments } from '@/lib/hooks/useNFTDeployments';
import PhaseCountdown from '@/components/ui/PhaseCountdown';
import { resolveNFTSaleCountdown } from '@/lib/utils/nft-sales';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  Image,
  Shield,
} from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.28,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

type TabFilter = 'all' | 'live' | 'upcoming' | 'ended';
type LaunchTypeFilter = 'all' | 'token' | 'nft';

const tabs: { label: string; value: TabFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Live', value: 'live' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Ended', value: 'ended' },
];

const launchTypeTabs: { label: string; value: LaunchTypeFilter }[] = [
  { label: 'All Launches', value: 'all' },
  { label: 'Token Presales', value: 'token' },
  { label: 'NFT Deployments', value: 'nft' },
];

function getStatusBadge(status: string) {
  switch (status) {
    case 'live':
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-status-live-bg text-status-live">
          <span className="w-1.5 h-1.5 rounded-full bg-status-live animate-pulse" />
          Live
        </span>
      );
    case 'upcoming':
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-status-upcoming-bg text-status-upcoming">
          <Clock className="w-3 h-3" />
          Upcoming
        </span>
      );
    case 'ended':
    case 'finalized':
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-status-closed-bg text-status-closed">
          <CheckCircle2 className="w-3 h-3" />
          Ended
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-status-error-bg text-status-error">
          <XCircle className="w-3 h-3" />
          Cancelled
        </span>
      );
    default:
      return null;
  }
}

function formatCountdown(targetTime: bigint | undefined, nowSec: number): string {
  if (!targetTime || targetTime <= 0n) return '--';

  const diff = Number(targetTime) - nowSec;
  if (diff <= 0) return '00h 00m 00s';

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  if (days > 0) {
    return `${days}d ${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`;
  }

  return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds
    .toString()
    .padStart(2, '0')}s`;
}

const PresalesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [activeLaunchType, setActiveLaunchType] = useState<LaunchTypeFilter>('all');
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const filterMap: Record<TabFilter, LaunchpadPresaleFilter> = {
    all: 'all',
    live: 'live',
    upcoming: 'upcoming',
    ended: 'ended',
  };

  const { presales, isLoading: isPresalesLoading } = useLaunchpadPresales(filterMap[activeTab]);
  const { deployments: nftDeployments, isLoading: isNFTLoading } = useNFTDeployments();

  const filteredNFTDeployments = useMemo(() => {
    if (activeTab === 'all') return nftDeployments;
    if (activeTab === 'ended') return nftDeployments.filter((deployment) => deployment.status === 'ended');
    return nftDeployments.filter((deployment) => deployment.status === activeTab);
  }, [activeTab, nftDeployments]);

  const showTokenLaunches = activeLaunchType !== 'nft';
  const showNFTLaunches = activeLaunchType !== 'token';
  const visiblePresales = showTokenLaunches ? presales : [];
  const visibleNFTDeployments = showNFTLaunches ? filteredNFTDeployments : [];
  const isLoading = (showTokenLaunches && isPresalesLoading) || (showNFTLaunches && isNFTLoading);
  const hasLaunches = visiblePresales.length > 0 || visibleNFTDeployments.length > 0;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Header */}
      <motion.section variants={itemVariants} className="space-y-2">
        <h1 className="font-display text-display-lg text-ink">Launchpad</h1>
        <p className="text-body-lg text-ink-muted">
          Discover and participate in the latest token launches on Stage0.
        </p>
      </motion.section>

      {/* Filter Tabs */}
      <motion.section variants={itemVariants}>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.value
                  ? 'bg-accent text-accent-foreground shadow-glow-orange'
                  : 'bg-ink/5 text-ink-muted hover:bg-ink/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {launchTypeTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveLaunchType(tab.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeLaunchType === tab.value
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'bg-ink/5 text-ink-muted hover:bg-ink/10 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </motion.section>

      {/* Launches Grid */}
      <motion.section variants={itemVariants}>
        {isLoading && !hasLaunches ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-body text-ink-muted">Loading launches...</p>
          </div>
        ) : !hasLaunches ? (
          <div className="glass-card rounded-3xl p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-accent-muted text-accent mx-auto flex items-center justify-center">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="font-display text-display-sm text-ink">No Launches Found</h3>
            <p className="text-body text-ink-muted max-w-md mx-auto">
              {activeLaunchType === 'token'
                ? 'No token presales match this filter.'
                : activeLaunchType === 'nft'
                ? 'No NFT deployments match this filter.'
                : 'No token or NFT launches match the current filters.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visiblePresales.map((presale) => (
              <div key={presale.address}>
                <Link to={`/presales/${presale.address}`}>
                  <div className="project-card rounded-3xl p-6 space-y-4 h-full">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-display text-display-sm text-ink">
                          {presale.saleTokenSymbol || 'Unknown'}
                        </h3>
                        <p className="text-body-sm text-ink-muted">
                          {presale.saleTokenName || 'Token Sale'}
                        </p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent mt-1">
                          Token
                        </span>
                      </div>
                      {getStatusBadge(presale.status)}
                    </div>

                    {/* Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-body-sm">
                        <span className="text-ink-muted">Progress</span>
                        <span className="text-ink font-medium">{presale.progress}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-ink/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all duration-500"
                          style={{ width: `${presale.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Raised / Hard Cap */}
                    <div className="flex justify-between text-body-sm">
                      <div>
                        <p className="text-ink-muted">Raised</p>
                        <p className="text-ink font-medium">
                          {presale.totalRaised
                            ? formatUnits(presale.totalRaised, presale.paymentTokenDecimals ?? 18)
                            : '0'}{' '}
                          {presale.paymentTokenSymbol || ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-ink-muted">Hard Cap</p>
                        <p className="text-ink font-medium">
                          {presale.hardCap
                            ? formatUnits(presale.hardCap, presale.paymentTokenDecimals ?? 18)
                            : '0'}{' '}
                          {presale.paymentTokenSymbol || ''}
                        </p>
                      </div>
                    </div>

                    {/* Time Remaining */}
                    <div className="pt-2 border-t border-ink/5">
                      <div className="flex items-center gap-2 text-body-sm text-ink-muted">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {presale.status === 'upcoming'
                            ? presale.startTime
                              ? `Starts in ${formatCountdown(presale.startTime, nowSec)}`
                              : 'Start date TBD'
                            : presale.status === 'live'
                            ? presale.endTime
                              ? `Ends in ${formatCountdown(presale.endTime, nowSec)}`
                              : 'End date TBD'
                            : 'Ended'}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ))}

            {visibleNFTDeployments.map((deployment) => {
              const mintedPercent =
                deployment.maxSupply > 0n
                  ? Math.min(Number((deployment.totalMinted * 100n) / deployment.maxSupply), 100)
                  : 0;
              const collectionImage =
                deployment.metadataImage || NFT_COLLECTION_IMAGES[deployment.address.toLowerCase()];
              const saleCountdown = resolveNFTSaleCountdown({
                status: deployment.status,
                whitelistEnabled: deployment.whitelistEnabled,
                whitelistStart: deployment.whitelistStart,
                saleStart: deployment.saleStart,
                saleEnd: deployment.saleEnd,
                nowSec,
              });

              return (
                <div key={deployment.address}>
                  <Link to={`/nfts/${deployment.address}`} className="block h-full">
                    <div className="project-card rounded-3xl overflow-hidden space-y-0 h-full flex flex-col">
                      {/* Collection image */}
                      {collectionImage ? (
                        <img
                          src={collectionImage}
                          alt={deployment.name}
                          className="w-full h-36 object-cover"
                        />
                      ) : (
                        <div className="w-full h-36 flex items-center justify-center bg-ink/5">
                          <Image className="w-10 h-10 text-ink-faint" />
                        </div>
                      )}

                      <div className="p-6 space-y-4 flex-1 flex flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <h3 className="font-display text-display-sm text-ink">
                              {deployment.symbol || 'NFT'}
                            </h3>
                            <p className="text-body-sm text-ink-muted">{deployment.name}</p>
                            <p className="text-body-sm text-ink-faint line-clamp-2">
                              {deployment.metadataDescription || 'Onchain NFT collection.'}
                            </p>
                          </div>
                          {deployment.status === 'live' && deployment.salePhase === 'whitelist' ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-accent/10 text-accent whitespace-nowrap shrink-0 self-start">
                              <Shield className="w-3 h-3" />
                              Whitelist Live
                            </span>
                          ) : (
                            getStatusBadge(deployment.status)
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent-secondary/15 text-accent-secondary">
                            NFT
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-ink/10 text-ink-muted">
                            {deployment.is721A ? 'ERC721A' : 'ERC721'}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-body-sm">
                            <span className="text-ink-muted">Mint Progress</span>
                            <span className="text-ink font-medium">{mintedPercent}%</span>
                          </div>
                          <div className="w-full h-2.5 bg-ink/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full transition-all duration-500"
                              style={{ width: `${mintedPercent}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex justify-between text-body-sm">
                          <div>
                            <p className="text-ink-muted">Minted</p>
                            <p className="text-ink font-medium">
                              {deployment.totalMinted.toString()} / {deployment.maxSupply.toString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-ink-muted">Remaining</p>
                            <p className="text-ink font-medium">{deployment.remaining.toString()}</p>
                          </div>
                        </div>

                        <div className="rounded-2xl bg-accent/5 border border-accent/10 px-3 py-2 text-body-sm space-y-1.5">
                          <div className="flex justify-between gap-4">
                            <span className="text-ink-muted">Public Price</span>
                            <span className="font-medium text-ink">{formatEther(deployment.mintPrice)} ETH</span>
                          </div>
                          {deployment.whitelistEnabled && (
                            <div className="flex justify-between gap-4">
                              <span className="text-ink-muted">Whitelist Price</span>
                              <span className="font-medium text-ink">
                                {formatEther(deployment.whitelistPrice)} ETH
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-ink/5">
                          <PhaseCountdown
                            compact
                            label={saleCountdown.label}
                            targetTime={saleCountdown.targetTime}
                            nowSec={nowSec}
                            fallbackLabel={saleCountdown.fallbackLabel}
                            completedLabel={saleCountdown.completedLabel}
                            stoppedMessage={saleCountdown.stoppedMessage}
                          />
                        </div>

                        <div className="mt-auto pt-3 border-t border-ink/5">
                          <div className="btn-primary w-full text-center text-sm py-2">
                            {deployment.status === 'live'
                              ? 'Mint Now'
                              : deployment.status === 'upcoming'
                              ? 'View Collection'
                              : 'View Collection'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </motion.section>
    </motion.div>
  );
};

export default PresalesPage;
