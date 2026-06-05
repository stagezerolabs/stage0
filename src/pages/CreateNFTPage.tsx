import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAccount, useChainId, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { decodeEventLog, isAddress, parseEther, type Address } from 'viem';
import { NFTFactory, getContractAddresses, getExplorerUrl } from '@/config';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  Image,
  Layers,
  Loader2,
  Upload,
} from '@/components/ui/icons';
import { format, isSameDay, setHours, setMinutes, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import { getFriendlyTxErrorMessage } from '@/lib/utils/tx-errors';
import { normalizeBaseURI } from '@/lib/utils/ipfs';
import {
  formatStage0ImageFileSize,
  getStage0ImageValidationError,
  uploadCollectionImage,
} from '@/lib/api/media';
import FallbackImage from '@/components/ui/fallback-image';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

type NFTMode = 'erc721' | 'erc721a';
type ValidationResult = { valid: true } | { valid: false; message: string };

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;
const TIME_STEP_MINUTES = 15;

function parseDateTimeInput(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed / 1000);
}

function dateTimeValueToDate(value: string): Date | null {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function dateToLocalDateTimeValue(date: Date | null): string {
  if (!date) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatPreviewDate(value: string): string {
  const ts = parseDateTimeInput(value);
  return ts ? new Date(ts * 1000).toLocaleString() : 'Not set';
}

function roundDateToTimeStep(date: Date): Date {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const minutes = rounded.getMinutes();
  const remainder = minutes % TIME_STEP_MINUTES;
  if (remainder !== 0) {
    rounded.setMinutes(minutes + (TIME_STEP_MINUTES - remainder));
  }
  return rounded;
}

function combineDateAndTime(baseDate: Date, timeValue: string): Date {
  const [hoursString = '0', minutesString = '0'] = timeValue.split(':');
  return setMinutes(setHours(new Date(baseDate), Number(hoursString)), Number(minutesString));
}

function clampToMinDate(date: Date, minDate?: Date | null): Date {
  if (!minDate) return date;
  return date.getTime() < minDate.getTime() ? new Date(minDate) : date;
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('Failed to read image dimensions.'));
      img.src = objectUrl;
    });
    return dimensions;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

type DateTimePickerFieldProps = {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  placeholder: string;
  disabled?: boolean;
  minDate?: Date | null;
};

