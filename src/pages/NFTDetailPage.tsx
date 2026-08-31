import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, Link } from 'react-router-dom';
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { formatEther, isAddress, type Address, type ContractFunctionParameters } from 'viem';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  ExternalLink,
  Image,
  Shield,
  Users,
} from '@/components/ui/icons';
import { InlineLoading, LoadingState } from '@/components/ui/spinner';
import { NFTCollectionContract, NFT_COLLECTION_IMAGES, getExplorerUrl } from '@/config';
import { getFriendlyTxErrorMessage } from '@/lib/utils/tx-errors';
import {
  fetchTokenDisplayMetadata,
  resolveCollectionDisplayMetadata,
  type TokenMetadataAttribute,
} from '@/lib/utils/nft-metadata';
import { getNFTActiveMintPrice, getNFTSalePhase, getNFTSaleStatus, resolveNFTSaleCountdown } from '@/lib/utils/nft-sales';
import FallbackImage from '@/components/ui/fallback-image';

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

type NFTInfoTab = 'overview' | 'traits' | 'details';

function getStatusBadge(status: 'live' | 'upcoming' | 'ended', salePhase: 'whitelist' | 'public' | 'upcoming' | 'ended') {
  if (status === 'live' && salePhase === 'whitelist') {
    return (
      <span className="status-pill bg-accent/10 text-accent">
        <Shield className="status-pill-icon" />
        Whitelist Live
      </span>
    );
  }

  if (status === 'live') {
    return (
      <span className="status-pill bg-status-live-bg text-status-live">
        <span className="status-pill-dot" />
        Public Live
      </span>
    );
  }

  if (status === 'upcoming') {
    return (
      <span className="status-pill bg-status-upcoming-bg text-status-upcoming">
        <Clock className="status-pill-icon" />
        Upcoming
      </span>
    );
  }

  return (
    <span className="status-pill bg-status-closed-bg text-status-closed">
      <CheckCircle2 className="status-pill-icon" />
      Ended
    </span>
  );
}

