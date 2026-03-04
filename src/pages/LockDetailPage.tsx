import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { formatUnits, isAddress, type Abi, type Address } from 'viem';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Lock,
  Timer,
  ArrowRightLeft,
  User,
} from 'lucide-react';
import { TokenLocker, erc20Abi } from '@/config';
import { useChainContracts } from '@/lib/hooks/useChainContracts';

interface LockInfo {
  token: Address;
  owner: Address;
  amount: bigint;
  lockDate: bigint;
  unlockDate: bigint;
  withdrawn: boolean;
  name: string;
  description: string;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function formatDate(timestamp: bigint): string {
  if (!timestamp) return 'Unknown';
  return new Date(Number(timestamp) * 1000).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getProgress(lockDate: bigint, unlockDate: bigint): number {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (unlockDate <= lockDate) return 0;
  if (now >= unlockDate) return 100;
  if (now <= lockDate) return 0;
  const total = Number(unlockDate - lockDate);
  const elapsed = Number(now - lockDate);
  return Math.min(Math.round((elapsed / total) * 100), 100);
}

const LockDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { address } = useAccount();
  const { tokenLocker, explorerUrl } = useChainContracts();

  const lockId = useMemo(() => {
    if (!id) return undefined;
    try {
      return BigInt(id);
    } catch {
      return undefined;
    }
  }, [id]);

  const {
    data: lockData,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: tokenLocker,
    abi: TokenLocker as Abi,
    functionName: 'getLock',
    args: lockId !== undefined ? [lockId] : undefined,
    query: {
      enabled: Boolean(lockId !== undefined && tokenLocker !== ZERO_ADDRESS),
    },
  });

  const lock = lockData as LockInfo | undefined;

  const { data: tokenSymbol } = useReadContract({
    abi: erc20Abi,
    address: lock?.token,
    functionName: 'symbol',
    query: { enabled: Boolean(lock?.token) },
  });

  const { data: tokenDecimals } = useReadContract({
    abi: erc20Abi,
    address: lock?.token,
    functionName: 'decimals',
    query: { enabled: Boolean(lock?.token) },
  });

  const { data: tokenName } = useReadContract({
    abi: erc20Abi,
    address: lock?.token,
    functionName: 'name',
    query: { enabled: Boolean(lock?.token) },
  });

  const formattedAmount = useMemo(() => {
    if (!lock?.amount || tokenDecimals === undefined) return '...';
    try {
      return Number(formatUnits(lock.amount, tokenDecimals)).toLocaleString();
    } catch {
      return formatUnits(lock.amount, tokenDecimals);
    }
  }, [lock?.amount, tokenDecimals]);

  const now = BigInt(Math.floor(Date.now() / 1000));
  const unlockable = Boolean(lock && !lock.withdrawn && lock.unlockDate <= now);
  const statusLabel = lock?.withdrawn
    ? 'Withdrawn'
    : unlockable
    ? 'Unlockable'
    : 'Locked';

  const isOwner = Boolean(address && lock?.owner && address.toLowerCase() === lock.owner.toLowerCase());