const DateTimePickerField: React.FC<DateTimePickerFieldProps> = ({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  minDate,
}) => {
  const timeInputId = React.useId();
  const selectedDate = dateTimeValueToDate(value);
  const minCalendarDate = minDate ? startOfDay(minDate) : undefined;
  const timeValue = selectedDate ? format(selectedDate, 'HH:mm') : '';
  const timeMin = selectedDate && minDate && isSameDay(selectedDate, minDate) ? format(minDate, 'HH:mm') : undefined;

  const handleDateSelect = (nextDate: Date | undefined) => {
    if (!nextDate) {
      onChange('');
      return;
    }

    const baseDate = selectedDate ?? roundDateToTimeStep(minDate ?? new Date());
    const merged = setMinutes(setHours(new Date(nextDate), baseDate.getHours()), baseDate.getMinutes());
    onChange(dateToLocalDateTimeValue(clampToMinDate(merged, minDate)));
  };

  const handleTimeChange = (nextTime: string) => {
    if (!nextTime) return;
    const baseDate = selectedDate ?? minDate ?? roundDateToTimeStep(new Date());
    onChange(dateToLocalDateTimeValue(clampToMinDate(combineDateAndTime(baseDate, nextTime), minDate)));
  };

  return (
    <div className="space-y-1.5">
      <label className="text-body-sm text-ink-muted font-medium">{label}</label>
      <Popover>
        <PopoverTrigger asChild disabled={disabled}>
          <button
            type="button"
            className="create-nft-date-trigger disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
              <span className={`create-nft-date-trigger-text ${selectedDate ? 'text-ink' : 'text-ink-faint'}`}>
                {selectedDate ? format(selectedDate, 'MMM d, yyyy · h:mm a') : placeholder}
              </span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          sideOffset={10}
          collisionPadding={16}
          className="create-nft-datetime-popover"
        >
          <Calendar
            mode="single"
            selected={selectedDate ?? undefined}
            onSelect={handleDateSelect}
            disabled={minCalendarDate ? { before: minCalendarDate } : undefined}
          />
          <div className="create-nft-time-panel">
            <div className="create-nft-time-row">
              <label htmlFor={timeInputId} className="create-nft-time-label">
                <Clock3 className="h-3.5 w-3.5" />
                <span>Time</span>
              </label>
              <input
                id={timeInputId}
                type="time"
                step={TIME_STEP_MINUTES * 60}
                value={timeValue}
                min={timeMin}
                disabled={disabled || !selectedDate}
                onChange={(event) => handleTimeChange(event.target.value)}
                className="create-nft-time-input disabled:cursor-not-allowed disabled:opacity-55"
              />
            </div>
            {!selectedDate ? (
              <p className="mt-2 text-center text-[11px] text-ink-faint">Pick a date first, then set the time.</p>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

const CreateNFTPage: React.FC = () => {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { nftFactory } = getContractAddresses(chainId);
  const explorerUrl = getExplorerUrl(chainId);

  const [mode, setMode] = useState<NFTMode>('erc721');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [baseURI, setBaseURI] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [collectionWebsiteUrl, setCollectionWebsiteUrl] = useState('');
  const [collectionXUrl, setCollectionXUrl] = useState('');
  const [collectionTelegramUrl, setCollectionTelegramUrl] = useState('');
  const [collectionDiscordUrl, setCollectionDiscordUrl] = useState('');
  const [collectionImageFile, setCollectionImageFile] = useState<File | null>(null);
  const [collectionImagePreview, setCollectionImagePreview] = useState('');
  const [collectionImageMeta, setCollectionImageMeta] = useState<string>('');
  const [collectionImageName, setCollectionImageName] = useState('');
  const [collectionImageDragActive, setCollectionImageDragActive] = useState(false);
  const [maxSupply, setMaxSupply] = useState('');
  const [walletLimit, setWalletLimit] = useState('');
  const [payoutWallet, setPayoutWallet] = useState('');
  const [saleStart, setSaleStart] = useState('');
  const [saleEnd, setSaleEnd] = useState('');
  const [mintPrice, setMintPrice] = useState('');
  const [whitelistEnabled, setWhitelistEnabled] = useState(false);
  const [whitelistStart, setWhitelistStart] = useState('');
  const [whitelistPrice, setWhitelistPrice] = useState('');
  const [createdCollectionAddress, setCreatedCollectionAddress] = useState<string | null>(null);
  const [showPostDeployPopup, setShowPostDeployPopup] = useState(false);
  const collectionImageInputRef = useRef<HTMLInputElement | null>(null);
  const uploadedCollectionImageKeyRef = useRef<string | null>(null);

  const {
    data: hash,
    writeContract,
    isPending,
    error: writeError,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (!writeError) return;
    toast.error(getFriendlyTxErrorMessage(writeError, 'Create NFT'));
  }, [writeError]);

  useEffect(() => {
    if (!isSuccess || !receipt?.logs || createdCollectionAddress) return;

    let deployedAddress: string | null = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== nftFactory.toLowerCase()) continue;

      try {
        const decoded = decodeEventLog({
          abi: NFTFactory,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === 'NFTCreated') {
          const args = decoded.args as { nft?: Address };
          if (args.nft) {
            deployedAddress = args.nft;
            break;
          }
        }
      } catch {
        if (log.topics.length > 2 && log.topics[2]?.length === 66) {
          deployedAddress = `0x${log.topics[2].slice(26)}`;
          break;
        }
      }
    }

    if (deployedAddress) {
      setCreatedCollectionAddress(deployedAddress);
      setShowPostDeployPopup(true);
      toast.success('NFT collection deployed successfully. Review the launch checklist next.');
    }
  }, [isSuccess, receipt, nftFactory, createdCollectionAddress]);

  useEffect(() => {
    if (!createdCollectionAddress) return;

    const profile = {
      description: collectionDescription.trim(),
      websiteUrl: collectionWebsiteUrl.trim(),
      xUrl: collectionXUrl.trim(),
      telegramUrl: collectionTelegramUrl.trim(),
      discordUrl: collectionDiscordUrl.trim(),
    };
    const hasProfileInfo = Object.values(profile).some(Boolean);
    if (!collectionImageFile && !hasProfileInfo) return;

    const uploadKey = [
      chainId,
      createdCollectionAddress.toLowerCase(),
      collectionImageFile?.name ?? '',
      collectionImageFile?.size ?? 0,
      collectionImageFile?.lastModified ?? 0,
      profile.description,
      profile.websiteUrl,
      profile.xUrl,
      profile.telegramUrl,
      profile.discordUrl,
    ].join(':');

    if (uploadedCollectionImageKeyRef.current === uploadKey) return;
    uploadedCollectionImageKeyRef.current = uploadKey;

    uploadCollectionImage({
      chainId,
      address: createdCollectionAddress as Address,
      file: collectionImageFile,
      profile,
    })
      .then(() => {
        toast.success('Collection profile saved for Stage0.');
      })
      .catch((error) => {
        uploadedCollectionImageKeyRef.current = null;
        const message = error instanceof Error ? error.message : 'Collection deployed, but profile upload failed.';
        toast.error(message);
      });
  }, [
    chainId,
    collectionDescription,
    collectionDiscordUrl,
    collectionImageFile,
    collectionTelegramUrl,
    collectionWebsiteUrl,
    collectionXUrl,
    createdCollectionAddress,
  ]);

  useEffect(() => {
    if (!whitelistEnabled || whitelistStart || !saleStart) return;

    const saleStartMs = new Date(saleStart).getTime();
    if (!Number.isFinite(saleStartMs)) return;

    const suggested = new Date(saleStartMs - 60 * 60 * 1000);
    if (!Number.isFinite(suggested.getTime()) || suggested.getTime() <= 0) return;

    setWhitelistStart(dateToLocalDateTimeValue(suggested));
  }, [whitelistEnabled, whitelistStart, saleStart]);

  useEffect(() => {
    return () => {
      if (collectionImagePreview) {
        URL.revokeObjectURL(collectionImagePreview);
      }
    };
  }, [collectionImagePreview]);

  const validation = useMemo<ValidationResult>(() => {
    if (!isConnected) return { valid: false, message: 'Connect your wallet to deploy.' };
    if (!name.trim()) return { valid: false, message: 'Collection name is required.' };
    if (!symbol.trim()) return { valid: false, message: 'Collection symbol is required.' };
    const normalizedBaseUri = normalizeBaseURI(baseURI.trim());
    if (!normalizedBaseUri) return { valid: false, message: 'Base URI is required.' };
    if (!maxSupply.trim()) return { valid: false, message: 'Max supply is required.' };
    if (!mintPrice.trim()) return { valid: false, message: 'Public mint price is required.' };
    if (!saleStart) return { valid: false, message: 'Public sale start is required.' };
    if (!saleEnd) return { valid: false, message: 'Sale end is required.' };

    const maxSupplyNumber = Number(maxSupply);
    if (!Number.isInteger(maxSupplyNumber) || maxSupplyNumber <= 0) {
      return { valid: false, message: 'Max supply must be a positive whole number.' };
    }

    try {
      parseEther(mintPrice.trim());
    } catch {
      return { valid: false, message: 'Public mint price is invalid.' };
    }

    if (walletLimit.trim()) {
      const limit = Number(walletLimit);
      if (!Number.isInteger(limit) || limit < 0 || limit > 4_294_967_295) {
        return { valid: false, message: 'Wallet limit must be between 0 and 4,294,967,295.' };
      }
    }

    if (payoutWallet.trim() && !isAddress(payoutWallet.trim())) {
      return { valid: false, message: 'Payout wallet must be a valid address.' };
    }

    const saleStartTs = parseDateTimeInput(saleStart);
    if (!saleStartTs) return { valid: false, message: 'Public sale start is invalid.' };

    const saleEndTs = parseDateTimeInput(saleEnd);
    if (!saleEndTs) return { valid: false, message: 'Sale end is invalid.' };
    if (saleEndTs <= saleStartTs) {
      return { valid: false, message: 'Sale end must be later than the public sale start.' };
    }

    if (whitelistEnabled) {
      if (!whitelistStart) {
        return { valid: false, message: 'Whitelist start is required when whitelist minting is enabled.' };
      }
      if (!whitelistPrice.trim()) {
        return { valid: false, message: 'Whitelist price is required when whitelist minting is enabled.' };
      }

      const whitelistStartTs = parseDateTimeInput(whitelistStart);
      if (!whitelistStartTs) return { valid: false, message: 'Whitelist start is invalid.' };
      if (whitelistStartTs >= saleStartTs) {
        return { valid: false, message: 'Whitelist mint must begin before the public sale starts.' };
      }
      if (whitelistStartTs >= saleEndTs) {
        return { valid: false, message: 'Whitelist mint must begin before the sale ends.' };
      }

      try {
        parseEther(whitelistPrice.trim());
      } catch {
        return { valid: false, message: 'Whitelist price is invalid.' };
      }
    }

    return { valid: true };
  }, [
    isConnected,
    name,
    symbol,
    baseURI,
    maxSupply,
    mintPrice,
    walletLimit,
    payoutWallet,
    saleStart,
    saleEnd,
    whitelistEnabled,
    whitelistStart,
    whitelistPrice,
  ]);

  const handleSubmit = () => {
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }

    const saleStartTs = parseDateTimeInput(saleStart);
    const saleEndTs = parseDateTimeInput(saleEnd);
    const whitelistStartTs = whitelistEnabled ? parseDateTimeInput(whitelistStart) : null;
    const normalizedBaseUri = normalizeBaseURI(baseURI.trim());
    const walletLimitValue = walletLimit.trim() ? Number(walletLimit) : 0;

    if (!saleStartTs || !saleEndTs) {
      toast.error('Sale dates are invalid.');
      return;
    }

    if (whitelistEnabled && !whitelistStartTs) {
      toast.error('Whitelist start is invalid.');
      return;
    }

    if (!normalizedBaseUri) {
      toast.error('Base URI is invalid.');
      return;
    }

    const functionName: 'createETHNFT' | 'create721AETHnFT' =
      mode === 'erc721a' ? 'create721AETHnFT' : 'createETHNFT';

    try {
      writeContract({
        abi: NFTFactory,
        address: nftFactory,
        functionName,
        args: [
          {
            name: name.trim(),
            symbol: symbol.trim(),
            baseURI: normalizedBaseUri,
            contractURI: '',
            whitelistConfig: {
              enabled: whitelistEnabled,
              whitelistStart: BigInt(whitelistStartTs ?? 0),
              whitelistPrice: whitelistEnabled ? parseEther(whitelistPrice.trim()) : 0n,
            },
            maxSupply: BigInt(maxSupply),
            payoutWallet: payoutWallet.trim() ? (payoutWallet.trim() as Address) : ZERO_ADDRESS,
            mintConfig: {
              saleStart: BigInt(saleStartTs),
              saleEnd: BigInt(saleEndTs),
              walletLimit: walletLimitValue,
              price: parseEther(mintPrice.trim()),
            },
          },
        ],
      });
    } catch {
      toast.error('Invalid NFT deployment configuration. Please review your inputs.');
    }
  };

  const setCollectionImageFromFile = async (file: File | undefined | null) => {
    if (!file) return;

    const validationError = getStage0ImageValidationError(file, 'collection image');
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const dimensions = await getImageDimensions(file);
    const detailParts = [formatStage0ImageFileSize(file.size)];
    if (dimensions) {
      detailParts.push(`${dimensions.width}×${dimensions.height}`);
      if (dimensions.width !== dimensions.height) {
        detailParts.push('square recommended');
      } else {
        detailParts.push('square');
      }
    }

    setCollectionImageFile(file);
    setCollectionImageName(file.name);
    setCollectionImageMeta(detailParts.join(' · '));
    setCollectionImagePreview(URL.createObjectURL(file));
  };

  const handleCollectionImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    await setCollectionImageFromFile(file);
    if (!file) {
      return;
    }
  };

  const handleCollectionImageDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setCollectionImageDragActive(false);
    const file = event.dataTransfer.files?.[0];
    await setCollectionImageFromFile(file);
  };

  const saleModel = whitelistEnabled ? 'Whitelist + Public' : 'Public Only';
  const walletLimitLabel = walletLimit.trim() && Number(walletLimit) > 0 ? walletLimit : 'Unlimited';
  const collectionImagePreviewSrc = collectionImagePreview;
  const saleStartDate = dateTimeValueToDate(saleStart);

  if (isSuccess && createdCollectionAddress) {
    return (
      <>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-2xl mx-auto space-y-8"
        >
          <motion.div variants={itemVariants} className="glass-card rounded-3xl p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-status-live-bg text-status-live mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="font-display text-display-md text-ink">NFT Collection Created</h2>
              <p className="text-body text-ink-muted">
                Your {mode === 'erc721a' ? 'ERC721A' : 'ERC721'} collection is live onchain.
              </p>
            </div>
            <div className="bg-ink/[0.03] rounded-2xl p-4">
              <p className="text-body-sm text-ink-muted mb-1">Collection Address</p>
              <code className="text-body font-mono text-ink break-all">{createdCollectionAddress}</code>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={`${explorerUrl}/address/${createdCollectionAddress}`}
                target="_blank"
                rel="noreferrer"
                className="btn-primary inline-flex items-center gap-2"
              >
                View on Explorer <ExternalLink className="w-4 h-4" />
              </a>
              <Link to={`/nfts/manage/${createdCollectionAddress}`} className="btn-secondary inline-flex items-center gap-2">
                Manage Collection
              </Link>
              <button
                onClick={() => {
                  setCreatedCollectionAddress(null);
                  setShowPostDeployPopup(false);
                  reset();
                }}
                className="btn-secondary"
              >
                Create Another
              </button>
            </div>
          </motion.div>
        </motion.div>

        {showPostDeployPopup && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm px-4 flex items-center justify-center">
            <div className="glass-card rounded-3xl p-6 w-full max-w-xl space-y-5 border border-border">
              <div className="space-y-1">
                <h3 className="font-display text-display-sm text-ink">Launch Checklist</h3>
                <p className="text-body-sm text-ink-muted">
                  Your collection is deployed. Complete these steps before you start promoting the mint.
                </p>
              </div>
              <ol className="list-decimal pl-5 space-y-2 text-body-sm text-ink-muted">
                <li>Open `Manage Collection` and confirm public sale price, wallet limit, and required sale end.</li>
                <li>Upload whitelist wallets before the whitelist window starts if you enabled allowlist minting.</li>
                <li>Set or confirm your payout wallet and token metadata base URI.</li>
                <li>Share the collection page or explorer link with your community.</li>
              </ol>
              <div className="flex flex-wrap gap-2">
                <Link to={`/nfts/manage/${createdCollectionAddress}`} className="btn-primary">
                  Open Manage Collection
                </Link>
                <button onClick={() => setShowPostDeployPopup(false)} className="btn-secondary">
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-6xl mx-auto space-y-8"
    >
      <motion.section variants={itemVariants} className="page-hero-card">
        <div className="eyebrow">NFT launch</div>
        <h1 className="ds-h1 mt-2">Create NFT Collection</h1>
        <p className="text-body-lg text-ink-muted max-w-3xl mt-3">
          Launch an ERC721 or ERC721A collection with separate whitelist and public mint phases.
        </p>
      </motion.section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.95fr)] gap-8 items-start">
        <div className="space-y-6">
          <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-6">
            <div className="space-y-1">
              <h2 className="font-display text-display-sm text-ink">Collection Type</h2>
              <p className="text-body-sm text-ink-muted">Choose the token standard that fits your mint strategy.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => setMode('erc721')}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  mode === 'erc721'
                    ? 'border-accent bg-accent/10 text-ink'
                    : 'border-border bg-canvas-alt text-ink-muted hover:text-ink'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Image className="w-4 h-4" />
                  <span className="font-medium">ERC721</span>
                </div>
                <p className="text-body-sm">Standard NFT contract for smaller or bespoke mints.</p>
              </button>
              <button
                onClick={() => setMode('erc721a')}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  mode === 'erc721a'
                    ? 'border-accent bg-accent/10 text-ink'
                    : 'border-border bg-canvas-alt text-ink-muted hover:text-ink'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="w-4 h-4" />
                  <span className="font-medium">ERC721A</span>
                </div>
                <p className="text-body-sm">Gas-optimized for higher-volume or batch mint campaigns.</p>
              </button>
            </div>
          </motion.section>

          <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="font-display text-display-sm text-ink">Identity & Metadata</h2>
              <p className="text-body-sm text-ink-muted">Set the collection identity, token metadata base URI, and launch art.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-body-sm text-ink-muted font-medium">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Stage0 Genesis"
                  className="input-field w-full"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-body-sm text-ink-muted font-medium">Symbol</label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="e.g. S0GEN"
                  className="input-field w-full"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-body-sm text-ink-muted font-medium">Base URI</label>
                <input
                  type="text"
                  value={baseURI}
                  onChange={(e) => setBaseURI(e.target.value)}
                  placeholder="CID, ipfs://.../, or https://..."
                  className="input-field w-full"
                />
              </div>
            </div>
          </motion.section>

          <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="font-display text-display-sm text-ink">Collection Info</h2>
              <p className="text-body-sm text-ink-muted">
                App-level profile details for Stage0 cards and discovery. NFT token metadata still comes from your Base URI onchain.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-body-sm text-ink-muted font-medium">Description</label>
                <textarea
                  value={collectionDescription}
                  onChange={(e) => setCollectionDescription(e.target.value)}
                  placeholder="A short intro for your collection profile."
                  className="input-field min-h-28 w-full resize-y"
                  maxLength={1200}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-body-sm text-ink-muted font-medium">Website</label>
                <input
                  type="url"
                  value={collectionWebsiteUrl}
                  onChange={(e) => setCollectionWebsiteUrl(e.target.value)}
                  placeholder="https://example.xyz"
                  className="input-field w-full"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-body-sm text-ink-muted font-medium">X / Twitter</label>
                <input
                  type="url"
                  value={collectionXUrl}
                  onChange={(e) => setCollectionXUrl(e.target.value)}
                  placeholder="https://x.com/stage0_"
                  className="input-field w-full"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-body-sm text-ink-muted font-medium">Telegram</label>
                <input
                  type="url"
                  value={collectionTelegramUrl}
                  onChange={(e) => setCollectionTelegramUrl(e.target.value)}
                  placeholder="https://t.me/project"
                  className="input-field w-full"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-body-sm text-ink-muted font-medium">Discord</label>
                <input
                  type="url"
                  value={collectionDiscordUrl}
                  onChange={(e) => setCollectionDiscordUrl(e.target.value)}
                  placeholder="https://discord.gg/project"
                  className="input-field w-full"
                />
              </div>
              <div className="space-y-3 md:col-span-2">
                <div className="space-y-1.5">
                  <label className="text-body-sm text-ink-muted font-medium">Collection Profile Image</label>
                  <p className="text-xs text-ink-faint">
                    Upload a square app profile image. WebP keeps files smaller; PNG is best for flat artwork and logos.
                    Keep it at 2MB or less.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_11rem] gap-4">
                  <div
                    className={`create-nft-upload-dropzone ${collectionImageDragActive ? 'is-dragging' : ''}`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setCollectionImageDragActive(true);
                    }}
                    onDragLeave={() => setCollectionImageDragActive(false)}
                    onDrop={handleCollectionImageDrop}
                  >
                    <input
                      ref={collectionImageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleCollectionImageFileChange}
                      className="sr-only"
                    />
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="text-body-sm font-medium text-ink">Drag & drop your image</div>
                        <div className="text-xs text-ink-faint">
                          or{' '}
                          <button
                            type="button"
                            onClick={() => collectionImageInputRef.current?.click()}
                            className="font-medium text-accent hover:text-accent-hover transition-colors"
                          >
                            browse files
                          </button>{' '}
                          · PNG, JPG, WebP up to 2MB. Square (1:1) recommended.
                        </div>
                        <div className="text-[11px] text-ink-faint">
                          Stage0 saves this profile block after the collection contract is deployed.
                        </div>
                        {collectionImageName ? (
                          <div className="text-xs text-ink-muted break-all">
                            <span className="font-medium text-ink">{collectionImageName}</span>
                            {collectionImageMeta ? ` · ${collectionImageMeta}` : ''}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="create-nft-upload-preview">
                    <div className="text-label text-ink-faint uppercase tracking-[0.18em]">Preview</div>
                    <div className="create-nft-upload-preview-frame">
                      <FallbackImage
                        src={collectionImagePreviewSrc}
                        alt="Collection image preview"
                        className="w-full h-full object-cover"
                        placeholder={<Image className="w-8 h-8 text-ink-faint" />}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="font-display text-display-sm text-ink">Supply & Treasury</h2>
              <p className="text-body-sm text-ink-muted">Define supply constraints and where mint proceeds should land.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-body-sm text-ink-muted font-medium">Max Supply</label>
                <input
                  type="number"
                  min="1"
                  value={maxSupply}
                  onChange={(e) => setMaxSupply(e.target.value)}
                  placeholder="1000"
                  className="input-field w-full"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-body-sm text-ink-muted font-medium">Wallet Limit</label>
                <input
                  type="number"
                  min="0"
                  value={walletLimit}
                  onChange={(e) => setWalletLimit(e.target.value)}
                  placeholder="0 = unlimited"
                  className="input-field w-full"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-body-sm text-ink-muted font-medium">Payout Wallet (optional)</label>
                <input
                  type="text"
                  value={payoutWallet}
                  onChange={(e) => setPayoutWallet(e.target.value)}
                  placeholder="0x... (defaults to your wallet)"
                  className="input-field w-full font-mono text-sm"
                />
              </div>
            </div>
          </motion.section>

          <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="font-display text-display-sm text-ink">Public Mint</h2>
              <p className="text-body-sm text-ink-muted">This is the open mint phase visible to every wallet.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-body-sm text-ink-muted font-medium">Public Price (ETH)</label>
                <input
                  type="text"
                  value={mintPrice}
                  onChange={(e) => setMintPrice(e.target.value)}
                  placeholder="0.05"
                  className="input-field w-full"
                />
              </div>
              <DateTimePickerField
                label="Public Sale Start"
                value={saleStart}
                onChange={setSaleStart}
                placeholder="Pick the public launch time"
              />
              <DateTimePickerField
                label="Sale End"
                value={saleEnd}
                onChange={setSaleEnd}
                placeholder="Pick when the sale closes"
                minDate={saleStartDate}
              />
            </div>
          </motion.section>

          <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6">
            <div className={`flex items-start justify-between gap-4 ${whitelistEnabled ? 'mb-5' : ''}`}>
              <div className="space-y-1">
                <h2 className="font-display text-display-sm text-ink">Whitelist Mint</h2>
                <p className="text-body-sm text-ink-muted">
                  Add an earlier allowlist window with a separate price before public mint opens.
                </p>
              </div>
              <button
                type="button"
                aria-label={whitelistEnabled ? 'Disable whitelist mint' : 'Enable whitelist mint'}
                aria-pressed={whitelistEnabled}
                onClick={() => setWhitelistEnabled((enabled) => !enabled)}
                className={`ds-switch ${whitelistEnabled ? 'is-on' : ''}`}
              />
            </div>

            <AnimatePresence initial={false}>
              {whitelistEnabled && (
                <motion.div
                  key="whitelist-fields"
                  initial={{ height: 0, opacity: 0, y: -8 }}
                  animate={{ height: 'auto', opacity: 1, y: 0 }}
                  exit={{ height: 0, opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <DateTimePickerField
                      label="Whitelist Start"
                      value={whitelistStart}
                      onChange={setWhitelistStart}
                      placeholder="Pick the allowlist start time"
                    />
                    <div className="space-y-1.5">
                      <label className="text-body-sm text-ink-muted font-medium">Whitelist Price (ETH)</label>
                      <input
                        type="text"
                        value={whitelistPrice}
                        onChange={(e) => setWhitelistPrice(e.target.value)}
                        placeholder="0.03"
                        className="input-field w-full"
                      />
                    </div>
                  </div>
                  <div className="ds-callout-accent mt-4">
                    When enabled, whitelist mint must start before the public sale. Approved wallets pay the whitelist price
                    until the public window opens.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>

          {writeError && (
            <motion.div
              variants={itemVariants}
              className="flex items-start gap-2 p-4 rounded-2xl bg-status-error-bg text-status-error text-sm"
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>{getFriendlyTxErrorMessage(writeError, 'Create NFT')}</p>
            </motion.div>
          )}
        </div>

        <div className="space-y-6 xl:sticky xl:top-24">
          <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="font-display text-display-sm text-ink">Launch Summary</h2>
              <p className="text-body-sm text-ink-muted">Review the mint structure before you deploy.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-ink/[0.03] p-4">
                <p className="text-label text-ink-faint uppercase">Mode</p>
                <p className="mt-2 text-body font-medium text-ink">{mode === 'erc721a' ? 'ERC721A' : 'ERC721'}</p>
              </div>
              <div className="rounded-2xl bg-ink/[0.03] p-4">
                <p className="text-label text-ink-faint uppercase">Sale Model</p>
                <p className="mt-2 text-body font-medium text-ink">{saleModel}</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { label: 'Collection', value: name.trim() || 'Untitled Collection' },
                { label: 'Symbol', value: symbol.trim() || '--' },
                { label: 'Collection image', value: collectionImageName || 'Not added yet' },
                { label: 'Supply', value: maxSupply.trim() || '--' },
                { label: 'Wallet limit', value: walletLimitLabel },
                { label: 'Public price', value: mintPrice.trim() ? `${mintPrice.trim()} ETH` : '--' },
                {
                  label: 'Whitelist price',
                  value: whitelistEnabled ? (whitelistPrice.trim() ? `${whitelistPrice.trim()} ETH` : '--') : 'Disabled',
                },
                { label: 'Whitelist opens', value: whitelistEnabled ? formatPreviewDate(whitelistStart) : 'Disabled' },
                { label: 'Public opens', value: formatPreviewDate(saleStart) },
                { label: 'Sale closes', value: formatPreviewDate(saleEnd) },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-4 text-body-sm">
                  <span className="text-ink-muted">{item.label}</span>
                  <span className="text-right font-medium text-ink">{item.value}</span>
                </div>
              ))}
            </div>

            {!validation.valid && (
              <div className="rounded-2xl border border-status-upcoming/20 bg-status-upcoming-bg p-4 text-sm text-status-upcoming">
                {validation.message}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!validation.valid || isPending || isConfirming}
              className="btn-primary w-full"
            >
              {isPending || isConfirming ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isConfirming ? 'Confirming...' : 'Deploying Collection...'}
                </span>
              ) : !isConnected ? (
                'Connect Wallet First'
              ) : (
                `Create ${mode === 'erc721a' ? 'ERC721A' : 'ERC721'} Collection`
              )}
            </button>
          </motion.section>

        </div>
      </div>

      <motion.section variants={itemVariants}>
        <div className="rounded-2xl border border-border bg-canvas-alt p-5">
          <p className="text-body-sm text-ink-muted">
            Need other tools? <Link className="text-accent hover:text-accent-hover" to="/tools">Back to Tools</Link>
          </p>
        </div>
      </motion.section>
    </motion.div>
  );
};

export default CreateNFTPage;
