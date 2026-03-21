import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, Link } from 'react-router-dom';
import { useAccount, useChainId } from 'wagmi';
import { type Address, formatUnits, parseUnits } from 'viem';
import {
  useLaunchpadPresale,
  useUserPresaleContribution,
} from '@/lib/hooks/useLaunchpadPresales';
import { useLaunchpadPresaleStore } from '@/lib/store/launchpad-presale-store';
import {
  usePresaleContribute,
  usePresaleClaimTokens,
  usePresaleClaimRefund,
  usePresaleOwnerActions,
} from '@/lib/hooks/usePresaleActions';
import { usePresaleApproval } from '@/lib/hooks/usePresaleApproval';
import { getExplorerUrl } from '@/config';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Coins,
  Target,
  Users,
  Calendar,
  Info,
  AlertTriangle,
  Shield,
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

function formatTimestamp(timestamp?: bigint): string {
  if (!timestamp || timestamp <= 0n) return '--';
  return new Date(Number(timestamp) * 1000).toLocaleString();
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

function getStatusBadge(status: string) {
  switch (status) {
    case 'live':
      return (
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold bg-status-live-bg text-status-live">
          <span className="w-2 h-2 rounded-full bg-status-live animate-pulse" />
          Live
        </span>
      );
    case 'upcoming':
      return (
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold bg-status-upcoming-bg text-status-upcoming">
          <Clock className="w-3.5 h-3.5" />
          Upcoming
        </span>
      );
    case 'ended':
    case 'finalized':
      return (
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold bg-status-closed-bg text-status-closed">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Finalized
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold bg-status-error-bg text-status-error">
          <XCircle className="w-3.5 h-3.5" />
          Cancelled
        </span>
      );
    default:
      return null;
  }
}

const PresaleDetailPage: React.FC = () => {
  const { address: presaleAddr } = useParams<{ address: string }>();
  const presaleAddress = presaleAddr as Address | undefined;
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const explorerUrl = getExplorerUrl(chainId);

  const { presale, isLoading, refetch } = useLaunchpadPresale(presaleAddress);
  const getPresaleStatus = useLaunchpadPresaleStore((state) => state.getPresaleStatus);
  const { contribution, purchasedTokens } = useUserPresaleContribution(
    presaleAddress,
    userAddress
  );

  const [contributeAmount, setContributeAmount] = useState('');
  const [amountNeedsAttention, setAmountNeedsAttention] = useState(false);
  const contributeInputRef = useRef<HTMLInputElement | null>(null);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  const paymentDecimals = presale?.paymentTokenDecimals ?? 18;
  const parsedAmount = useMemo(() => {
    try {
      return contributeAmount ? parseUnits(contributeAmount, paymentDecimals) : 0n;
    } catch {
      return 0n;
    }
  }, [contributeAmount, paymentDecimals]);

  const {
    needsApproval,
    approve,
    isApproving,
  } = usePresaleApproval({
    presaleAddress: presaleAddress || ('0x0' as Address),
    paymentToken: {
      address: (presale?.paymentToken || '0x0') as Address,
      decimals: paymentDecimals,
    },
    amount: parsedAmount,
    isPaymentETH: presale?.isPaymentETH ?? true,
  });

  const {
    contribute,
    isPending: isContributing,
    isConfirming: isContributeConfirming,
    isSuccess: isContributeSuccess,
    error: contributeError,
    reset: resetContribute,
    invalidateOnSuccess: invalidateContribute,
  } = usePresaleContribute();

  const {
    claimTokens,
    isPending: isClaiming,
    isConfirming: isClaimConfirming,
  } = usePresaleClaimTokens();

  const {
    claimRefund,
    isPending: isRefunding,
    isConfirming: isRefundConfirming,
  } = usePresaleClaimRefund();

  const {
    depositSaleTokens,
    finalize,
    enableClaims,
    cancelPresale,
    withdrawProceeds,
    isPending: isOwnerActionPending,
    isConfirming: isOwnerActionConfirming,
  } = usePresaleOwnerActions();

  const [depositAmount, setDepositAmount] = useState('');

  useEffect(() => {
    if (isContributeSuccess && presaleAddress) {
      invalidateContribute(presaleAddress);
      setContributeAmount('');
      refetch();
    }
  }, [isContributeSuccess, presaleAddress, invalidateContribute, refetch]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const isOwner =
    isConnected &&
    userAddress &&
    presale?.owner &&
    userAddress.toLowerCase() === presale.owner.toLowerCase();

  const presaleStatus = presale ? getPresaleStatus(presale) : 'upcoming';
  const progress = useMemo(() => {
    if (!presale?.hardCap || presale.hardCap === 0n) return 0;
    return Number((presale.totalRaised * 100n) / presale.hardCap);
  }, [presale?.hardCap, presale?.totalRaised]);
  const startSec = Number(presale?.startTime ?? 0n);
  const endSec = Number(presale?.endTime ?? 0n);

  const startCountdown =
    startSec === 0 ? '--' : startSec > nowSec ? `in ${formatCountdown(presale?.startTime, nowSec)}` : 'Started';
  const endCountdown =
    endSec === 0 ? '--' : endSec > nowSec ? `in ${formatCountdown(presale?.endTime, nowSec)}` : 'Ended';

  const timelineRows: Array<{ label: string; value: string }> = [];
  if (presaleStatus === 'upcoming') {
    timelineRows.push({
      label: 'Launch starts in',
      value: formatCountdown(presale?.startTime, nowSec),
    });
  } else if (presaleStatus === 'live') {
    timelineRows.push({
      label: 'Launch ends in',
      value: formatCountdown(presale?.endTime, nowSec),
    });
  } else {
    timelineRows.push({ label: 'Status', value: presaleStatus });
  }

  const handleContribute = () => {
    if (!presaleAddress) return;
    if (parsedAmount === 0n) {
      setAmountNeedsAttention(true);
      contributeInputRef.current?.focus();
      return;
    }

    setAmountNeedsAttention(false);
    contribute({
      presaleAddress,
      amount: parsedAmount,
      isPaymentETH: presale?.isPaymentETH ?? true,
    });
  };

  if (isLoading || !presale) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <p className="text-body text-ink-muted">Loading launch details...</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Back Link */}
      <motion.div variants={itemVariants}>
        <Link
          to="/presales"
          className="inline-flex items-center gap-2 text-body text-ink-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Launchpad
        </Link>
      </motion.div>

      {/* Header */}
      <motion.section variants={itemVariants} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 space-y-1">
            <h1 className="font-display text-display-lg text-ink">
              {presale.saleTokenName || presale.saleTokenSymbol || 'Token Sale'}
            </h1>
            <p className="text-body text-ink-muted">
              {presale.saleTokenSymbol || 'Unknown'} Launch
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && (
              <Link
                to={`/presales/manage/${presaleAddress}`}
                className="btn-secondary text-sm"
              >
                Manage Launch
              </Link>
            )}
            {getStatusBadge(presaleStatus)}
          </div>
        </div>
        {presale.requiresWhitelist && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-status-upcoming-bg text-status-upcoming text-sm">
            <Shield className="w-4 h-4" />
            Whitelisted participants only
          </div>
        )}
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress Section */}
          <motion.div variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-4">
            <h2 className="font-display text-display-sm text-ink">Sale Progress</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-body">
                <span className="text-ink-muted">Raised</span>
                <span className="text-ink font-medium">
                  {formatUnits(presale.totalRaised ?? 0n, paymentDecimals)}{' '}
                  {presale.paymentTokenSymbol || ''} /{' '}
                  {formatUnits(presale.hardCap ?? 0n, paymentDecimals)}{' '}
                  {presale.paymentTokenSymbol || ''}
                </span>
              </div>
              <div className="w-full h-4 bg-ink/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-body-sm text-ink-muted">
                <span>{Math.min(progress, 100)}% filled</span>
                <span>
                  Soft Cap:{' '}
                  {formatUnits(presale.softCap ?? 0n, paymentDecimals)}{' '}
                  {presale.paymentTokenSymbol || ''}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Info Grid */}
          <motion.div variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-4">
            <h2 className="font-display text-display-sm text-ink">Sale Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  label: 'Sale Token',
                  value: presale.saleTokenSymbol || 'Unknown',
                  icon: Coins,
                  sub: presale.saleToken ? `${presale.saleToken.slice(0, 6)}...${presale.saleToken.slice(-4)}` : '',
                },
                {
                  label: 'Payment Token',
                  value: presale.isPaymentETH
                    ? 'Native Token'
                    : presale.paymentTokenSymbol || 'Unknown',
                  icon: Coins,
                  sub: presale.isPaymentETH
                    ? ''
                    : presale.paymentToken
                    ? `${presale.paymentToken.slice(0, 6)}...${presale.paymentToken.slice(-4)}`
                    : '',
                },
                {
                  label: 'Rate',
                  value: presale.rate ? `${presale.rate.toString()} tokens per 100 payment` : '--',
                  icon: Target,
                },
                {
                  label: 'Hard Cap',
                  value: `${formatUnits(presale.hardCap ?? 0n, paymentDecimals)} ${presale.paymentTokenSymbol || ''}`,
                  icon: Target,
                },
                {
                  label: 'Soft Cap',
                  value: `${formatUnits(presale.softCap ?? 0n, paymentDecimals)} ${presale.paymentTokenSymbol || ''}`,
                  icon: Target,
                },
                {
                  label: 'Min Contribution',
                  value: `${formatUnits(presale.minContribution ?? 0n, paymentDecimals)} ${presale.paymentTokenSymbol || ''}`,
                  icon: Info,
                },
                {
                  label: 'Max Contribution',
                  value: `${formatUnits(presale.maxContribution ?? 0n, paymentDecimals)} ${presale.paymentTokenSymbol || ''}`,
                  icon: Info,
                },
                {
                  label: 'Start Time',
                  value: startCountdown,
                  sub: formatTimestamp(presale.startTime),
                  icon: Calendar,
                },
                {
                  label: 'End Time',
                  value: endCountdown,
                  sub: formatTimestamp(presale.endTime),
                  icon: Calendar,
                },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-2xl bg-ink/[0.02]">
                  <div className="w-8 h-8 rounded-xl bg-accent-muted text-accent flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-body-sm text-ink-muted">{item.label}</p>
                    <p className="text-body font-medium text-ink truncate">{item.value}</p>
                    {item.sub && (
                      <p className="text-body-sm text-ink-faint truncate">{item.sub}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {timelineRows.length > 0 && (
              <div className="rounded-2xl border border-border bg-canvas-alt p-4 space-y-2">
                {timelineRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 text-body-sm">
                    <span className="inline-flex items-center gap-2 text-ink-muted">
                      <Clock className="w-3.5 h-3.5" />
                      {row.label}
                    </span>
                    <span className="font-medium text-ink">{row.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Explorer Link */}
            {presaleAddress && (
              <a
                href={`${explorerUrl}/address/${presaleAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-body-sm text-accent hover:underline"
              >
                View on Explorer <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </motion.div>

          {/* Owner Section */}
          {isOwner && (
            <motion.div
              variants={itemVariants}
              className="glass-card rounded-3xl p-6 space-y-4 border border-status-upcoming/30"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-status-upcoming" />
                <h2 className="font-display text-display-sm text-ink">Owner Controls</h2>
              </div>

              {/* Deposit Sale Tokens */}
              <div className="space-y-3">
                <label className="text-body-sm text-ink-muted font-medium">
                  Deposit Sale Tokens
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="Amount to deposit"
                    className="input-field flex-1"
                  />
                  <button
                    onClick={() => {
                      if (!presaleAddress || !depositAmount) return;
                      const saleDecimals = presale.saleTokenDecimals ?? 18;
                      depositSaleTokens(
                        presaleAddress,
                        parseUnits(depositAmount, saleDecimals)
                      );
                    }}
                    disabled={isOwnerActionPending || isOwnerActionConfirming}
                    className="btn-primary"
                  >
                    {isOwnerActionPending || isOwnerActionConfirming ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Deposit'
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => presaleAddress && finalize(presaleAddress)}
                  disabled={
                    isOwnerActionPending ||
                    isOwnerActionConfirming ||
                    Boolean(presale.successfulFinalization || presale.claimEnabled || presale.refundsEnabled)
                  }
                  className="btn-primary"
                >
                  Finalize
                </button>
                <button
                  onClick={() => presaleAddress && enableClaims(presaleAddress)}
                  disabled={
                    isOwnerActionPending ||
                    isOwnerActionConfirming ||
                    Boolean(!presale.successfulFinalization || presale.claimEnabled || presale.refundsEnabled)
                  }
                  className="btn-secondary"
                >
                  Enable Claims
                </button>
                <button
                  onClick={() => presaleAddress && cancelPresale(presaleAddress)}
                  disabled={
                    isOwnerActionPending ||
                    isOwnerActionConfirming ||
                    Boolean(presale.successfulFinalization || presale.claimEnabled || presale.refundsEnabled)
                  }
                  className="btn-secondary text-status-error border-status-error/30 hover:bg-status-error-bg"
                >
                  Cancel Launch
                </button>
                <button
                  onClick={() => presaleAddress && withdrawProceeds(presaleAddress)}
                  disabled={isOwnerActionPending || isOwnerActionConfirming || !presale.claimEnabled}
                  className="btn-secondary"
                >
                  Withdraw Proceeds
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Column: Participation */}
        <div className="space-y-6">
          {/* User Contribution Info */}
          {isConnected && (
            <motion.div variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-3">
              <h3 className="font-display text-display-sm text-ink">Your Participation</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-body-sm">
                  <span className="text-ink-muted">Contributed</span>
                  <span className="text-ink font-medium">
                    {formatUnits(contribution, paymentDecimals)}{' '}
                    {presale.paymentTokenSymbol || ''}
                  </span>
                </div>
                <div className="flex justify-between text-body-sm">
                  <span className="text-ink-muted">Tokens to Receive</span>
                  <span className="text-ink font-medium">
                    {formatUnits(purchasedTokens, presale.saleTokenDecimals ?? 18)}{' '}
                    {presale.saleTokenSymbol || ''}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Contribute Form */}
          {presaleStatus === 'live' && isConnected && (
            <motion.div variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-4">
              <h3 className="font-display text-display-sm text-ink">Contribute</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-body-sm text-ink-muted font-medium mb-1 block">
                    Amount ({presale.paymentTokenSymbol || 'Token'})
                  </label>
                  <input
                    ref={contributeInputRef}
                    type="text"
                    value={contributeAmount}
                    onChange={(e) => {
                      resetContribute();
                      setAmountNeedsAttention(false);
                      setContributeAmount(e.target.value);
                    }}
                    onFocus={() => setAmountNeedsAttention(false)}
                    placeholder="0.0"
                    className={`input-field w-full transition-all duration-200 ${
                      amountNeedsAttention
                        ? 'border-2 border-accent ring-2 ring-accent/45 shadow-[0_0_0_3px_rgba(255,138,0,0.16)]'
                        : 'border border-accent/55 focus:border-accent focus:ring-2 focus:ring-accent/35'
                    }`}
                  />
                </div>
                <div className="text-body-sm text-ink-muted space-y-1">
                  <p>
                    Min: {formatUnits(presale.minContribution ?? 0n, paymentDecimals)}{' '}
                    {presale.paymentTokenSymbol || ''}
                  </p>
                  <p>
                    Max: {formatUnits(presale.maxContribution ?? 0n, paymentDecimals)}{' '}
                    {presale.paymentTokenSymbol || ''}
                  </p>
                </div>

                {contributeError && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-status-error-bg text-status-error text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p>{contributeError.message?.slice(0, 200) || 'Transaction failed'}</p>
                  </div>
                )}

                {needsApproval && !presale.isPaymentETH ? (
                  <button
                    onClick={approve}
                    disabled={isApproving}
                    className="btn-primary w-full"
                  >
                    {isApproving ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Approving...
                      </span>
                    ) : (
                      'Approve Token'
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleContribute}
                    disabled={
                      isContributing ||
                      isContributeConfirming
                    }
                    className="btn-primary w-full"
                  >
                    {isContributing || isContributeConfirming ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {isContributeConfirming ? 'Confirming...' : 'Contributing...'}
                      </span>
                    ) : (
                      'Contribute'
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Claim / Refund */}
          {isConnected && contribution > 0n && (
            <motion.div variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-4">
              <h3 className="font-display text-display-sm text-ink">Actions</h3>
              <div className="space-y-3">
                {presale.claimEnabled && (
                  <button
                    onClick={() => presaleAddress && claimTokens(presaleAddress)}
                    disabled={isClaiming || isClaimConfirming}
                    className="btn-primary w-full"
                  >
                    {isClaiming || isClaimConfirming ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Claiming...
                      </span>
                    ) : (
                      'Claim Tokens'
                    )}
                  </button>
                )}
                {presale.refundsEnabled && (
                  <button
                    onClick={() => presaleAddress && claimRefund(presaleAddress)}
                    disabled={isRefunding || isRefundConfirming}
                    className="btn-secondary w-full"
                  >
                    {isRefunding || isRefundConfirming ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      'Claim Refund'
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Connect Wallet CTA */}
          {!isConnected && (
            <motion.div
              variants={itemVariants}
              className="glass-card rounded-3xl p-6 text-center space-y-3"
            >
              <Users className="w-8 h-8 text-accent mx-auto" />
              <p className="text-body text-ink-muted">
                Connect your wallet to participate in this launch.
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default PresaleDetailPage;