  const {
    data: actionHash,
    writeContract,
    isPending,
    error: actionError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: actionHash,
  });

  const [extendDays, setExtendDays] = useState('');
  const [transferAddress, setTransferAddress] = useState('');

  useEffect(() => {
    if (isSuccess) {
      toast.success('Lock updated successfully.');
      refetch();
    }
  }, [isSuccess, refetch]);

  useEffect(() => {
    if (actionError) {
      toast.error(actionError.message ?? 'Transaction failed.');
    }
  }, [actionError]);

  const handleUnlock = () => {
    if (!lockId) return;
    writeContract({
      abi: TokenLocker as Abi,
      address: tokenLocker,
      functionName: 'unlock',
      args: [lockId],
    });
  };

  const handleExtend = () => {
    if (!lockId || !extendDays) return;
    const seconds = BigInt(Math.max(1, parseInt(extendDays, 10)) * 86400);
    writeContract({
      abi: TokenLocker as Abi,
      address: tokenLocker,
      functionName: 'extendLock',
      args: [lockId, seconds],
    });
    setExtendDays('');
  };

  const handleTransfer = () => {
    if (!lockId || !transferAddress || !isAddress(transferAddress)) {
      toast.error('Enter a valid address.');
      return;
    }
    writeContract({
      abi: TokenLocker as Abi,
      address: tokenLocker,
      functionName: 'transferLockOwnership',
      args: [lockId, transferAddress as Address],
    });
    setTransferAddress('');
  };

  if (!lockId) {
    return (
      <div className="glass-card rounded-3xl p-8 text-center space-y-3">
        <Lock className="w-8 h-8 text-ink-muted mx-auto" />
        <p className="text-body text-ink-muted">Invalid lock ID.</p>
        <Link to="/tools/token-locker" className="btn-primary inline-flex">
          Back to Token Locker
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <p className="text-body-sm text-ink-muted">Loading lock #{id}...</p>
      </div>
    );
  }

  if (error || !lock) {
    return (
      <div className="glass-card rounded-3xl p-8 text-center space-y-3">
        <Lock className="w-8 h-8 text-ink-muted mx-auto" />
        <p className="text-body text-ink-muted">Lock not found.</p>
        <Link to="/tools/token-locker" className="btn-primary inline-flex">
          Back to Token Locker
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Link to="/tools/token-locker" className="inline-flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="w-4 h-4" />
        Back to Token Locker
      </Link>

      <div className="glass-card rounded-3xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-body-sm text-ink-muted">Lock #{id}</p>
            <h1 className="font-display text-display-lg text-ink">
              {lock.name || `Token Lock #${id}`}
            </h1>
            {lock.description && (
              <p className="text-body text-ink-muted">{lock.description}</p>
            )}
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            lock.withdrawn
              ? 'bg-ink/10 text-ink-muted'
              : unlockable
              ? 'bg-status-live/20 text-status-live'
              : 'bg-status-warning/20 text-status-warning'
          }`}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <h2 className="font-display text-display-sm text-ink">Token Details</h2>
          <div className="space-y-2">
            <p className="text-body-sm text-ink-muted">Token</p>
            <p className="text-body font-semibold text-ink">{tokenName ?? 'Unknown'} ({tokenSymbol ?? '...'})</p>
            {lock.token && (
              <a
                href={`${explorerUrl}/address/${lock.token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body-sm text-accent inline-flex items-center gap-1"
              >
                View Token <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <div className="pt-3 border-t border-ink/10">
            <p className="text-body-sm text-ink-muted">Locked Amount</p>
            <p className="font-display text-display-md text-ink">
              {formattedAmount} {tokenSymbol ?? ''}
            </p>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-6 space-y-4">
          <h2 className="font-display text-display-sm text-ink">Owner</h2>
          <div className="space-y-2">
            <p className="text-body-sm text-ink-muted">Owner Address</p>
            <p className="text-body-sm font-mono text-ink break-all">{lock.owner}</p>
            {lock.owner && (
              <a
                href={`${explorerUrl}/address/${lock.owner}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body-sm text-accent inline-flex items-center gap-1"
              >
                View Owner <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {isOwner && (
              <p className="text-xs text-status-live inline-flex items-center gap-1">
                <User className="w-3 h-3" /> You own this lock
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6 space-y-4">
        <h2 className="font-display text-display-sm text-ink">Timeline</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-body-sm text-ink-muted inline-flex items-center gap-2">
              <Clock className="w-4 h-4" /> Lock Date
            </p>
            <p className="text-body font-medium text-ink">{formatDate(lock.lockDate)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-body-sm text-ink-muted inline-flex items-center gap-2">
              <Timer className="w-4 h-4" /> Unlock Date
            </p>
            <p className="text-body font-medium text-ink">{formatDate(lock.unlockDate)}</p>
          </div>
        </div>
        {!lock.withdrawn && (
          <div className="space-y-2">
            <div className="flex justify-between text-body-sm text-ink-muted">
              <span>Progress</span>
              <span>{getProgress(lock.lockDate, lock.unlockDate)}%</span>
            </div>
            <div className="w-full h-2 bg-ink/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${unlockable ? 'bg-status-live' : 'bg-accent'}`}
                style={{ width: `${getProgress(lock.lockDate, lock.unlockDate)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {isOwner && !lock.withdrawn && (
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <h2 className="font-display text-display-sm text-ink">Manage Lock</h2>
          <div className="flex flex-col md:flex-row gap-3">
            <button
              onClick={handleUnlock}
              disabled={!unlockable || isPending || isConfirming}
              className="btn-primary flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending || isConfirming ? 'Processing...' : 'Unlock Tokens'}
            </button>
            <div className="flex flex-1 gap-2">
              <input
                type="number"
                value={extendDays}
                onChange={(event) => setExtendDays(event.target.value)}
                placeholder="Extend (days)"
                className="input-field flex-1"
              />
              <button
                onClick={handleExtend}
                disabled={!extendDays || isPending || isConfirming}
                className="btn-secondary"
              >
                Extend
              </button>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              value={transferAddress}
              onChange={(event) => setTransferAddress(event.target.value)}
              placeholder="Transfer to (0x...)"
              className="input-field font-mono flex-1"
            />
            <button
              onClick={handleTransfer}
              disabled={!transferAddress || isPending || isConfirming}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Transfer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LockDetailPage;
