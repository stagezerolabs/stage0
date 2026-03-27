import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import {
  useAccount,
  useChainId,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { type Address, formatUnits, isAddress } from 'viem';
import { toast } from 'sonner';
import { useLaunchpadPresale } from '@/lib/hooks/useLaunchpadPresales';
import { useLaunchpadPresaleStore } from '@/lib/store/launchpad-presale-store';
import { LaunchpadPresaleContract, PresaleContract, erc20Abi, getExplorerUrl } from '@/config';
import { getFriendlyTxErrorMessage } from '@/lib/utils/tx-errors';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Upload,
  Ban,
  Coins,
  Users,
  ExternalLink,
  Settings,
  ShieldAlert,
} from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

function getStatusLabel(status: string) {
  switch (status) {
    case 'live':
      return { text: 'Live', color: 'bg-status-live/15 text-status-live' };
    case 'upcoming':
      return { text: 'Upcoming', color: 'bg-status-warning/15 text-status-warning' };
    case 'ended':
    case 'finalized':
      return { text: 'Finalized', color: 'bg-ink/10 text-ink-muted' };
    case 'cancelled':
      return { text: 'Cancelled', color: 'bg-status-error/15 text-status-error' };
    default:
      return { text: status, color: 'bg-ink/10 text-ink-muted' };
  }
}

const RATE_DIVISOR = 100n;