function formatTimestamp(ts: bigint): string {
  if (!ts || ts === 0n) return 'Not set';
  return new Date(Number(ts) * 1000).toLocaleString();
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

// Always shows seconds — for live ticking countdown displays.
function formatCountdownLive(diff: number): string {
  if (diff <= 0) return '00h 00m 00s';

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');

  if (days > 0) return `${days}d ${hh}h ${mm}m ${ss}s`;
  return `${hh}h ${mm}m ${ss}s`;
}

const NFTDetailPage: React.FC = () => {
  const { address: collectionParam } = useParams<{ address: string }>();
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const explorerUrl = getExplorerUrl(chainId);
  const publicClient = usePublicClient();

  const isValidAddress = Boolean(collectionParam && isAddress(collectionParam));
  const collectionAddress = (isValidAddress ? collectionParam : undefined) as Address | undefined;
  const collectionImage =
    collectionAddress ? NFT_COLLECTION_IMAGES[collectionAddress.toLowerCase()] : undefined;

  const [mintQty, setMintQty] = useState(1);
  const [contractMetadata, setContractMetadata] = useState<{ image?: string; description?: string } | null>(null);
  const [isContractMetadataLoading, setIsContractMetadataLoading] = useState(false);
  const [collectionImageRenderFailed, setCollectionImageRenderFailed] = useState(false);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [infoTab, setInfoTab] = useState<NFTInfoTab>('overview');
  const [sampleTraits, setSampleTraits] = useState<TokenMetadataAttribute[]>([]);
  const [isSampleTraitsLoading, setIsSampleTraitsLoading] = useState(false);

  const queries = useMemo(() => {
    if (!collectionAddress) return [];
    return [
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'name' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'symbol' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'maxSupply' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'totalMinted' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'mintPrice' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'walletLimit' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'saleStart' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'saleEnd' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'contractURI' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'baseURI' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'whitelistEnabled' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'whitelistStart' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'whitelistPrice' },
    ] as const;
  }, [collectionAddress]);

  const userStateQueries = useMemo(() => {
    if (!collectionAddress || !userAddress) return [];
    return [
      {
        abi: NFTCollectionContract,
        address: collectionAddress,
        functionName: 'mintedPerWallet',
        args: [userAddress],
      },
      {
        abi: NFTCollectionContract,
        address: collectionAddress,
        functionName: 'whitelist',
        args: [userAddress],
      },
    ] as const;
  }, [collectionAddress, userAddress]);

  const { data: collectionData, isLoading: isCollectionLoading, refetch } = useReadContracts({
    contracts: queries as readonly ContractFunctionParameters[],
    query: {
      enabled: queries.length > 0,
      refetchInterval: 10000,
      refetchOnWindowFocus: true,
    },
  });

  const { data: userStateData, refetch: refetchUserState } = useReadContracts({
    contracts: userStateQueries as readonly ContractFunctionParameters[],
    query: {
      enabled: userStateQueries.length > 0,
      refetchInterval: 10000,
      refetchOnWindowFocus: true,
    },
  });

  const collection = useMemo(() => {
    if (!collectionAddress || !collectionData || collectionData.length === 0) return null;

    const name = (collectionData[0]?.result as string | undefined) ?? 'NFT Collection';
    const symbol = (collectionData[1]?.result as string | undefined) ?? 'NFT';
    const maxSupply = (collectionData[2]?.result as bigint | undefined) ?? 0n;
    const totalMinted = (collectionData[3]?.result as bigint | undefined) ?? 0n;
    const mintPrice = (collectionData[4]?.result as bigint | undefined) ?? 0n;
    const walletLimit = Number((collectionData[5]?.result as bigint | number | undefined) ?? 0);
    const saleStart = (collectionData[6]?.result as bigint | undefined) ?? 0n;
    const saleEnd = (collectionData[7]?.result as bigint | undefined) ?? 0n;
    const contractURI = (collectionData[8]?.result as string | undefined) ?? '';
    const baseURI = (collectionData[9]?.result as string | undefined) ?? '';
    const whitelistEnabled = (collectionData[10]?.result as boolean | undefined) ?? false;
    const whitelistStart = (collectionData[11]?.result as bigint | undefined) ?? 0n;
    const whitelistPrice = (collectionData[12]?.result as bigint | undefined) ?? 0n;
    const remaining = maxSupply > 0n ? maxSupply - totalMinted : 0n;
    const salePhase = getNFTSalePhase({
      maxSupply,
      totalMinted,
      saleStart,
      saleEnd,
      whitelistEnabled,
      whitelistStart,
    });
    const status = getNFTSaleStatus({
      maxSupply,
      totalMinted,
      saleStart,
      saleEnd,
      whitelistEnabled,
      whitelistStart,
    });

    return {
      name,
      symbol,
      maxSupply,
      totalMinted,
      mintPrice,
      walletLimit,
      saleStart,
      saleEnd,
      contractURI,
      baseURI,
      whitelistEnabled,
      whitelistStart,
      whitelistPrice,
      remaining,
      salePhase,
      status,
    };
  }, [collectionAddress, collectionData]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!collection) {
      setContractMetadata(null);
      setIsContractMetadataLoading(false);
      return;
    }

    setIsContractMetadataLoading(true);
    (async () => {
      try {
        const metadata = await resolveCollectionDisplayMetadata({
          contractUri: collection?.contractURI ?? '',
          baseUri: collection?.baseURI ?? '',
          collectionAddress,
          totalMinted: collection?.totalMinted ?? 0n,
          publicClient,
        });

        if (!cancelled) {
          setContractMetadata(metadata);
          setIsContractMetadataLoading(false);
        }
      } catch {
        if (!cancelled) {
          setContractMetadata(null);
          setIsContractMetadataLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [collection, collectionAddress, publicClient]);

  useEffect(() => {
    setCollectionImageRenderFailed(false);
  }, [contractMetadata?.image, collectionImage, collectionAddress]);

  useEffect(() => {
    let cancelled = false;

    if (!collectionAddress || !publicClient || !collection || collection.totalMinted <= 0n) {
      setSampleTraits([]);
      setIsSampleTraitsLoading(false);
      return;
    }

    setIsSampleTraitsLoading(true);
    setSampleTraits([]);

    (async () => {
      for (const tokenId of [1n, 0n]) {
        let tokenUri = '';
        try {
          const result = await publicClient.readContract({
            abi: NFTCollectionContract,
            address: collectionAddress,
            functionName: 'tokenURI',
            args: [tokenId],
          });

          tokenUri = typeof result === 'string' ? result : '';
        } catch {
          tokenUri = '';
        }

        if (!tokenUri.trim() && !collection.baseURI.trim()) continue;

        try {
          const tokenMetadata = await fetchTokenDisplayMetadata(tokenUri, {
            baseUri: collection.baseURI,
            tokenId,
          });
          if (!tokenMetadata?.attributes?.length) continue;

          if (!cancelled) {
            setSampleTraits(tokenMetadata.attributes.slice(0, 8));
            setIsSampleTraitsLoading(false);
          }
          return;
        } catch {
          continue;
        }
      }

      if (!cancelled) {
        setSampleTraits([]);
        setIsSampleTraitsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [collection, collectionAddress, publicClient]);

  const userMinted = useMemo(() => {
    if (!userStateData || userStateData.length === 0) return 0n;

    const mintedPerWallet = userStateData[0];
    if (mintedPerWallet?.status === 'success' && typeof mintedPerWallet.result === 'bigint') {
      return mintedPerWallet.result;
    }
    return 0n;
  }, [userStateData]);

  const isUserWhitelisted = useMemo(() => {
    const whitelistEntry = userStateData?.[1];
    return whitelistEntry?.status === 'success' && Boolean(whitelistEntry.result);
  }, [userStateData]);

  const maxMintable = useMemo(() => {
    if (!collection) return 0;
    const remaining = Number(collection.remaining);
    if (collection.walletLimit === 0) return remaining;
    const leftForWallet = Math.max(0, collection.walletLimit - Number(userMinted));
    return Math.min(leftForWallet, remaining);
  }, [collection, userMinted]);

  const unitPrice = useMemo(() => {
    if (!collection) return 0n;
    return getNFTActiveMintPrice({
      maxSupply: collection.maxSupply,
      totalMinted: collection.totalMinted,
      saleStart: collection.saleStart,
      saleEnd: collection.saleEnd,
      whitelistEnabled: collection.whitelistEnabled,
      whitelistStart: collection.whitelistStart,
      mintPrice: collection.mintPrice,
      whitelistPrice: collection.whitelistPrice,
    });
  }, [collection]);

  const totalCost = useMemo(() => unitPrice * BigInt(mintQty), [unitPrice, mintQty]);

  const userCanMintCurrentPhase = useMemo(() => {
    if (!collection) return false;
    if (collection.salePhase === 'public') return true;
    if (collection.salePhase === 'whitelist') return isUserWhitelisted;
    return false;
  }, [collection, isUserWhitelisted]);

  const {
    data: txHash,
    writeContract,
    isPending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const handledHashRef = useRef<`0x${string}` | undefined>(undefined);

  useEffect(() => {
    if (!writeError) return;
    toast.error(getFriendlyTxErrorMessage(writeError, 'Mint'));
  }, [writeError]);

  useEffect(() => {
    if (!txHash || !isSuccess) return;
    if (handledHashRef.current === txHash) return;
    handledHashRef.current = txHash;
    toast.success(`Minted ${mintQty} NFT${mintQty > 1 ? 's' : ''} successfully.`);
    setMintQty(1);
    resetWrite();
    void Promise.all([refetch(), refetchUserState()]);
  }, [txHash, isSuccess, mintQty, refetch, refetchUserState, resetWrite]);

  const handleMint = () => {
    if (!collectionAddress || mintQty < 1 || !userCanMintCurrentPhase) return;
    writeContract({
      abi: NFTCollectionContract,
      address: collectionAddress,
      functionName: 'mint',
      args: [BigInt(mintQty)],
      value: totalCost,
    });
  };

  const mintProgress = useMemo(() => {
    if (!collection || collection.maxSupply === 0n) return 0;
    return Math.min(Number((collection.totalMinted * 100n) / collection.maxSupply), 100);
  }, [collection]);

  const imageMetadataWarning = useMemo(() => {
    if (!collection) return null;
    const hasOnchainImageCandidate = Boolean(collection.contractURI.trim()) || collection.totalMinted > 0n;
    const imageUnavailable =
      !isContractMetadataLoading &&
      hasOnchainImageCandidate &&
      (!contractMetadata?.image || collectionImageRenderFailed);

    if (!imageUnavailable) return null;

    return collectionImage
      ? 'On-chain image URI could not be resolved; showing fallback artwork.'
      : 'On-chain image URI could not be resolved. The IPFS link may be invalid or unreachable.';
  }, [
    collection,
    collectionImage,
    collectionImageRenderFailed,
    contractMetadata?.image,
    isContractMetadataLoading,
  ]);

  if (!isValidAddress) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <p className="text-body text-ink-muted">Invalid collection address.</p>
        <Link to="/presales" className="btn-primary">Back to Launchpad</Link>
      </div>
    );
  }

  if (isCollectionLoading || !collection) {
    return (
      <LoadingState label="Loading collection" />
    );
  }

  const isBusy = isPending || isConfirming;
  const mintCardCountdown = resolveNFTSaleCountdown({
    status: collection.status,
    whitelistEnabled: collection.whitelistEnabled,
    whitelistStart: collection.whitelistStart,
    saleStart: collection.saleStart,
    saleEnd: collection.saleEnd,
    nowSec,
  });
  const whitelistStartSec = Number(collection.whitelistStart);
  const publicStartSec = Number(collection.saleStart);
  const saleEndSec = Number(collection.saleEnd);

  const whitelistStartsIn = collection.whitelistEnabled
    ? whitelistStartSec > nowSec
      ? formatCountdown(collection.whitelistStart, nowSec)
      : publicStartSec > nowSec
      ? 'Live'
      : 'Ended'
    : 'Disabled';

  const publicStartsIn =
    publicStartSec > nowSec
      ? formatCountdown(collection.saleStart, nowSec)
      : collection.status === 'ended'
      ? 'Ended'
      : 'Live';

  const saleEndsIn =
    collection.saleEnd === 0n
      ? 'No end date'
      : saleEndSec > nowSec
      ? formatCountdown(collection.saleEnd, nowSec)
      : 'Ended';

  const collectionDescription =
    contractMetadata?.description?.trim() ||
    'Mint from this collection directly on RISE. Sale timing, pricing, and wallet limits are read from the collection contract.';

  const salePhaseSteps = [
    {
      name: 'Whitelist',
      state: !collection.whitelistEnabled
        ? 'skipped'
        : collection.salePhase === 'whitelist'
        ? 'active'
        : collection.salePhase === 'public' || collection.status === 'ended'
        ? 'completed'
        : 'upcoming',
      sub: !collection.whitelistEnabled
        ? 'Disabled for this drop'
        : collection.salePhase === 'whitelist'
        ? `${formatEther(collection.whitelistPrice)} ETH · live now`
        : collection.salePhase === 'public' || collection.status === 'ended'
        ? 'Completed'
        : whitelistStartsIn,
    },
    {
      name: 'Public mint',
      state:
        collection.salePhase === 'public'
          ? 'active'
          : collection.status === 'ended'
          ? 'completed'
          : 'upcoming',
      sub:
        collection.salePhase === 'public'
          ? `${formatEther(collection.mintPrice)} ETH · live now`
          : collection.status === 'ended'
          ? 'Completed'
          : publicStartsIn,
    },
    {
      name: 'Reveal & secondary',
      state: collection.status === 'ended' ? 'active' : 'upcoming',
      sub: collection.status === 'ended' ? 'Sale closed' : 'After sale closes',
    },
  ] as const;

  const detailRows = [
    {
      label: 'Contract',
      value: collectionAddress ? `${collectionAddress.slice(0, 6)}...${collectionAddress.slice(-4)}` : 'Unavailable',
      href: collectionAddress ? `${explorerUrl}/address/${collectionAddress}` : undefined,
      mono: true,
    },
    { label: 'Standard', value: 'ERC-721A' },
    { label: 'Network', value: 'RISE Mainnet' },
    { label: 'Public mint price', value: `${formatEther(collection.mintPrice)} ETH`, mono: true },
    {
      label: 'Whitelist mint price',
      value: collection.whitelistEnabled ? `${formatEther(collection.whitelistPrice)} ETH` : 'Disabled',
      mono: collection.whitelistEnabled,
    },
    {
      label: 'Wallet limit',
      value: collection.walletLimit === 0 ? 'Unlimited' : collection.walletLimit.toString(),
    },
    { label: 'Public start', value: formatTimestamp(collection.saleStart), mono: true },
    { label: 'Sale end', value: formatTimestamp(collection.saleEnd), mono: true },
    { label: 'Ends in', value: saleEndsIn, mono: true },
    {
      label: 'Metadata source',
      value: collection.contractURI.trim()
        ? 'Contract metadata + token fallback'
        : 'First-token metadata fallback',
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      <motion.div variants={itemVariants}>
        <Link
          to="/presales"
          className="inline-flex items-center gap-2 text-body text-ink-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Launchpad
        </Link>
      </motion.div>

      <motion.section variants={itemVariants} className="page-hero-card space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="ds-h1">{collection.name}</h1>
              <span className="pill pill-nft">
                NFT
              </span>
            </div>
            <p className="text-body text-ink-muted">{collection.symbol}</p>
            <p className="text-body-sm text-ink-faint max-w-2xl">{collectionDescription}</p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(collection.status, collection.salePhase)}
          </div>
        </div>
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Image — left col, mobile: 1st */}
        <motion.div variants={itemVariants} className="lg:col-span-2 order-1 glass-card rounded-3xl overflow-hidden">
          <FallbackImage
            src={contractMetadata?.image}
            fallbackSrc={collectionImage}
            alt={collection.name}
            className="w-full object-cover max-h-80"
            onImageError={() => setCollectionImageRenderFailed(true)}
            placeholder={(
              <div className="w-full h-48 flex items-center justify-center bg-ink/5">
                <Image className="w-12 h-12 text-ink-faint" />
              </div>
            )}
          />
          {imageMetadataWarning && (
            <div className="border-t border-border/60 bg-canvas-alt/60 px-4 py-2">
              <p className="text-xs text-ink-faint">{imageMetadataWarning}</p>
            </div>
          )}
        </motion.div>

        {/* Mint Progress — left col, mobile: 2nd */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 order-2 bg-canvas-alt border border-border rounded-3xl p-6 space-y-5 relative overflow-hidden"
        >
          <span
            aria-hidden
            className="absolute top-0 left-6 h-[3px] w-12 rounded-b-full"
            style={{ background: 'rgb(var(--color-accent))' }}
          />
          <div>
            <div className="eyebrow" style={{ color: 'rgb(var(--color-accent))' }}>
              Supply
            </div>
            <h2 className="font-display font-bold text-[22px] text-ink leading-tight mt-1.5 tracking-tight">
              Mint progress
            </h2>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-body">
              <span className="text-ink-muted">Minted</span>
              <span className="text-ink font-mono font-bold">
                {collection.totalMinted.toString()} / {collection.maxSupply.toString()}
              </span>
            </div>
            <div className="w-full h-3 bg-ink/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${mintProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-body-sm text-ink-muted">
              <span className="font-mono">{mintProgress}% minted</span>
              <span className="font-mono">{collection.remaining.toString()} remaining</span>
            </div>
          </div>
        </motion.div>

        {/* Right column — mobile: 3rd (Mint NFT before Sale Overview) */}
        <div className="space-y-6 order-3 lg:col-start-3 lg:row-start-1 lg:row-span-3">
          {collection.status === 'live' && isConnected && (
            <motion.div
              variants={itemVariants}
              className="nft-mint-card"
            >
              <span
                aria-hidden
                className="absolute top-0 left-6 h-[3px] w-12 rounded-b-full"
                style={{ background: 'rgb(var(--color-accent))' }}
              />
              <div className="nft-mint-card-tag">
                {getStatusBadge(collection.status, collection.salePhase)}
              </div>

              <div>
                <h3 className="font-display font-bold text-[24px] text-ink leading-tight tracking-tight">
                  Mint NFT
                </h3>
              </div>

              <div className="nft-mint-price-row">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                    Active phase
                  </div>
                  <div className="font-display font-bold text-[17px] text-ink leading-tight tracking-tight mt-1.5">
                    {collection.salePhase === 'whitelist' ? 'Whitelist mint' : 'Public mint'}
                  </div>
                  <div className="text-body-sm text-ink-muted mt-1.5">
                    Current price{' '}
                    <span className="font-mono font-bold text-ink">{formatEther(unitPrice)} ETH</span>
                  </div>
                </div>
              </div>

              <div className="launch-countdown">
                <span className="launch-countdown-lbl">{mintCardCountdown.label}</span>
                <span className="font-bold tabular-nums">
                  {(() => {
                    if (mintCardCountdown.targetTime !== undefined) {
                      const secs = Number(mintCardCountdown.targetTime) - nowSec;
                      if (secs > 0) return formatCountdownLive(secs);
                      return mintCardCountdown.completedLabel ?? '—';
                    }
                    return (
                      mintCardCountdown.stoppedMessage ??
                      mintCardCountdown.fallbackLabel ??
                      mintCardCountdown.completedLabel ??
                      '—'
                    );
                  })()}
                </span>
              </div>

              <div className="space-y-5">
                <div className="qty-row">
                  <div>
                    <label className="text-body-sm text-ink-muted font-medium block">Quantity</label>
                    <p className="text-[11px] text-ink-faint mt-1">
                      {collection.walletLimit > 0
                        ? `${Math.max(0, collection.walletLimit - Number(userMinted))} remaining for this wallet`
                        : 'No wallet cap'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMintQty(Math.max(1, maxMintable));
                      resetWrite();
                    }}
                    disabled={maxMintable <= 0}
                    className="qty-max"
                  >
                    Max
                  </button>
                </div>

                <div className="qty-stepper">
                  <button
                    onClick={() => {
                      setMintQty((q) => Math.max(1, q - 1));
                      resetWrite();
                    }}
                    disabled={mintQty <= 1}
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, maxMintable)}
                    value={mintQty}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(Math.max(1, maxMintable), Number(e.target.value) || 1));
                      setMintQty(v);
                      resetWrite();
                    }}
                  />
                  <button
                    onClick={() => {
                      setMintQty((q) => Math.min(Math.max(1, maxMintable), q + 1));
                      resetWrite();
                    }}
                    disabled={mintQty >= Math.max(1, maxMintable)}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                <div className="nft-mint-total">
                  <div className="flex items-center justify-between text-body-sm text-ink-muted">
                    <span>Price per NFT</span>
                    <span className="font-mono text-ink">{formatEther(unitPrice)} ETH</span>
                  </div>
                  <div className="flex items-center justify-between text-body-sm text-ink-muted">
                    <span>Quantity</span>
                    <span className="font-mono text-ink">{mintQty}</span>
                  </div>
                  <div className="h-px bg-border/70" />
                  <div className="flex items-center justify-between">
                    <span className="text-body-sm text-ink-muted">Total</span>
                    <span className="font-display font-bold text-[20px] text-ink tracking-tight">
                      {formatEther(totalCost)} ETH
                    </span>
                  </div>
                  {collection.walletLimit > 0 && (
                    <div className="text-[11px] text-ink-faint">
                      Max per wallet: <span className="font-mono">{collection.walletLimit}</span>
                    </div>
                  )}
                </div>

                {!userCanMintCurrentPhase ? (
                  <div className="p-3 rounded-xl bg-status-upcoming-bg text-status-upcoming text-sm">
                    Only whitelisted wallets can mint during the current phase.
                  </div>
                ) : maxMintable === 0 ? (
                  <div className="p-3 rounded-xl bg-status-closed-bg text-status-closed text-sm">
                    {Number(userMinted) >= collection.walletLimit && collection.walletLimit > 0
                      ? 'You have reached the wallet limit for this collection.'
                      : 'No NFTs remaining.'}
                  </div>
                ) : null}

                <button
                  onClick={handleMint}
                  disabled={isBusy || mintQty < 1 || !userCanMintCurrentPhase || maxMintable === 0}
                  className="btn-primary w-full"
                >
                  {isBusy ? (
                    <InlineLoading label={isConfirming ? 'Confirming...' : 'Minting...'} />
                  ) : (
                    `Mint ${mintQty} NFT${mintQty > 1 ? 's' : ''} →`
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {isConnected && (
            <motion.div variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-3">
              <h3 className="font-display text-display-sm text-ink">Your Access</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-body-sm">
                  <span className="text-ink-muted">Minted so far</span>
                  <span className="text-ink font-medium">{userMinted.toString()}</span>
                </div>
                {collection.walletLimit > 0 && (
                  <div className="flex justify-between text-body-sm">
                    <span className="text-ink-muted">Wallet limit</span>
                    <span className="text-ink font-medium">{collection.walletLimit}</span>
                  </div>
                )}
                <div className="flex justify-between text-body-sm">
                  <span className="text-ink-muted">Can still mint</span>
                  <span className="text-ink font-medium">{maxMintable}</span>
                </div>
                {collection.whitelistEnabled && (
                  <div className="flex justify-between text-body-sm">
                    <span className="text-ink-muted">Whitelist status</span>
                    <span className="text-ink font-medium">{isUserWhitelisted ? 'Approved' : 'Not approved'}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {collection.status === 'upcoming' && (
            <motion.div variants={itemVariants} className="glass-card rounded-3xl p-6 text-center space-y-3">
              <Clock className="w-8 h-8 text-status-upcoming mx-auto" />
              <p className="text-body font-medium text-ink">Mint Has Not Started Yet</p>
              <p className="text-body-sm text-ink-muted">
                {collection.whitelistEnabled
                  ? `Whitelist opens in ${formatCountdown(collection.whitelistStart, nowSec)}`
                  : `Public mint opens in ${formatCountdown(collection.saleStart, nowSec)}`}
              </p>
            </motion.div>
          )}

          {collection.status === 'ended' && (
            <motion.div variants={itemVariants} className="glass-card rounded-3xl p-6 text-center space-y-3">
              <CheckCircle2 className="w-8 h-8 text-status-closed mx-auto" />
              <p className="text-body font-medium text-ink">Sale Ended</p>
              <p className="text-body-sm text-ink-muted">This NFT sale has concluded.</p>
            </motion.div>
          )}

          {!isConnected && (
            <motion.div variants={itemVariants} className="glass-card rounded-3xl p-6 text-center space-y-3">
              <Users className="w-8 h-8 text-accent mx-auto" />
              <p className="text-body text-ink-muted">
                Connect your wallet to mint from this collection and verify whitelist access.
              </p>
            </motion.div>
          )}
        </div>

        {/* Sale Overview — left col, mobile: 4th (after Mint NFT) */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 order-4 bg-canvas-alt border border-border rounded-3xl p-6 space-y-5 relative overflow-hidden"
        >
          <span
            aria-hidden
            className="absolute top-0 left-6 h-[3px] w-12 rounded-b-full"
            style={{ background: 'rgb(var(--color-accent))' }}
          />
          <div className="flex flex-col gap-4">
            <div>
              <div className="eyebrow" style={{ color: 'rgb(var(--color-accent))' }}>
                Collection
              </div>
              <h2 className="font-display font-bold text-[22px] text-ink leading-tight mt-1.5 tracking-tight">
                Sale details
              </h2>
            </div>
            <div className="nft-sale-tabs">
              {[
                ['overview', 'Overview'],
                ['traits', 'Traits'],
                ['details', 'Sale details'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`nft-sale-tab ${infoTab === value ? 'active' : ''}`}
                  onClick={() => setInfoTab(value as NFTInfoTab)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {infoTab === 'overview' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-canvas/40 p-5">
                <div className="eyebrow">About</div>
                <p className="text-body text-ink mt-3 leading-relaxed">{collectionDescription}</p>
              </div>

              <div className="nft-phase-card">
                <div className="eyebrow">Sale phases</div>
                <div className="nft-phase-rail">
                  {salePhaseSteps.map((phase) => (
                    <div key={phase.name} className={`nft-phase ${phase.state}`}>
                      <div className="nft-phase-dot" />
                      <div className="nft-phase-info">
                        <div className="nft-phase-name">{phase.name}</div>
                        <div className="nft-phase-sub">{phase.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {infoTab === 'traits' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="eyebrow">On-chain traits</div>
                  <p className="text-body-sm text-ink-muted mt-2">
                    Sampled from first-token metadata when attributes are available on-chain.
                  </p>
                </div>
                {isSampleTraitsLoading && (
                  <span className="text-body-sm text-ink-faint">
                    <InlineLoading label="Loading traits..." size="xs" variant="dots" />
                  </span>
                )}
              </div>

              {sampleTraits.length > 0 ? (
                <div className="nft-trait-grid">
                  {sampleTraits.map((trait, index) => (
                    <div key={`${trait.traitType}-${trait.value}-${index}`} className="nft-trait">
                      <div className="nft-trait-name">{trait.traitType}</div>
                      <div className="nft-trait-value">{trait.value}</div>
                      {trait.displayType && (
                        <div className="nft-trait-meta">{trait.displayType}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-canvas/40 p-5 text-body-sm text-ink-muted">
                  This collection does not currently expose token attributes through first-token metadata.
                </div>
              )}
            </div>
          )}

          {infoTab === 'details' && (
            <div className="nft-detail-rows">
              {detailRows.map((item) => (
                <div key={item.label} className="nft-detail-row">
                  <div className="nft-detail-k">{item.label}</div>
                  <div className={`nft-detail-v ${item.mono ? 'font-mono' : ''}`}>
                    {item.href ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-accent hover:underline"
                      >
                        {item.value}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      item.value
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default NFTDetailPage;
