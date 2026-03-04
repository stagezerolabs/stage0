import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, type Address } from 'viem';
import { TokenLocker, erc20Abi, getContractAddresses, getExplorerUrl } from '@/config';
import { useAllLocks } from '@/lib/hooks/useAllLocks';
import {
  Lock,
  Unlock,
  Clock,
  ArrowRightLeft,
  Timer,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 40, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 1,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

function formatDate(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getLockProgress(lockDate: bigint, unlockDate: bigint): number {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now >= unlockDate) return 100;
  if (now <= lockDate) return 0;
  const total = Number(unlockDate - lockDate);
  const elapsed = Number(now - lockDate);
  return Math.min(Math.round((elapsed / total) * 100), 100);
}

function isExpired(unlockDate: bigint): boolean {
  return BigInt(Math.floor(Date.now() / 1000)) >= unlockDate;
}

const TokenLockerPage: React.FC = () => {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const explorerUrl = getExplorerUrl(chainId);
  const [searchParams] = useSearchParams();

  const { locks, isLoading: isLoadingLocks, refetch: refetchLocks } = useAllLocks();

  // Create Lock Form - pre-fill token from query param
  const [tokenAddress, setTokenAddress] = useState(searchParams.get('token') || '');
  const [amount, setAmount] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [lockName, setLockName] = useState('');
  const [lockDescription, setLockDescription] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(true);

  // Approval
  const {
    data: approveHash,
    writeContract: approveWrite,
    isPending: isApprovePending,
  } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } =
    useWaitForTransactionReceipt({ hash: approveHash });

  // Create Lock
  const {
    data: lockHash,
    writeContract: lockWrite,
    isPending: isLockPending,
    error: lockError,
  } = useWriteContract();

  const {
    isLoading: isLockConfirming,
    isSuccess: isLockSuccess,
  } = useWaitForTransactionReceipt({ hash: lockHash });

  // Actions (unlock, extend, transfer)
  const {
    data: actionHash,
    writeContract: actionWrite,
    isPending: isActionPending,
    error: actionError,
  } = useWriteContract();

  const {
    isLoading: isActionConfirming,
    isSuccess: isActionSuccess,
  } = useWaitForTransactionReceipt({ hash: actionHash });

  const [lockFilter, setLockFilter] = useState<'all' | 'locked' | 'unlockable' | 'withdrawn'>('all');
  const [extendLockId, setExtendLockId] = useState<bigint | null>(null);
  const [extendDays, setExtendDays] = useState('');
  const [transferLockId, setTransferLockId] = useState<bigint | null>(null);
  const [transferAddress, setTransferAddress] = useState('');

  const handleApprove = () => {
    if (!tokenAddress || !amount) return;
    const parsed = parseUnits(amount, 18);
    approveWrite({
      abi: erc20Abi,
      address: tokenAddress as Address,
      functionName: 'approve',
      args: [contracts.tokenLocker, parsed],
    });
  };

  const handleCreateLock = () => {
    if (!tokenAddress || !amount || !durationDays) return;
    const parsed = parseUnits(amount, 18);
    const durationSeconds = BigInt(parseInt(durationDays) * 86400);

    lockWrite({
      abi: TokenLocker,
      address: contracts.tokenLocker,
      functionName: 'lockTokens',
      args: [
        tokenAddress as Address,
        parsed,
        durationSeconds,
        lockName || 'Token Lock',
        lockDescription || '',
      ],
    });
  };

  const handleUnlock = (lockId: bigint) => {
    actionWrite({
      abi: TokenLocker,
      address: contracts.tokenLocker,
      functionName: 'unlock',
      args: [lockId],
    });
  };

  const handleExtend = (lockId: bigint) => {
    if (!extendDays) return;
    const additionalSeconds = BigInt(parseInt(extendDays) * 86400);
    actionWrite({
      abi: TokenLocker,
      address: contracts.tokenLocker,
      functionName: 'extendLock',
      args: [lockId, additionalSeconds],
    });
    setExtendLockId(null);
    setExtendDays('');
  };

  const handleTransfer = (lockId: bigint) => {
    if (!transferAddress) return;
    actionWrite({
      abi: TokenLocker,
      address: contracts.tokenLocker,
      functionName: 'transferLockOwnership',
      args: [lockId, transferAddress as Address],
    });
    setTransferLockId(null);
    setTransferAddress('');
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-4xl mx-auto space-y-8"
    >
      {/* Header */}
      <motion.section variants={itemVariants} className="space-y-2">
        <h1 className="font-display text-display-lg text-ink">Token Locker</h1>
        <p className="text-body-lg text-ink-muted">
          Lock your tokens for a specified duration. Build trust with your community.
        </p>
      </motion.section>

      {/* Create Lock Form */}
      <motion.section variants={itemVariants}>
        <div className="glass-card rounded-3xl overflow-hidden">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="w-full flex items-center justify-between p-6 hover:bg-ink/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-accent-muted text-accent flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <h2 className="font-display text-display-sm text-ink">Create Lock</h2>
            </div>
            {showCreateForm ? (
              <ChevronUp className="w-5 h-5 text-ink-muted" />
            ) : (
              <ChevronDown className="w-5 h-5 text-ink-muted" />
            )}
          </button>

          {showCreateForm && (
            <div className="px-6 pb-6 space-y-5 border-t border-ink/5 pt-5">
              <div className="space-y-1.5">
                <label className="text-body-sm text-ink-muted font-medium">Token Address</label>
                <input
                  type="text"
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  placeholder="0x..."
                  className="input-field w-full font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-body-sm text-ink-muted font-medium">Amount</label>
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="1000000"
                    className="input-field w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-body-sm text-ink-muted font-medium">
                    Lock Duration (days)
                  </label>
                  <input
                    type="number"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    placeholder="30"
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-body-sm text-ink-muted font-medium">Lock Name</label>
                  <input
                    type="text"
                    value={lockName}
                    onChange={(e) => setLockName(e.target.value)}
                    placeholder="Liquidity Lock"
                    className="input-field w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-body-sm text-ink-muted font-medium">Description</label>
                  <input
                    type="text"
                    value={lockDescription}
                    onChange={(e) => setLockDescription(e.target.value)}
                    placeholder="Optional description"
                    className="input-field w-full"
                  />
                </div>
              </div>

              {lockError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-status-error-bg text-status-error text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>{lockError.message?.slice(0, 200) || 'Transaction failed'}</p>
                </div>
              )}

              {isLockSuccess && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-status-live-bg text-status-live text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tokens locked successfully!</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleApprove}
                  disabled={isApprovePending || isApproveConfirming || !tokenAddress || !amount}
                  className="btn-secondary flex-1"
                >
                  {isApprovePending || isApproveConfirming ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Approving...
                    </span>
                  ) : isApproveSuccess ? (
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Approved
                    </span>
                  ) : (
                    'Approve'
                  )}
                </button>
                <button
                  onClick={handleCreateLock}
                  disabled={
                    isLockPending ||
                    isLockConfirming ||
                    !isConnected ||
                    !tokenAddress ||
                    !amount ||
                    !durationDays
                  }
                  className="btn-primary flex-1"
                >
                  {isLockPending || isLockConfirming ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isLockConfirming ? 'Confirming...' : 'Locking...'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Lock Tokens
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.section>

      {/* Your Locks */}
      <motion.section variants={itemVariants} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-display-sm text-ink">Your Locks</h2>
          <button onClick={() => refetchLocks()} className="btn-ghost text-sm">
            Refresh
          </button>
        </div>

        {locks && locks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(['all', 'locked', 'unlockable', 'withdrawn'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setLockFilter(status)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  lockFilter === status
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-ink/5 text-ink-muted hover:text-ink'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        )}

        {isLoadingLocks ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
            <p className="text-body-sm text-ink-muted">Loading your locks...</p>
          </div>
        ) : !locks || locks.length === 0 ? (
          <div className="glass-card rounded-3xl p-8 text-center space-y-3">
            <Lock className="w-8 h-8 text-ink-muted mx-auto" />
            <p className="text-body text-ink-muted">
              You don't have any token locks yet. Create one above to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {locks.filter((lock) => {
              if (lockFilter === 'all') return true;
              const expired = isExpired(lock.unlockDate ?? 0n);
              if (lockFilter === 'withdrawn') return lock.withdrawn;
              if (lockFilter === 'unlockable') return !lock.withdrawn && expired;
              return !lock.withdrawn && !expired; // locked
            }).map((lock) => {
              const lockDate = lock.lockDate ?? 0n;
              const unlockDate = lock.unlockDate ?? 0n;
              const progress = getLockProgress(lockDate, unlockDate);
              const expired = isExpired(unlockDate);

              return (
                <motion.div
                  key={lock.id.toString()}
                  variants={itemVariants}
                  className="glass-card rounded-3xl p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-display-sm text-ink">
                          {lock.name || 'Token Lock'}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            lock.withdrawn
                              ? 'bg-status-closed-bg text-status-closed'
                              : expired
                              ? 'bg-status-live-bg text-status-live'
                              : 'bg-status-upcoming-bg text-status-upcoming'
                          }`}
                        >
                          {lock.withdrawn ? 'Withdrawn' : expired ? 'Unlockable' : 'Locked'}
                        </span>
                      </div>
                      <p className="text-body-sm text-ink-muted">
                        {lock.formattedAmount} {lock.tokenSymbol}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/locks/${lock.id.toString()}`}
                        className="btn-secondary text-sm"
                      >
                        View Lock
                      </Link>
                      {lock.token && (
                        <a
                          href={`${explorerUrl}/address/${lock.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-body-sm text-accent inline-flex items-center gap-1 hover:underline"
                        >
                          View Token <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Time Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-body-sm text-ink-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(lockDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Timer className="w-3.5 h-3.5" />
                        {formatDate(unlockDate)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-ink/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          expired ? 'bg-status-live' : 'bg-accent'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-ink-faint text-right">{progress}% elapsed</p>
                  </div>

                  {lock.description && (
                    <p className="text-body-sm text-ink-muted">{lock.description}</p>
                  )}

                  {/* Actions */}
                  {!lock.withdrawn && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-ink/5">
                      {expired && (
                        <button
                          onClick={() => handleUnlock(lock.id)}
                          disabled={isActionPending || isActionConfirming}
                          className="btn-primary text-sm"
                        >
                          {isActionPending || isActionConfirming ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              <Unlock className="w-3.5 h-3.5" />
                              Unlock
                            </span>
                          )}
                        </button>
                      )}

                      {/* Extend */}
                      {extendLockId === lock.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={extendDays}
                            onChange={(e) => setExtendDays(e.target.value)}
                            placeholder="Days"
                            className="input-field w-24 text-sm"
                          />
                          <button
                            onClick={() => handleExtend(lock.id)}
                            disabled={!extendDays || isActionPending}
                            className="btn-primary text-sm"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setExtendLockId(null)}
                            className="btn-ghost text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setExtendLockId(lock.id)}
                          className="btn-secondary text-sm"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            Extend
                          </span>
                        </button>
                      )}

                      {/* Transfer */}
                      {transferLockId === lock.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={transferAddress}
                            onChange={(e) => setTransferAddress(e.target.value)}
                            placeholder="0x..."
                            className="input-field w-40 text-sm font-mono"
                          />
                          <button
                            onClick={() => handleTransfer(lock.id)}
                            disabled={!transferAddress || isActionPending}
                            className="btn-primary text-sm"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setTransferLockId(null)}
                            className="btn-ghost text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setTransferLockId(lock.id)}
                          className="btn-secondary text-sm"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            Transfer
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {actionError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-status-error-bg text-status-error text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>{actionError.message?.slice(0, 200) || 'Action failed'}</p>
          </div>
        )}

        {isActionSuccess && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-status-live-bg text-status-live text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>Action completed successfully!</span>
          </div>
        )}
      </motion.section>
    </motion.div>
  );
};

export default TokenLockerPage;
