import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, Zap, Loader2 } from 'lucide-react';
import { useAccount, useChainId, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits, maxUint256 } from 'viem';
import { StakingContract, erc20Abi, getStakingContractAddress } from '@/config';
import { toast } from 'sonner';
import { getFriendlyTxErrorMessage } from '@/lib/utils/tx-errors';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.3 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 40, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 1, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const RISE_ICON_URL = 'https://assets.coingecko.com/coins/images/68442/standard/rise.png?1755750505';
type TxAction = 'idle' | 'approveForStake' | 'stake' | 'unstake' | 'claim';

const Staking: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'stake' | 'unstake'>('stake');
  const [amount, setAmount] = useState('');
  const [txAction, setTxAction] = useState<TxAction>('idle');
  const [stakeAmountToSubmit, setStakeAmountToSubmit] = useState<bigint | null>(null);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const stakingAddress = getStakingContractAddress(chainId);

  // Read staking token address
  const { data: stakingTokenData } = useReadContracts({
    contracts: [
      { address: stakingAddress, abi: StakingContract, functionName: 'stakingToken' },
    ],
    query: { enabled: !!stakingAddress && stakingAddress !== '0x0000000000000000000000000000000000000000' },
  });

  const stakingToken = stakingTokenData?.[0]?.result as `0x${string}` | undefined;

  // Read balances
  const { data: balanceData, refetch: refetchBalances } = useReadContracts({
    contracts: [
      ...(stakingToken ? [
        { address: stakingToken, abi: erc20Abi, functionName: 'balanceOf', args: [address!] },
        { address: stakingToken, abi: erc20Abi, functionName: 'allowance', args: [address!, stakingAddress] },
        { address: stakingToken, abi: erc20Abi, functionName: 'symbol' },
      ] : []),
      { address: stakingAddress, abi: StakingContract, functionName: 'stakedBalanceOf', args: [address!] },
      { address: stakingAddress, abi: StakingContract, functionName: 'pendingReward', args: [address!] },
    ] as any[],
    query: { enabled: !!address && !!stakingToken },
  });

  const walletBalance = stakingToken && balanceData?.[0]?.result ? balanceData[0].result as bigint : 0n;
  const allowance = stakingToken && balanceData?.[1]?.result ? balanceData[1].result as bigint : 0n;
  const tokenSymbol = stakingToken && balanceData?.[2]?.result ? balanceData[2].result as string : 'RISE';
  const stakedBalance = balanceData?.[stakingToken ? 3 : 0]?.result as bigint ?? 0n;
  const pendingReward = balanceData?.[stakingToken ? 4 : 1]?.result as bigint ?? 0n;

  const parsedAmount = useMemo(() => {
    if (!amount) return null;
    try {
      const value = parseUnits(amount, 18);
      return value > 0n ? value : null;
    } catch {
      return null;
    }
  }, [amount]);

  const needsApproval = Boolean(
    activeTab === 'stake' &&
    parsedAmount &&
    allowance < parsedAmount
  );
  const hasValidAmount = Boolean(parsedAmount);

  // Write contract
  const { data: hash, writeContract, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (!isSuccess) return;

    if (txAction === 'approveForStake') {
      if (!stakeAmountToSubmit) {
        setTxAction('idle');
        reset();
        return;
      }

      setTxAction('stake');
      writeContract({
        address: stakingAddress,
        abi: StakingContract,
        functionName: 'stake',
        args: [stakeAmountToSubmit],
      });
      return;
    }

    if (txAction === 'stake') {
      toast.success('Stake transaction confirmed!');
      setAmount('');
    } else if (txAction === 'unstake') {
      toast.success('Unstake transaction confirmed!');
      setAmount('');
    } else if (txAction === 'claim') {
      toast.success('Rewards claimed successfully!');
    } else {
      toast.success('Transaction confirmed!');
    }

    setStakeAmountToSubmit(null);
    setTxAction('idle');
    reset();
    refetchBalances();
  }, [isSuccess, txAction, stakeAmountToSubmit, writeContract, stakingAddress, reset, refetchBalances]);

  useEffect(() => {
    if (error) {
      toast.error(getFriendlyTxErrorMessage(error));
      setStakeAmountToSubmit(null);
      setTxAction('idle');
      reset();
    }
  }, [error, reset]);

  const handleStakeFlow = () => {
    if (!stakingToken || !parsedAmount) {
      toast.error('Enter a valid amount to stake.');
      return;
    }

    setStakeAmountToSubmit(parsedAmount);

    if (allowance < parsedAmount) {
      setTxAction('approveForStake');
      writeContract({
        address: stakingToken,
        abi: erc20Abi,
        functionName: 'approve',
        args: [stakingAddress, maxUint256],
      });
      return;
    }

    setTxAction('stake');
    writeContract({
      address: stakingAddress,
      abi: StakingContract,
      functionName: 'stake',
      args: [parsedAmount],
    });
  };

  const handleUnstake = () => {
    if (!parsedAmount) {
      toast.error('Enter a valid amount to unstake.');
      return;
    }
    setTxAction('unstake');
    writeContract({
      address: stakingAddress,
      abi: StakingContract,
      functionName: 'withdraw',
      args: [parsedAmount],
    });
  };

  const handleClaim = () => {
    setTxAction('claim');
    writeContract({
      address: stakingAddress,
      abi: StakingContract,
      functionName: 'getReward',
    });
  };

  const getStakeButtonLabel = () => {
    if (txAction === 'approveForStake') {
      if (isPending) return `Confirm ${tokenSymbol} approval...`;
      if (isConfirming) return 'Waiting for approval confirmation...';
      return `Approve ${tokenSymbol}`;
    }

    if (txAction === 'stake') {
      if (isPending) return 'Confirm stake in wallet...';
      if (isConfirming) return 'Waiting for stake confirmation...';
      return 'Stake';
    }

    return needsApproval ? `Approve + Stake` : 'Stake';
  };

  const isLoading = isPending || isConfirming;
  const isZeroAddress = stakingAddress === '0x0000000000000000000000000000000000000000';

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-12"
    >
      <motion.section variants={itemVariants} className="space-y-1">
        <div className="flex items-center gap-3">
          <img
            src={RISE_ICON_URL}
            alt="Rise token"
            className="w-9 h-9 rounded-full"
          />
          <h1 className="font-display text-display-lg text-ink">Stake Rise</h1>
        </div>
        <p className="text-body-lg text-ink-muted">Stake your tokens to earn rewards and unlock IDO allocations.</p>
      </motion.section>

      {isZeroAddress ? (
        <motion.section variants={itemVariants}>
          <div className="bg-canvas-alt rounded-3xl border border-border p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-canvas-alt flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-ink-muted" />
            </div>
            <h3 className="font-display text-display-sm text-ink mb-2">Staking Coming Soon</h3>
            <p className="text-body text-ink-muted max-w-md mx-auto">
              Staking contracts are being deployed on this network. Check back soon.
            </p>
          </div>
        </motion.section>
      ) : (
        <>
          {/* Stats */}
          <motion.section variants={itemVariants}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="stat-card">
                <div className="flex items-start justify-between mb-6">
                  <span className="text-label text-ink-faint uppercase">Wallet Balance</span>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-canvas-alt text-ink-muted">
                    <Wallet className="w-5 h-5" />
                  </div>
                </div>
                <p className="font-display text-display-md text-ink font-mono">
                  {isConnected ? formatUnits(walletBalance, 18) : '—'}
                </p>
                <p className="text-body-sm text-ink-faint mt-1">{tokenSymbol}</p>
              </div>
              <div className="stat-card">
                <div className="flex items-start justify-between mb-6">
                  <span className="text-label text-ink-faint uppercase">Staked</span>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-canvas-alt text-ink-muted">
                    <Zap className="w-5 h-5" />
                  </div>
                </div>
                <p className="font-display text-display-md text-ink font-mono">
                  {isConnected ? formatUnits(stakedBalance, 18) : '—'}
                </p>
                <p className="text-body-sm text-ink-faint mt-1">{tokenSymbol}</p>
              </div>
              <div className="stat-card">
                <div className="flex items-start justify-between mb-6">
                  <span className="text-label text-ink-faint uppercase">Pending Rewards</span>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-accent-muted text-accent">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <p className="font-display text-display-md text-accent-gradient font-mono" style={{ textShadow: '0 0 12px rgba(255,138,0,0.25)' }}>
                  {isConnected ? formatUnits(pendingReward, 18) : '—'}
                </p>
                <p className="text-body-sm text-ink-faint mt-1">{tokenSymbol}</p>
              </div>
            </div>
          </motion.section>

          {/* Staking Form */}
          <motion.section variants={itemVariants}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-canvas-alt rounded-3xl border border-border p-8 space-y-6">
                {/* Tabs */}
                <div className="flex gap-2 p-1 bg-canvas-alt rounded-xl">
                  <button
                    onClick={() => { setActiveTab('stake'); setAmount(''); }}
                    className={`flex-1 py-2.5 rounded-lg text-body-sm font-medium transition-all duration-300 ${
                      activeTab === 'stake' ? 'bg-canvas text-ink shadow-subtle' : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    Stake
                  </button>
                  <button
                    onClick={() => { setActiveTab('unstake'); setAmount(''); }}
                    className={`flex-1 py-2.5 rounded-lg text-body-sm font-medium transition-all duration-300 ${
                      activeTab === 'unstake' ? 'bg-canvas text-ink shadow-subtle' : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    Unstake
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-label text-ink-faint uppercase">
                      Amount to {activeTab === 'stake' ? 'Stake' : 'Unstake'}
                    </label>
                    <button
                      onClick={() => setAmount(
                        formatUnits(activeTab === 'stake' ? walletBalance : stakedBalance, 18)
                      )}
                      className="text-label text-accent hover:text-accent-hover transition-colors"
                    >
                      MAX
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="input-field font-mono pr-20"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-body-sm text-ink-muted">
                      {tokenSymbol}
                    </span>
                  </div>
                </div>

                {activeTab === 'stake' ? (
                  <button
                    onClick={handleStakeFlow}
                    disabled={isLoading || !hasValidAmount}
                    className="btn-primary w-full"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {getStakeButtonLabel()}
                  </button>
                ) : (
                  <button
                    onClick={handleUnstake}
                    disabled={isLoading || !hasValidAmount}
                    className="btn-primary w-full"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Unstake
                  </button>
                )}
              </div>

              {/* Claim Rewards */}
              <div className="bg-canvas-alt rounded-3xl border border-border p-8 space-y-6">
                <h2 className="font-display text-display-sm text-ink">Claim Rewards</h2>
                <p className="text-body text-ink-muted">
                  You have{' '}
                  <span className="font-mono font-medium text-ink">
                    {formatUnits(pendingReward, 18)}
                  </span>{' '}
                  {tokenSymbol} in pending rewards.
                </p>
                <button
                  onClick={handleClaim}
                  disabled={isLoading || pendingReward === 0n}
                  className="btn-primary w-full"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Claim Rewards
                </button>
              </div>
            </div>
          </motion.section>
        </>
      )}
    </motion.div>
  );
};

export default Staking;
