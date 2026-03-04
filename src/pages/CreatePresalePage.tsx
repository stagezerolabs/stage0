import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, type Address } from 'viem';
import { PresaleFactory, getContractAddresses } from '@/config';
import { useWhitelistedCreator } from '@/lib/hooks/useWhitelistedCreator';
import {
  Rocket,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  Info,
} from 'lucide-react';
import { Link } from 'react-router-dom';

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

const RATE_DIVISOR = 100;

const CreatePresalePage: React.FC = () => {
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  const { isWhitelisted, isLoading: isCheckingWhitelist } = useWhitelistedCreator(userAddress);

  const [saleToken, setSaleToken] = useState('');
  const [paymentToken, setPaymentToken] = useState('');
  const [useNativeToken, setUseNativeToken] = useState(true);
  const [hardCap, setHardCap] = useState('');
  const [softCap, setSoftCap] = useState('');
  const [minContribution, setMinContribution] = useState('');
  const [maxContribution, setMaxContribution] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saleAmount, setSaleAmount] = useState('');
  const [requiresWhitelist, setRequiresWhitelist] = useState(false);

  const calculatedRate = useMemo(() => {
    if (!saleAmount || !hardCap) return '';
    const sa = parseFloat(saleAmount);
    const hc = parseFloat(hardCap);
    if (hc === 0) return '';
    return ((sa * RATE_DIVISOR) / hc).toFixed(2);
  }, [saleAmount, hardCap]);

  const {
    data: hash,
    writeContract,
    isPending,
    error: writeError,
    reset,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash });

  const createdPresaleAddress = useMemo(() => {
    if (!isSuccess || !receipt?.logs) return null;
    for (const log of receipt.logs) {
      if (log.topics.length >= 3) {
        const addr = `0x${log.topics[2]?.slice(26)}`;
        if (addr && addr.length === 42) return addr;
      }
    }
    return null;
  }, [isSuccess, receipt]);

  const handleSubmit = () => {
    if (!saleToken || !hardCap || !softCap || !minContribution || !maxContribution || !startDate || !endDate || !saleAmount) return;

    const startTimestamp = BigInt(Math.floor(new Date(startDate).getTime() / 1000));
    const endTimestamp = BigInt(Math.floor(new Date(endDate).getTime() / 1000));

    const hcParsed = parseUnits(hardCap, 18);
    const scParsed = parseUnits(softCap, 18);
    const minC = parseUnits(minContribution, 18);
    const maxC = parseUnits(maxContribution, 18);

    const sa = parseFloat(saleAmount);
    const hc = parseFloat(hardCap);
    const rate = BigInt(Math.floor((sa * RATE_DIVISOR) / hc));

    const paymentAddr = useNativeToken
      ? '0x0000000000000000000000000000000000000000' as Address
      : paymentToken as Address;

    writeContract({
      abi: PresaleFactory,
      address: contracts.presaleFactory,
      functionName: 'createPresale',
      args: [
        {
          saleToken: saleToken as Address,
          paymentToken: paymentAddr,
          config: {
            startTime: startTimestamp,
            endTime: endTimestamp,
            rate,
            softCap: scParsed,
            hardCap: hcParsed,
            minContribution: minC,
            maxContribution: maxC,
          },
          owner: userAddress as Address,
          requiresWhitelist,
        },
      ],
    });
  };

  // Not whitelisted
  if (isConnected && !isCheckingWhitelist && isWhitelisted === false) {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-2xl mx-auto space-y-8"
      >
        <motion.section variants={itemVariants} className="space-y-2">
          <h1 className="font-display text-display-lg text-ink">Create Presale</h1>
        </motion.section>
        <motion.div
          variants={itemVariants}
          className="glass-card rounded-3xl p-8 text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-full bg-status-upcoming-bg text-status-upcoming mx-auto flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-display-md text-ink">Not Whitelisted</h2>
            <p className="text-body text-ink-muted max-w-md mx-auto">
              Your wallet is not whitelisted to create presales. Please contact the Stage0 team
              to request creator access.
            </p>
          </div>
          <Link to="/presales" className="btn-secondary inline-flex items-center gap-2">
            Browse Presales
          </Link>
        </motion.div>
      </motion.div>
    );
  }

  // Success
  if (isSuccess && createdPresaleAddress) {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-2xl mx-auto space-y-8"
      >
        <motion.div
          variants={itemVariants}
          className="glass-card rounded-3xl p-8 text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-full bg-status-live-bg text-status-live mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-display-md text-ink">Presale Created!</h2>
            <p className="text-body text-ink-muted">
              Your presale has been deployed. Remember to deposit sale tokens before it starts.
            </p>
          </div>
          <div className="bg-ink/[0.03] rounded-2xl p-4">
            <p className="text-body-sm text-ink-muted mb-1">Presale Address</p>
            <code className="text-body font-mono text-ink break-all">
              {createdPresaleAddress}
            </code>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to={`/presales/${createdPresaleAddress}`}
              className="btn-primary inline-flex items-center gap-2"
            >
              View Presale <ExternalLink className="w-4 h-4" />
            </Link>
            <button
              onClick={() => {
                reset();
              }}
              className="btn-secondary"
            >
              Create Another
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-3xl mx-auto space-y-8"
    >
      {/* Header */}
      <motion.section variants={itemVariants} className="space-y-2">
        <h1 className="font-display text-display-lg text-ink">Create Presale</h1>
        <p className="text-body-lg text-ink-muted">
          Launch your token sale on Stage0. Configure your presale parameters below.
        </p>
      </motion.section>

      {isCheckingWhitelist && (
        <motion.div variants={itemVariants} className="flex items-center gap-2 text-ink-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-body-sm">Checking whitelist status...</span>
        </motion.div>
      )}

      {/* Form */}
      <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-6">
        <h2 className="font-display text-display-sm text-ink">Token Configuration</h2>

        <div className="space-y-1.5">
          <label className="text-body-sm text-ink-muted font-medium">Sale Token Address</label>
          <input
            type="text"
            value={saleToken}
            onChange={(e) => setSaleToken(e.target.value)}
            placeholder="0x..."
            className="input-field w-full font-mono text-sm"
          />
        </div>

        {/* Native Token Toggle */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-body-sm text-ink-muted font-medium">Payment Token</label>
            <button
              onClick={() => setUseNativeToken(!useNativeToken)}
              className="inline-flex items-center gap-2 text-body-sm text-accent"
            >
              {useNativeToken ? (
                <ToggleRight className="w-5 h-5" />
              ) : (
                <ToggleLeft className="w-5 h-5" />
              )}
              {useNativeToken ? 'Native Token' : 'ERC20'}
            </button>
          </div>
          {!useNativeToken && (
            <input
              type="text"
              value={paymentToken}
              onChange={(e) => setPaymentToken(e.target.value)}
              placeholder="Payment token address (0x...)"
              className="input-field w-full font-mono text-sm"
            />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-body-sm text-ink-muted font-medium">Hard Cap</label>
            <input
              type="text"
              value={hardCap}
              onChange={(e) => setHardCap(e.target.value)}
              placeholder="e.g. 100"
              className="input-field w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-body-sm text-ink-muted font-medium">Soft Cap</label>
            <input
              type="text"
              value={softCap}
              onChange={(e) => setSoftCap(e.target.value)}
              placeholder="e.g. 50"
              className="input-field w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-body-sm text-ink-muted font-medium">Min Contribution</label>
            <input
              type="text"
              value={minContribution}
              onChange={(e) => setMinContribution(e.target.value)}
              placeholder="e.g. 0.1"
              className="input-field w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-body-sm text-ink-muted font-medium">Max Contribution</label>
            <input
              type="text"
              value={maxContribution}
              onChange={(e) => setMaxContribution(e.target.value)}
              placeholder="e.g. 10"
              className="input-field w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-body-sm text-ink-muted font-medium">Start Date &amp; Time</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-body-sm text-ink-muted font-medium">End Date &amp; Time</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field w-full"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-body-sm text-ink-muted font-medium">
            Sale Amount (total tokens for sale)
          </label>
          <input
            type="text"
            value={saleAmount}
            onChange={(e) => setSaleAmount(e.target.value)}
            placeholder="e.g. 1000000"
            className="input-field w-full"
          />
        </div>

        {/* Auto-calculated Rate */}
        {calculatedRate && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-accent/5 text-accent text-sm">
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>
              Calculated rate: <strong>{calculatedRate}</strong> tokens per {RATE_DIVISOR} payment tokens
              (RATE_DIVISOR = {RATE_DIVISOR})
            </span>
          </div>
        )}

        {/* Whitelist Toggle */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-ink/[0.02]">
          <div>
            <p className="text-body font-medium text-ink">Require Whitelist</p>
            <p className="text-body-sm text-ink-muted">
              Only whitelisted addresses can participate.
            </p>
          </div>
          <button
            onClick={() => setRequiresWhitelist(!requiresWhitelist)}
            className="text-accent"
          >
            {requiresWhitelist ? (
              <ToggleRight className="w-8 h-8" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-ink-muted" />
            )}
          </button>
        </div>

        {/* Error */}
        {writeError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-status-error-bg text-status-error text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>{writeError.message?.slice(0, 200) || 'Transaction failed'}</p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={
            isPending ||
            isConfirming ||
            !isConnected ||
            !saleToken ||
            !hardCap ||
            !softCap ||
            !startDate ||
            !endDate ||
            !saleAmount
          }
          className="btn-primary w-full"
        >
          {isPending || isConfirming ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {isConfirming ? 'Confirming...' : 'Creating Presale...'}
            </span>
          ) : !isConnected ? (
            'Connect Wallet First'
          ) : (
            <span className="inline-flex items-center gap-2">
              <Rocket className="w-4 h-4" />
              Create Presale
            </span>
          )}
        </button>
      </motion.section>
    </motion.div>
  );
};

export default CreatePresalePage;
