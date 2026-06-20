import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useChainId, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { isAddress, parseUnits, type Address } from 'viem';
import { PresaleFactory, erc20Abi, getContractAddresses } from '@/config';
import { useWhitelistedCreator } from '@/lib/hooks/useWhitelistedCreator';
import {
  Rocket,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  Info,
  Image as ImageIcon,
  Upload,
} from '@/components/ui/icons';
import { InlineLoading } from '@/components/ui/spinner';
import { Link, useSearchParams } from 'react-router-dom';
import FallbackImage from '@/components/ui/fallback-image';
import { toast } from 'sonner';
import {
  formatStage0ImageFileSize,
  getStage0ImageValidationError,
  uploadTokenImage,
} from '@/lib/api/media';
import RnsAddressInput from '@/components/rns/RnsAddressInput';

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

function formatDisplayRate(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return '';
  return rate.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

const CreatePresalePage: React.FC = () => {
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const [searchParams] = useSearchParams();

  const { isWhitelisted, isLoading: isCheckingWhitelist } = useWhitelistedCreator(userAddress);

  const querySaleToken = useMemo(() => {
    const tokenAddress = searchParams.get('token')?.trim();
    if (!tokenAddress || !isAddress(tokenAddress)) return '';
    return tokenAddress;
  }, [searchParams]);

  const queryTokenSymbol = useMemo(() => searchParams.get('symbol')?.trim() ?? '', [searchParams]);
  const queryTokenName = useMemo(() => searchParams.get('name')?.trim() ?? '', [searchParams]);

  const [saleToken, setSaleToken] = useState(querySaleToken);
  const [resolvedSaleToken, setResolvedSaleToken] = useState<Address | null>(null);
  const [projectImageFile, setProjectImageFile] = useState<File | null>(null);
  const [projectImagePreview, setProjectImagePreview] = useState('');
  const [projectImageMeta, setProjectImageMeta] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectWebsiteUrl, setProjectWebsiteUrl] = useState('');
  const [projectXUrl, setProjectXUrl] = useState('');
  const [projectTelegramUrl, setProjectTelegramUrl] = useState('');
  const [projectDiscordUrl, setProjectDiscordUrl] = useState('');
  const [paymentToken, setPaymentToken] = useState('');
  const [resolvedPaymentToken, setResolvedPaymentToken] = useState<Address | null>(null);
  const [useNativeToken, setUseNativeToken] = useState(true);
  const [hardCap, setHardCap] = useState('');
  const [softCap, setSoftCap] = useState('');
  const [minContribution, setMinContribution] = useState('');
  const [maxContribution, setMaxContribution] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saleAmount, setSaleAmount] = useState('');
  const [requiresWhitelist, setRequiresWhitelist] = useState(false);
  const uploadedProfileKeyRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (projectImagePreview) {
        URL.revokeObjectURL(projectImagePreview);
      }
    };
  }, [projectImagePreview]);

  const tokenMetadataContracts = useMemo(() => {
    if (!resolvedSaleToken) return undefined;
    return [
      { abi: erc20Abi, address: resolvedSaleToken, functionName: 'name' },
      { abi: erc20Abi, address: resolvedSaleToken, functionName: 'symbol' },
    ] as const;
  }, [resolvedSaleToken]);

  const paymentTokenMetadataContracts = useMemo(() => {
    if (useNativeToken || !resolvedPaymentToken) return undefined;
    return [
      { abi: erc20Abi, address: resolvedPaymentToken, functionName: 'symbol' },
    ] as const;
  }, [resolvedPaymentToken, useNativeToken]);

  const { data: tokenMetadataResults } = useReadContracts({
    contracts: tokenMetadataContracts,
    query: {
      enabled: Boolean(tokenMetadataContracts),
    },
  });

  const { data: paymentTokenMetadataResults } = useReadContracts({
    contracts: paymentTokenMetadataContracts,
    query: {
      enabled: Boolean(paymentTokenMetadataContracts),
    },
  });

  const detectedTokenName = tokenMetadataResults?.[0]?.result as string | undefined;
  const detectedTokenSymbol = tokenMetadataResults?.[1]?.result as string | undefined;
  const detectedPaymentTokenSymbol = paymentTokenMetadataResults?.[0]?.result as string | undefined;
  const resolvedTokenName = detectedTokenName ?? queryTokenName;
  const resolvedTokenSymbol = detectedTokenSymbol ?? queryTokenSymbol;
  const showResolvedTokenInfo = Boolean(resolvedTokenName || resolvedTokenSymbol);

  const calculatedRate = useMemo(() => {
    if (!saleAmount || !hardCap) return '';
    const sa = Number(saleAmount);
    const hc = Number(hardCap);
    if (!Number.isFinite(sa) || !Number.isFinite(hc) || hc <= 0) return '';
    return formatDisplayRate(sa / hc);
  }, [saleAmount, hardCap]);

  const saleTokenLabel = resolvedTokenSymbol || 'SALE';
  const paymentTokenLabel = useNativeToken ? 'NATIVE' : detectedPaymentTokenSymbol || 'PAYMENT';

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

  useEffect(() => {
    if (!isSuccess || !resolvedSaleToken) return;

    const profile = {
      description: projectDescription.trim(),
      websiteUrl: projectWebsiteUrl.trim(),
      xUrl: projectXUrl.trim(),
      telegramUrl: projectTelegramUrl.trim(),
      discordUrl: projectDiscordUrl.trim(),
    };
    const hasProfileInfo = Object.values(profile).some(Boolean);
    if (!projectImageFile && !hasProfileInfo) return;

    const uploadKey = [
      chainId,
      resolvedSaleToken.toLowerCase(),
      projectImageFile?.name ?? '',
      projectImageFile?.size ?? 0,
      projectImageFile?.lastModified ?? 0,
      profile.description,
      profile.websiteUrl,
      profile.xUrl,
      profile.telegramUrl,
      profile.discordUrl,
    ].join(':');

    if (uploadedProfileKeyRef.current === uploadKey) return;
    uploadedProfileKeyRef.current = uploadKey;

    uploadTokenImage({
      chainId,
      address: resolvedSaleToken,
      file: projectImageFile,
      profile,
    })
      .then(() => {
        toast.success('Launch profile saved.');
      })
      .catch((error) => {
        uploadedProfileKeyRef.current = null;
        const message = error instanceof Error ? error.message : 'Launch created, but profile upload failed.';
        toast.error(message);
      });
  }, [
    chainId,
    isSuccess,
    resolvedSaleToken,
    projectDescription,
    projectDiscordUrl,
    projectImageFile,
    projectTelegramUrl,
    projectWebsiteUrl,
    projectXUrl,
  ]);

  const handleSubmit = () => {
    if (!resolvedSaleToken || !hardCap || !softCap || !minContribution || !maxContribution || !startDate || !endDate || !saleAmount) return;

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
      : resolvedPaymentToken;

    if (!paymentAddr) return;

    writeContract({
      abi: PresaleFactory,
      address: contracts.presaleFactory,
      functionName: 'createPresale',
      args: [
        {
          saleToken: resolvedSaleToken,
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

  const handleProjectImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = getStage0ImageValidationError(file, 'launch image');
    if (validationError) {
      toast.error(validationError);
      event.target.value = '';
      return;
    }

    setProjectImageFile(file);
    setProjectImageMeta(`${file.name} · ${formatStage0ImageFileSize(file.size)}`);
    setProjectImagePreview(URL.createObjectURL(file));
  };

  const projectImagePreviewSrc = projectImagePreview;

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
          <h1 className="font-display text-display-lg text-ink">Create Launch</h1>
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
              Your wallet is not whitelisted to create launches. Please contact the Stage0 team
              to request creator access.
            </p>
          </div>
          <Link to="/presales" className="btn-secondary inline-flex items-center gap-2">
            Browse Launchpad
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
            <h2 className="font-display text-display-md text-ink">Launch Created!</h2>
            <p className="text-body text-ink-muted">
              Your launch has been deployed. Remember to deposit sale tokens before it starts.
            </p>
          </div>
          <div className="bg-ink/[0.03] rounded-2xl p-4">
            <p className="text-body-sm text-ink-muted mb-1">Launch Address</p>
            <code className="text-body font-mono text-ink break-all">
              {createdPresaleAddress}
            </code>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to={`/presales/${createdPresaleAddress}`}
              className="btn-primary inline-flex items-center gap-2"
            >
              View Launch <ExternalLink className="w-4 h-4" />
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
      <motion.section variants={itemVariants} className="page-hero-card">
        <div className="eyebrow">Token launch</div>
        <h1 className="ds-h1 mt-2">Create Launch</h1>
        <p className="text-body-lg text-ink-muted mt-3">
          Launch your token sale on Stage0. Configure your launch parameters below.
        </p>
      </motion.section>

      {isCheckingWhitelist && (
        <motion.div variants={itemVariants} className="flex items-center gap-2 text-ink-muted">
          <InlineLoading label="Checking whitelist status..." variant="dots" />
        </motion.div>
      )}

      {/* Form */}
      <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-6">
        <h2 className="font-display text-display-sm text-ink">Token Configuration</h2>

        <div className="space-y-1.5">
          <RnsAddressInput
            label="Sale Token Address"
            value={saleToken}
            onChange={setSaleToken}
            onResolvedAddressChange={setResolvedSaleToken}
            placeholder="0x... or token.rise"
            required
          />
          {showResolvedTokenInfo && (
            <p className="text-body-sm text-ink-muted">
              Token detected:{' '}
              <span className="text-ink font-medium">
                {resolvedTokenName || 'Unknown'}{resolvedTokenSymbol ? ` (${resolvedTokenSymbol})` : ''}
              </span>
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-border bg-canvas-alt/55 p-5 space-y-4">
          <div className="space-y-1">
            <h3 className="font-display text-xl font-semibold text-ink">Token Info</h3>
            <p className="text-body-sm text-ink-muted">
              App-level profile details for Stage0 surfaces. ERC20 contract data still comes from the deployed token.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-body-sm text-ink-muted font-medium">Description</label>
              <textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="A short intro for the token profile."
                className="input-field min-h-24 w-full resize-y"
                maxLength={1200}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-body-sm text-ink-muted font-medium">Website</label>
              <input
                type="url"
                value={projectWebsiteUrl}
                onChange={(e) => setProjectWebsiteUrl(e.target.value)}
                placeholder="https://example.xyz"
                className="input-field w-full"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-body-sm text-ink-muted font-medium">X / Twitter</label>
              <input
                type="url"
                value={projectXUrl}
                onChange={(e) => setProjectXUrl(e.target.value)}
                placeholder="https://x.com/stage0_"
                className="input-field w-full"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-body-sm text-ink-muted font-medium">Telegram</label>
              <input
                type="url"
                value={projectTelegramUrl}
                onChange={(e) => setProjectTelegramUrl(e.target.value)}
                placeholder="https://t.me/project"
                className="input-field w-full"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-body-sm text-ink-muted font-medium">Discord</label>
              <input
                type="url"
                value={projectDiscordUrl}
                onChange={(e) => setProjectDiscordUrl(e.target.value)}
                placeholder="https://discord.gg/project"
                className="input-field w-full"
              />
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-body-sm text-ink-muted font-medium">Launch Image</label>
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_9rem] gap-4">
              <label className="rounded-2xl border border-dashed border-border bg-canvas p-4 cursor-pointer hover:border-accent/40 transition-colors">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleProjectImageFileChange}
                  className="sr-only"
                />
                <span className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                    <Upload className="w-5 h-5" />
                  </span>
                  <span className="space-y-1">
                    <span className="block text-body-sm font-medium text-ink">Upload launch image</span>
                    <span className="block text-xs text-ink-faint">
                      PNG, JPG, or WebP up to 2MB. Stage0 saves this profile after deployment.
                    </span>
                    {projectImageMeta ? (
                      <span className="block text-xs text-ink-muted break-all">{projectImageMeta}</span>
                    ) : null}
                  </span>
                </span>
              </label>
              <div className="h-36 rounded-2xl border border-border bg-canvas overflow-hidden flex items-center justify-center">
                <FallbackImage
                  src={projectImagePreviewSrc}
                  alt="Launch image preview"
                  className="w-full h-full object-cover"
                  placeholder={<ImageIcon className="w-8 h-8 text-ink-faint" />}
                />
              </div>
            </div>
          </div>
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
            <RnsAddressInput
              label="Payment Token Address"
              value={paymentToken}
              onChange={setPaymentToken}
              onResolvedAddressChange={setResolvedPaymentToken}
              placeholder="0x... or token.rise"
              required
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
              Calculated rate: <strong>1 {paymentTokenLabel} = {calculatedRate} {saleTokenLabel}</strong>
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
            !resolvedSaleToken ||
            (!useNativeToken && !resolvedPaymentToken) ||
            !hardCap ||
            !softCap ||
            !startDate ||
            !endDate ||
            !saleAmount
          }
          className="btn-primary w-full"
        >
          {isPending || isConfirming ? (
            <InlineLoading label={isConfirming ? 'Confirming...' : 'Creating Launch...'} />
          ) : !isConnected ? (
            'Connect Wallet First'
          ) : (
            <span className="inline-flex items-center gap-2">
              <Rocket className="w-4 h-4" />
              Create Launch
            </span>
          )}
        </button>
      </motion.section>
    </motion.div>
  );
};

export default CreatePresalePage;