const ManagePresalePage: React.FC = () => {
  const { address: presaleAddr } = useParams<{ address: string }>();
  const presaleAddress = presaleAddr && isAddress(presaleAddr) ? (presaleAddr as Address) : undefined;
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const explorerUrl = getExplorerUrl(chainId);

  const { presale, isLoading, refetch } = useLaunchpadPresale(presaleAddress);
  const getPresaleStatus = useLaunchpadPresaleStore((state) => state.getPresaleStatus);
  const presaleStatus = presale ? getPresaleStatus(presale) : 'upcoming';

  const { data: saleTokenInfo } = useReadContracts({
    contracts: presale?.saleToken
      ? [
          { abi: erc20Abi, address: presale.saleToken, functionName: 'symbol' },
          { abi: erc20Abi, address: presale.saleToken, functionName: 'decimals' },
          { abi: erc20Abi, address: presale.saleToken, functionName: 'totalSupply' },
        ]
      : [],
    query: {
      enabled: Boolean(presale?.saleToken),
    },
  });

  const saleTokenSymbol = (saleTokenInfo?.[0]?.result as string) || presale?.saleTokenSymbol || 'TOKEN';
  const saleTokenDecimals = (saleTokenInfo?.[1]?.result as number) || presale?.saleTokenDecimals || 18;
  const totalSupply = saleTokenInfo?.[2]?.result as bigint | undefined;

  const saleAmount = useMemo(() => {
    if (!presale?.hardCap || !presale?.rate) return 0n;
    try {
      return (presale.hardCap * presale.rate) / RATE_DIVISOR;
    } catch {
      return 0n;
    }
  }, [presale?.hardCap, presale?.rate]);

  const launchpadFee = useMemo(() => {
    if (!totalSupply) return 0n;
    return totalSupply / 50n; // 2% fee
  }, [totalSupply]);

  const totalRequired = saleAmount + launchpadFee;

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: presale?.saleToken,
    abi: erc20Abi,
    functionName: 'allowance',
    args: userAddress && presaleAddress ? [userAddress, presaleAddress] : undefined,
    query: {
      enabled: Boolean(userAddress && presaleAddress && presale?.saleToken),
      refetchInterval: 5000,
    },
  });

  const { data: contractBalance, refetch: refetchBalance } = useReadContract({
    address: presale?.saleToken,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: presaleAddress ? [presaleAddress] : undefined,
    query: {
      enabled: Boolean(presaleAddress && presale?.saleToken),
      refetchInterval: 5000,
    },
  });

  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: isApprovePending,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } =
    useWaitForTransactionReceipt({ hash: approveHash });

  const {
    writeContract: writeDeposit,
    data: depositHash,
    isPending: isDepositPending,
    error: depositError,
    reset: resetDeposit,
  } = useWriteContract();

  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } =
    useWaitForTransactionReceipt({ hash: depositHash });

  const {
    writeContract: writeOwnerAction,
    data: ownerActionHash,
    isPending: isOwnerPending,
    error: ownerError,
    reset: resetOwnerAction,
  } = useWriteContract();

  const { isLoading: isOwnerConfirming, isSuccess: isOwnerSuccess } =
    useWaitForTransactionReceipt({ hash: ownerActionHash });

  const {
    writeContract: writeWhitelist,
    data: whitelistHash,
    isPending: isWhitelistPending,
    error: whitelistError,
    reset: resetWhitelist,
  } = useWriteContract();

  const { isLoading: isWhitelistConfirming, isSuccess: isWhitelistSuccess } =
    useWaitForTransactionReceipt({ hash: whitelistHash });

  const [activeOwnerAction, setActiveOwnerAction] = useState<string | null>(null);
  const [activeWhitelistAction, setActiveWhitelistAction] = useState<string | null>(null);
  const [singleWhitelist, setSingleWhitelist] = useState('');
  const [bulkWhitelist, setBulkWhitelist] = useState('');
  const [removeWhitelist, setRemoveWhitelist] = useState('');

  useEffect(() => {
    if (approveError) {
      toast.error(getFriendlyTxErrorMessage(approveError, 'Approval'));
    }
  }, [approveError]);

  useEffect(() => {
    if (depositError) {
      toast.error(getFriendlyTxErrorMessage(depositError, 'Deposit'));
    }
  }, [depositError]);

  useEffect(() => {
    if (ownerError) {
      toast.error(getFriendlyTxErrorMessage(ownerError, 'Action'));
    }
  }, [ownerError]);

  useEffect(() => {
    if (whitelistError) {
      toast.error(getFriendlyTxErrorMessage(whitelistError, 'Whitelist update'));
    }
  }, [whitelistError]);

  useEffect(() => {
    if (isApproveSuccess) {
      toast.success('Token allowance approved.');
      resetApprove();
      refetchAllowance();
      refetch();
    }
  }, [isApproveSuccess, resetApprove, refetchAllowance, refetch]);

  useEffect(() => {
    if (isDepositSuccess) {
      toast.success('Sale tokens deposited successfully.');
      resetDeposit();
      refetchBalance();
      refetch();
    }
  }, [isDepositSuccess, resetDeposit, refetchBalance, refetch]);

  useEffect(() => {
    if (isOwnerSuccess && activeOwnerAction) {
      const labels: Record<string, string> = {
        finalize: 'Launch finalized. Enable claims when ready.',
        enableClaims: 'Claims enabled',
        cancel: 'Launch cancelled',
        withdrawProceeds: 'Proceeds withdrawn',
        withdrawTokens: 'Unsold tokens withdrawn',
      };
      toast.success(labels[activeOwnerAction] || 'Transaction confirmed');
      setActiveOwnerAction(null);
      resetOwnerAction();
      refetch();
    }
  }, [isOwnerSuccess, activeOwnerAction, resetOwnerAction, refetch]);

  useEffect(() => {
    if (isWhitelistSuccess && activeWhitelistAction) {
      const labels: Record<string, string> = {
        addOne: 'Wallet added to whitelist',
        bulkAdd: 'Whitelist updated',
        remove: 'Wallet removed from whitelist',
      };
      toast.success(labels[activeWhitelistAction] || 'Whitelist updated');
      setActiveWhitelistAction(null);
      resetWhitelist();
      if (activeWhitelistAction === 'addOne') setSingleWhitelist('');
      if (activeWhitelistAction === 'bulkAdd') setBulkWhitelist('');
      if (activeWhitelistAction === 'remove') setRemoveWhitelist('');
      refetch();
    }
  }, [isWhitelistSuccess, activeWhitelistAction, resetWhitelist, refetch]);

  const isOwner =
    isConnected &&
    userAddress &&
    presale?.owner &&
    userAddress.toLowerCase() === presale.owner.toLowerCase();

  const paymentDecimals = presale?.paymentTokenDecimals ?? 18;
  const paymentSymbol = presale?.paymentTokenSymbol ?? '';

  const progress = useMemo(() => {
    if (!presale?.hardCap || presale.hardCap === 0n) return 0;
    return Number((presale.totalRaised * 100n) / presale.hardCap);
  }, [presale?.hardCap, presale?.totalRaised]);

  const hasSufficientAllowance = useMemo(() => {
    if (!allowance || totalRequired === 0n) return false;
    return allowance >= totalRequired;
  }, [allowance, totalRequired]);

  const hasDeposited = useMemo(() => {
    if (!contractBalance || saleAmount === 0n) return false;
    return contractBalance >= saleAmount;
  }, [contractBalance, saleAmount]);

  const presaleHasEnded =
    presale?.claimEnabled || presale?.refundsEnabled || presale?.successfulFinalization;

  const handleApproveTokens = () => {
    if (!presale?.saleToken || !presaleAddress) return;
    if (totalRequired === 0n) {
      toast.error('Unable to determine required token amount.');
      return;
    }
    writeApprove({
      abi: erc20Abi,
      address: presale.saleToken,
      functionName: 'approve',
      args: [presaleAddress, totalRequired],
    });
  };

  const handleDepositTokens = () => {
    if (!presaleAddress) return;
    if (saleAmount === 0n) {
      toast.error('Unable to determine sale amount.');
      return;
    }
    writeDeposit({
      abi: LaunchpadPresaleContract,
      address: presaleAddress,
      functionName: 'depositSaleTokens',
      args: [saleAmount],
    });
  };

  const runOwnerAction = (action: string, config: Parameters<typeof writeOwnerAction>[0]) => {
    setActiveOwnerAction(action);
    writeOwnerAction(config);
  };

  const handleFinalize = () => {
    if (!presaleAddress) return;
    runOwnerAction('finalize', {
      abi: LaunchpadPresaleContract,
      address: presaleAddress,
      functionName: 'finalize',
    });
  };

  const handleEnableClaims = () => {
    if (!presaleAddress) return;
    runOwnerAction('enableClaims', {
      abi: LaunchpadPresaleContract,
      address: presaleAddress,
      functionName: 'enableClaims',
    });
  };

  const handleCancel = () => {
    if (!presaleAddress) return;
    runOwnerAction('cancel', {
      abi: LaunchpadPresaleContract,
      address: presaleAddress,
      functionName: 'cancelPresale',
    });
  };

  const handleWithdrawProceeds = () => {
    if (!presaleAddress) return;
    if (!presale?.claimEnabled) {
      toast.error('Enable claims before withdrawing proceeds.');
      return;
    }
    runOwnerAction('withdrawProceeds', {
      abi: LaunchpadPresaleContract,
      address: presaleAddress,
      functionName: 'withdrawProceeds',
      args: [0n],
    });
  };

  const handleWithdrawTokens = () => {
    if (!presaleAddress) return;
    if (!presale?.claimEnabled) {
      toast.error('Enable claims before withdrawing unsold tokens.');
      return;
    }
    runOwnerAction('withdrawTokens', {
      abi: LaunchpadPresaleContract,
      address: presaleAddress,
      functionName: 'withdrawUnusedTokens',
      args: [0n],
    });
  };

  const runWhitelistAction = (action: string, config: Parameters<typeof writeWhitelist>[0]) => {
    setActiveWhitelistAction(action);
    writeWhitelist(config);
  };

  const handleAddSingle = () => {
    if (!singleWhitelist || !isAddress(singleWhitelist)) {
      toast.error('Enter a valid address to whitelist.');
      return;
    }
    if (!presaleAddress) return;
    runWhitelistAction('addOne', {
      abi: PresaleContract,
      address: presaleAddress,
      functionName: 'addToWhitelist',
      args: [singleWhitelist as Address],
    });
  };

  const handleBulkWhitelist = () => {
    if (!bulkWhitelist.trim()) {
      toast.error('Paste one or more addresses.');
      return;
    }
    const entries = bulkWhitelist
      .split(/[\s,]+/)
      .map((addr) => addr.trim())
      .filter(Boolean);

    if (entries.length === 0) return;
    const invalid = entries.find((addr) => !isAddress(addr));
    if (invalid) {
      toast.error(`Invalid wallet: ${invalid}`);
      return;
    }
    if (!presaleAddress) return;
    runWhitelistAction('bulkAdd', {
      abi: PresaleContract,
      address: presaleAddress,
      functionName: 'addManyToWhitelist',
      args: [entries as Address[]],
    });
  };

  const handleRemoveWhitelist = () => {
    if (!removeWhitelist || !isAddress(removeWhitelist)) {
      toast.error('Enter a valid address to remove.');
      return;
    }
    if (!presaleAddress) return;
    runWhitelistAction('remove', {
      abi: PresaleContract,
      address: presaleAddress,
      functionName: 'removeFromWhitelist',
      args: [removeWhitelist as Address],
    });
  };

  if (!presaleAddress) {
    return (
      <div className="max-w-2xl mx-auto glass-card rounded-3xl p-8 text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-status-upcoming mx-auto" />
        <h2 className="font-display text-display-md text-ink">Invalid Launch Address</h2>
        <Link to="/presales" className="btn-primary inline-block">
          Back to Launchpad
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <p className="text-body text-ink-muted">Loading launch data...</p>
      </div>
    );
  }

  if (!presale) {
    return (
      <div className="max-w-2xl mx-auto glass-card rounded-3xl p-8 text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-status-upcoming mx-auto" />
        <h2 className="font-display text-display-md text-ink">Launch Not Found</h2>
        <p className="text-body text-ink-muted">
          Could not find a launch at the specified address.
        </p>
        <Link to="/presales" className="btn-primary inline-block">
          Back to Launchpad
        </Link>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="max-w-2xl mx-auto glass-card rounded-3xl p-8 text-center space-y-4">
        <ShieldAlert className="w-8 h-8 text-status-upcoming mx-auto" />
        <h2 className="font-display text-display-md text-ink">Access Denied</h2>
        <p className="text-body text-ink-muted">
          Only the launch owner can access management controls.
        </p>
        <Link
          to={`/presales/${presaleAddress}`}
          className="btn-primary inline-flex items-center gap-2"
        >
          View Launch
        </Link>
      </div>
    );
  }

  const statusInfo = getStatusLabel(presaleStatus);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-4xl mx-auto space-y-8"
    >
      <motion.div variants={itemVariants}>
        <Link
          to={`/presales/${presaleAddress}`}
          className="inline-flex items-center gap-2 text-body text-ink-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Launch
        </Link>
      </motion.div>

      <motion.section variants={itemVariants} className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent-muted text-accent flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <h1 className="font-display text-display-lg text-ink">Manage Launch</h1>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
            {statusInfo.text}
          </span>
        </div>
        <p className="text-body text-ink-muted">
          {presale.saleTokenName || saleTokenSymbol} Launch &mdash;{' '}
          <a
            href={`${explorerUrl}/address/${presaleAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline inline-flex items-center gap-1"
          >
            {presaleAddress?.slice(0, 8)}...{presaleAddress?.slice(-6)}
            <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      </motion.section>

      <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-4">
        <h2 className="font-display text-display-sm text-ink flex items-center gap-2">
          <Coins className="w-5 h-5 text-accent" />
          Sale Status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="stat-card p-4">
            <p className="text-body-sm text-ink-muted">Total Raised</p>
            <p className="font-display text-display-sm text-ink">
              {formatUnits(presale.totalRaised ?? 0n, paymentDecimals)} {paymentSymbol}
            </p>
          </div>
          <div className="stat-card p-4">
            <p className="text-body-sm text-ink-muted">Hard Cap</p>
            <p className="font-display text-display-sm text-ink">
              {formatUnits(presale.hardCap ?? 0n, paymentDecimals)} {paymentSymbol}
            </p>
          </div>
          <div className="stat-card p-4">
            <p className="text-body-sm text-ink-muted">Tokens Deposited</p>
            <p className="font-display text-display-sm text-ink">
              {formatUnits(presale.totalTokensDeposited ?? 0n, saleTokenDecimals)} {saleTokenSymbol}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-body-sm">
            <span className="text-ink-muted">Progress</span>
            <span className="text-ink font-medium">{Math.min(progress, 100)}%</span>
          </div>
          <div className="w-full h-3 bg-ink/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      </motion.section>

      <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-4">
        <h2 className="font-display text-display-sm text-ink flex items-center gap-2">
          <Upload className="w-5 h-5 text-accent" />
          Deposit Sale Tokens
        </h2>
        <p className="text-body-sm text-ink-muted">
          Approve and deposit {saleTokenSymbol} tokens so contributors can claim after finalization.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="stat-card p-4 space-y-1.5">
            <p className="text-body-sm text-ink-muted">Sale Amount</p>
            <p className="text-body font-semibold text-ink">
              {formatUnits(saleAmount, saleTokenDecimals)} {saleTokenSymbol}
            </p>
          </div>
          <div className="stat-card p-4 space-y-1.5">
            <p className="text-body-sm text-ink-muted">Launchpad Fee (2%)</p>
            <p className="text-body font-semibold text-ink">
              {formatUnits(launchpadFee, saleTokenDecimals)} {saleTokenSymbol}
            </p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <button
            onClick={handleApproveTokens}
            disabled={
              isApprovePending ||
              isApproveConfirming ||
              totalRequired === 0n ||
              hasSufficientAllowance ||
              hasDeposited ||
              presaleHasEnded
            }
            className="btn-secondary flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isApprovePending || isApproveConfirming ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Approving...
              </span>
            ) : hasSufficientAllowance || hasDeposited ? (
              'Approved'
            ) : (
              `Approve ${formatUnits(totalRequired, saleTokenDecimals)} ${saleTokenSymbol}`
            )}
          </button>
          <button
            onClick={handleDepositTokens}
            disabled={
              isDepositPending ||
              isDepositConfirming ||
              saleAmount === 0n ||
              !hasSufficientAllowance ||
              hasDeposited ||
              presaleHasEnded
            }
            className="btn-primary flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isDepositPending || isDepositConfirming ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Depositing...
              </span>
            ) : hasDeposited ? (
              'Deposited'
            ) : (
              'Deposit Tokens'
            )}
          </button>
        </div>
      </motion.section>

      <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-4">
        <h2 className="font-display text-display-sm text-ink flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent" />
          Launch Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleFinalize}
            disabled={
              isOwnerPending ||
              isOwnerConfirming ||
              Boolean(presale.successfulFinalization || presale.claimEnabled || presale.refundsEnabled)
            }
            className="btn-primary inline-flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Finalize Launch
          </button>
          <button
            onClick={handleEnableClaims}
            disabled={
              isOwnerPending ||
              isOwnerConfirming ||
              Boolean(!presale.successfulFinalization || presale.claimEnabled || presale.refundsEnabled)
            }
            className="btn-secondary inline-flex items-center justify-center gap-2"
          >
            Enable Claims
          </button>
          <button
            onClick={handleCancel}
            disabled={
              isOwnerPending ||
              isOwnerConfirming ||
              Boolean(presale.successfulFinalization || presale.claimEnabled || presale.refundsEnabled)
            }
            className="btn-secondary inline-flex items-center justify-center gap-2 border-status-error text-status-error hover:bg-status-error/10"
          >
            <Ban className="w-4 h-4" />
            Cancel Launch
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-ink/10">
          <div className="space-y-3">
            <p className="text-body-sm font-medium text-ink">Withdraw Proceeds</p>
            <button
              onClick={handleWithdrawProceeds}
              disabled={isOwnerPending || isOwnerConfirming}
              className="btn-secondary w-full"
            >
              Withdraw Proceeds
            </button>
          </div>
          <div className="space-y-3">
            <p className="text-body-sm font-medium text-ink">Withdraw Unused Tokens</p>
            <button
              onClick={handleWithdrawTokens}
              disabled={isOwnerPending || isOwnerConfirming}
              className="btn-secondary w-full"
            >
              Withdraw Unused Sale Tokens
            </button>
          </div>
        </div>
      </motion.section>

      {presale.requiresWhitelist && (
        <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-5">
          <h2 className="font-display text-display-sm text-ink flex items-center gap-2">
            <Users className="w-5 h-5 text-accent" />
            Whitelist Management
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-body-sm text-ink-muted">Add Single Wallet</label>
              <input
                value={singleWhitelist}
                onChange={(event) => setSingleWhitelist(event.target.value)}
                placeholder="0x..."
                className="input-field font-mono"
              />
              <button
                onClick={handleAddSingle}
                disabled={isWhitelistPending || isWhitelistConfirming || !singleWhitelist}
                className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Add Wallet
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-body-sm text-ink-muted">Bulk Add</label>
              <textarea
                value={bulkWhitelist}
                onChange={(event) => setBulkWhitelist(event.target.value)}
                placeholder="Paste addresses separated by commas or line breaks"
                rows={5}
                className="input-field w-full font-mono text-sm resize-y"
              />
              <button
                onClick={handleBulkWhitelist}
                disabled={isWhitelistPending || isWhitelistConfirming || !bulkWhitelist.trim()}
                className="btn-secondary w-full disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Upload List
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-body-sm text-ink-muted">Remove Wallet</label>
              <input
                value={removeWhitelist}
                onChange={(event) => setRemoveWhitelist(event.target.value)}
                placeholder="0x..."
                className="input-field font-mono"
              />
              <button
                onClick={handleRemoveWhitelist}
                disabled={isWhitelistPending || isWhitelistConfirming || !removeWhitelist}
                className="btn-secondary w-full text-status-error border-status-error hover:bg-status-error/10 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Remove Wallet
              </button>
            </div>
          </div>
        </motion.section>
      )}
    </motion.div>
  );
};

export default ManagePresalePage;
