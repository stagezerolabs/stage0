import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { formatUnits, isAddress, type Address } from 'viem';
import { toast } from 'sonner';
import { ArrowUpRight, Copy, Coins, Users, Settings, ExternalLink, Sparkles } from 'lucide-react';
import { useChainContracts } from '@/lib/hooks/useChainContracts';
import { useLaunchpadPresales } from '@/lib/hooks/useLaunchpadPresales';
import { useSetFeeRecipient, useSetNFTFactoryProceedsFeeBps } from '@/lib/hooks/useAdminActions';
import { useFactoryOwner, useFeeRecipient, useProceedsFeeBps } from '@/lib/utils/admin';
import { useUserNFTs } from '@/lib/hooks/useUserNFTs';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

const AdminDashboard: React.FC = () => {
  const { address } = useAccount();
  const { nftFactory, nftFactoryLens, explorerUrl } = useChainContracts();
  const { totalDeployments, isLoading: isLoadingNFTs } = useUserNFTs();
  const { factoryOwner, isLoading: isLoadingOwner } = useFactoryOwner('nft');
  const {
    feeRecipient,
    isLoading: isLoadingFeeRecipient,
    refetch: refetchFeeRecipient,
  } = useFeeRecipient('nft');
  const {
    proceedsFeeBps,
    isLoading: isLoadingProceedsFeeBps,
    refetch: refetchProceedsFeeBps,
  } = useProceedsFeeBps();
  const { presales, isLoading: isLoadingPresales } = useLaunchpadPresales('all');

  const [newFeeRecipient, setNewFeeRecipient] = useState('');
  const [newProceedsFeeBps, setNewProceedsFeeBps] = useState('');

  const {
    setFeeRecipient,
    isBusy: isUpdatingFeeRecipient,
    isSuccess: isFeeRecipientUpdateSuccess,
    isError: isFeeRecipientUpdateError,
    error: feeRecipientUpdateError,
    reset: resetFeeRecipientUpdate,
  } = useSetFeeRecipient('nft');
  const {
    setProceedsFeeBps,
    isBusy: isUpdatingProceedsFee,
    isSuccess: isProceedsFeeUpdateSuccess,
    isError: isProceedsFeeUpdateError,
    error: proceedsFeeUpdateError,
    reset: resetProceedsFeeUpdate,
  } = useSetNFTFactoryProceedsFeeBps();

  const totalPresales = presales?.length ?? 0;
  const livePresales = presales?.filter((p) => p.status === 'live').length ?? 0;
  const upcomingPresales = presales?.filter((p) => p.status === 'upcoming').length ?? 0;
  const endedPresales = presales?.filter((p) =>
    ['ended', 'finalized', 'cancelled'].includes(p.status)
  ).length ?? 0;

  const totalRaised = useMemo(() => {
    if (!presales || presales.length === 0) return '0';
    let sum = 0n;
    for (const p of presales) {
      sum += p.totalRaised ?? 0n;
    }
    return Number(formatUnits(sum, 18)).toLocaleString(undefined, { maximumFractionDigits: 4 });
  }, [presales]);

  const isOnChainOwner = useMemo(() => {
    if (!address || !factoryOwner) return false;
    return address.toLowerCase() === factoryOwner.toLowerCase();
  }, [address, factoryOwner]);

  useEffect(() => {
    if (isFeeRecipientUpdateSuccess) {
      toast.success('NFT factory fee recipient updated.');
      setNewFeeRecipient('');
      resetFeeRecipientUpdate();
      refetchFeeRecipient();
    }
  }, [isFeeRecipientUpdateSuccess, refetchFeeRecipient, resetFeeRecipientUpdate]);

  useEffect(() => {
    if (isFeeRecipientUpdateError) {
      toast.error(feeRecipientUpdateError?.message ?? 'Failed to update NFT fee recipient.');
      resetFeeRecipientUpdate();
    }
  }, [feeRecipientUpdateError, isFeeRecipientUpdateError, resetFeeRecipientUpdate]);

  useEffect(() => {
    if (isProceedsFeeUpdateSuccess) {
      toast.success('NFT factory proceeds fee updated.');
      setNewProceedsFeeBps('');
      resetProceedsFeeUpdate();
      refetchProceedsFeeBps();
    }
  }, [isProceedsFeeUpdateSuccess, refetchProceedsFeeBps, resetProceedsFeeUpdate]);

  useEffect(() => {
    if (isProceedsFeeUpdateError) {
      toast.error(proceedsFeeUpdateError?.message ?? 'Failed to update NFT proceeds fee.');
      resetProceedsFeeUpdate();
    }
  }, [isProceedsFeeUpdateError, proceedsFeeUpdateError, resetProceedsFeeUpdate]);

  const handleCopy = (value: string) => {
    if (!value) return;
    navigator.clipboard?.writeText(value);
    toast.success('Copied to clipboard.');
  };

  const handleSetFeeRecipient = () => {
    if (!newFeeRecipient || !isAddress(newFeeRecipient)) {
      toast.error('Enter a valid fee recipient address.');
      return;
    }
    setFeeRecipient(newFeeRecipient as Address);
  };

  const handleSetProceedsFeeBps = () => {
    const parsed = Number.parseInt(newProceedsFeeBps, 10);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10_000) {
      toast.error('Proceeds fee must be between 0 and 10000 bps.');
      return;
    }
    setProceedsFeeBps(parsed);
  };

  const adminStatusLabel = isOnChainOwner ? 'NFT factory owner' : 'Admin access';
  const currentProceedsFeeLabel =
    proceedsFeeBps !== undefined
      ? `${(Number(proceedsFeeBps) / 100).toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })}%`
      : 'Unknown';

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-10"
    >
      <motion.section variants={itemVariants} className="space-y-3">
        <p className="text-label text-ink-faint uppercase tracking-wider">Admin</p>
        <h1 className="font-display text-display-lg text-ink">Stage0 Admin</h1>
        <p className="text-body text-ink-muted max-w-3xl">
          Manage launches, whitelisted creators, and NFT launchpad fee defaults from one place.
        </p>
      </motion.section>

      <motion.section variants={itemVariants} className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="stat-card">
          <p className="text-body-sm text-ink-muted">Total Launches</p>
          <p className="font-display text-display-sm text-ink">
            {isLoadingPresales ? '...' : totalPresales}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-body-sm text-ink-muted">Live</p>
          <p className="font-display text-display-sm text-ink">
            {isLoadingPresales ? '...' : livePresales}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-body-sm text-ink-muted">Upcoming</p>
          <p className="font-display text-display-sm text-ink">
            {isLoadingPresales ? '...' : upcomingPresales}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-body-sm text-ink-muted">Ended</p>
          <p className="font-display text-display-sm text-ink">
            {isLoadingPresales ? '...' : endedPresales}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-body-sm text-ink-muted">Total Raised</p>
          <p className="font-display text-display-sm text-ink">
            {isLoadingPresales ? '...' : totalRaised}
          </p>
        </div>
      </motion.section>

      <motion.section variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Link to="/admin/presales" className="glass-card rounded-3xl p-6 group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-accent-muted text-accent flex items-center justify-center">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <p className="text-body font-medium text-ink">Manage Launches</p>
                <p className="text-body-sm text-ink-muted">Edit fees and status</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-ink-muted group-hover:text-ink" />
          </div>
        </Link>

        <Link to="/admin/whitelist" className="glass-card rounded-3xl p-6 group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-ink/10 text-ink flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-body font-medium text-ink">Whitelist Creators</p>
                <p className="text-body-sm text-ink-muted">Add or remove access</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-ink-muted group-hover:text-ink" />
          </div>
        </Link>

        <div className="glass-card rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-ink/10 text-ink flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <p className="text-body font-medium text-ink">Platform Settings</p>
              <p className="text-body-sm text-ink-muted">NFT factory fee defaults</p>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section variants={itemVariants} className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div className="space-y-1">
            <p className="text-label text-ink-faint uppercase tracking-wider">NFT Launchpad</p>
            <h2 className="font-display text-display-md text-ink">NFT Factory</h2>
            <p className="text-body text-ink-muted max-w-2xl">
              Deploy standard ERC721 or ERC721A collections with configurable mint windows, wallet limits, and default withdraw fees.
            </p>
          </div>
          <a
            href={`${explorerUrl}/address/${nftFactory}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost inline-flex items-center gap-2 self-start md:self-auto"
          >
            View Factory <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        <div className="glass-card rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-accent-secondary/15 text-accent-secondary flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="font-display text-display-sm text-ink">Factory Activity</p>
              <p className="text-body-sm text-ink-muted">Total deployments on this factory</p>
            </div>
          </div>
          <p className="font-display text-display-md text-ink font-mono">
            {isLoadingNFTs ? '...' : Number(totalDeployments).toLocaleString()}
          </p>
          <Link to="/create/nft" className="btn-primary inline-flex">Create NFT Collection</Link>
        </div>
      </motion.section>

      <motion.section variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-display-sm text-ink">Factory Details</h2>
            <span className="text-xs text-ink-faint">{adminStatusLabel}</span>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-body-sm text-ink-muted">NFT Factory</p>
              <div className="flex items-center gap-2">
                <code className="text-body-sm font-mono text-ink break-all">{nftFactory}</code>
                <button
                  onClick={() => handleCopy(nftFactory)}
                  className="p-1.5 rounded-lg hover:bg-ink/5 transition-colors"
                  aria-label="Copy NFT factory address"
                >
                  <Copy className="w-4 h-4 text-ink-muted" />
                </button>
              </div>
              <a
                href={`${explorerUrl}/address/${nftFactory}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body-sm text-accent link-underline inline-flex items-center gap-1 mt-1"
              >
                View on explorer
              </a>
            </div>

            <div>
              <p className="text-body-sm text-ink-muted">NFT Factory Lens</p>
              <div className="flex items-center gap-2">
                <code className="text-body-sm font-mono text-ink break-all">{nftFactoryLens}</code>
                <button
                  onClick={() => handleCopy(nftFactoryLens)}
                  className="p-1.5 rounded-lg hover:bg-ink/5 transition-colors"
                  aria-label="Copy NFT factory lens address"
                >
                  <Copy className="w-4 h-4 text-ink-muted" />
                </button>
              </div>
              <a
                href={`${explorerUrl}/address/${nftFactoryLens}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body-sm text-accent link-underline inline-flex items-center gap-1 mt-1"
              >
                View on explorer
              </a>
            </div>

            <div>
              <p className="text-body-sm text-ink-muted">On-chain Owner</p>
              <p className="text-body-sm font-mono text-ink break-all">
                {isLoadingOwner ? 'Loading...' : factoryOwner ?? 'Unknown'}
              </p>
              {isOnChainOwner && (
                <p className="text-xs text-status-live mt-1">✓ Connected wallet is owner</p>
              )}
            </div>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="font-display text-display-sm text-ink">Factory Fee Defaults</h2>
            <p className="text-body-sm text-ink-muted">
              These defaults are applied to NFT collections deployed from this factory.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-body-sm text-ink-muted">Current Fee Recipient</p>
              <p className="text-body-sm font-mono text-ink break-all">
                {isLoadingFeeRecipient ? 'Loading...' : feeRecipient ?? 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-body-sm text-ink-muted">Current Proceeds Fee</p>
              <p className="text-body text-ink">
                {isLoadingProceedsFeeBps ? 'Loading...' : `${currentProceedsFeeLabel} (${proceedsFeeBps?.toString() ?? '0'} bps)`}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-body-sm text-ink-muted">Update Fee Recipient</label>
            <input
              value={newFeeRecipient}
              onChange={(event) => setNewFeeRecipient(event.target.value)}
              placeholder="0x..."
              className="input-field font-mono"
            />
            <button
              onClick={handleSetFeeRecipient}
              disabled={!newFeeRecipient || isUpdatingFeeRecipient}
              className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isUpdatingFeeRecipient ? 'Updating Recipient...' : 'Update Recipient'}
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-body-sm text-ink-muted">Update Proceeds Fee (bps)</label>
            <input
              type="number"
              min="0"
              max="10000"
              value={newProceedsFeeBps}
              onChange={(event) => setNewProceedsFeeBps(event.target.value)}
              placeholder={proceedsFeeBps?.toString() ?? '200'}
              className="input-field"
            />
            <button
              onClick={handleSetProceedsFeeBps}
              disabled={!newProceedsFeeBps || isUpdatingProceedsFee}
              className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isUpdatingProceedsFee ? 'Updating Fee...' : 'Update Proceeds Fee'}
            </button>
            <p className="text-xs text-ink-faint">
              Basis points: 100 = 1%. Only the NFT factory owner can update these settings.
            </p>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
};

export default AdminDashboard;
