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
import { formatEther, isAddress, type Address } from 'viem';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  ExternalLink,
  Image,
  Loader2,
  Shield,
  Users,
} from 'lucide-react';
import { NFTCollectionContract, NFT_COLLECTION_IMAGES, getExplorerUrl } from '@/config';
import { getFriendlyTxErrorMessage } from '@/lib/utils/tx-errors';
import { resolveCollectionDisplayMetadata } from '@/lib/utils/nft-metadata';
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
        functionName: 'mintedBy',
        args: [userAddress],
      },
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
    contracts: queries as readonly any[],
    query: {
      enabled: queries.length > 0,
      refetchInterval: 10000,
      refetchOnWindowFocus: true,
    },
  });

  const { data: userStateData, refetch: refetchUserState } = useReadContracts({
    contracts: userStateQueries as readonly any[],
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
    const whitelistEnabled = (collectionData[9]?.result as boolean | undefined) ?? false;
    const whitelistStart = (collectionData[10]?.result as bigint | undefined) ?? 0n;
    const whitelistPrice = (collectionData[11]?.result as bigint | undefined) ?? 0n;
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

  const userMinted = useMemo(() => {
    if (!userStateData || userStateData.length === 0) return 0n;

    const mintedBy = userStateData[0];
    const mintedPerWallet = userStateData[1];

    if (mintedBy?.status === 'success' && typeof mintedBy.result === 'bigint') {
      return mintedBy.result;
    }
    if (mintedPerWallet?.status === 'success' && typeof mintedPerWallet.result === 'bigint') {
      return mintedPerWallet.result;
    }
    return 0n;
  }, [userStateData]);

  const isUserWhitelisted = useMemo(() => {
    const whitelistEntry = userStateData?.[2];
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
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <p className="text-body text-ink-muted">Loading collection...</p>
      </div>
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
            {contractMetadata?.description && (
              <p className="text-body-sm text-ink-faint max-w-2xl">{contractMetadata.description}</p>
            )}
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
              className="bg-canvas-alt border border-border rounded-3xl p-6 space-y-5 relative overflow-hidden text-center"
            >
              <span
                aria-hidden
                className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-12 rounded-b-full"
                style={{ background: 'rgb(var(--color-accent))' }}
              />
              <div>
                <div className="eyebrow" style={{ color: 'rgb(var(--color-accent))' }}>
                  Mint
                </div>
                <h3 className="font-display font-bold text-[22px] text-ink leading-tight mt-1.5 tracking-tight">
                  Mint NFT
                </h3>
              </div>

              <div className="rounded-2xl border border-border bg-canvas/40 p-4 space-y-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                  Active phase
                </div>
                <div className="font-display font-bold text-[17px] text-ink leading-tight tracking-tight">
                  {collection.salePhase === 'whitelist' ? 'Whitelist mint' : 'Public mint'}
                </div>
                <div className="text-body-sm text-ink-muted">
                  Current price{' '}
                  <span className="font-mono font-bold text-ink">{formatEther(unitPrice)} ETH</span>
                </div>
              </div>

              <div className="launch-countdown justify-center">
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

              <div className="space-y-4">
                <div>
                  <label className="text-body-sm text-ink-muted font-medium mb-2 block">
                    Quantity
                  </label>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => setMintQty((q) => Math.max(1, q - 1))}
                      disabled={mintQty <= 1}
                      className="w-9 h-9 rounded-xl bg-ink/5 hover:bg-ink/10 text-ink font-bold disabled:opacity-30 transition-colors"
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
                      className="input-field w-20 text-center"
                    />
                    <button
                      onClick={() => setMintQty((q) => Math.min(Math.max(1, maxMintable), q + 1))}
                      disabled={mintQty >= Math.max(1, maxMintable)}
                      className="w-9 h-9 rounded-xl bg-ink/5 hover:bg-ink/10 text-ink font-bold disabled:opacity-30 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="text-body-sm text-ink-muted space-y-1">
                  <p>Price per NFT: <span className="font-mono text-ink">{formatEther(unitPrice)} ETH</span></p>
                  <p className="font-display font-bold text-[18px] text-ink tracking-tight">Total: {formatEther(totalCost)} ETH</p>
                  {collection.walletLimit > 0 && <p>Max per wallet: <span className="font-mono">{collection.walletLimit}</span></p>}
                </div>

                {!userCanMintCurrentPhase ? (
                  <div className="p-3 rounded-xl bg-status-upcoming-bg text-status-upcoming text-sm">
                    Only whitelisted wallets can mint during the current phase.
                  </div>
                ) : maxMintable === 0 ? (
                  <div className="p-3 rounded-xl bg-status-closed-bg text-status-closed text-sm text-center">
                    {Number(userMinted) >= collection.walletLimit && collection.walletLimit > 0
                      ? 'You have reached the wallet limit for this collection.'
                      : 'No NFTs remaining.'}
                  </div>
                ) : (
                  <button
                    onClick={handleMint}
                    disabled={isBusy || mintQty < 1}
                    className="btn-primary w-full"
                  >
                    {isBusy ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {isConfirming ? 'Confirming...' : 'Minting...'}
                      </span>
                    ) : (
                      `Mint ${mintQty} NFT${mintQty > 1 ? 's' : ''} · ${formatEther(totalCost)} ETH`
                    )}
                  </button>
                )}
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
          <div>
            <div className="eyebrow" style={{ color: 'rgb(var(--color-accent))' }}>
              Sale
            </div>
            <h2 className="font-display font-bold text-[22px] text-ink leading-tight mt-1.5 tracking-tight">
              Sale overview
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
            {[
              {
                label: 'Public Price',
                value: `${formatEther(collection.mintPrice)} ETH`,
              },
              {
                label: 'Whitelist Price',
                value: collection.whitelistEnabled ? `${formatEther(collection.whitelistPrice)} ETH` : 'Disabled',
              },
              {
                label: 'Whitelist Start',
                value: whitelistStartsIn,
                sub: collection.whitelistEnabled ? formatTimestamp(collection.whitelistStart) : undefined,
              },
              {
                label: 'Public Start',
                value: publicStartsIn,
                sub: formatTimestamp(collection.saleStart),
              },
              {
                label: 'Sale End',
                value: saleEndsIn,
                sub: formatTimestamp(collection.saleEnd),
              },
              {
                label: 'Wallet Limit',
                value: collection.walletLimit === 0 ? 'Unlimited' : collection.walletLimit.toString(),
              },
            ].map((item) => {
              const isDisabled = item.value === 'Disabled';
              return (
                <div key={item.label} className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                    {item.label}
                  </div>
                  <div
                    className={`font-display font-bold mt-1.5 text-[17px] leading-tight tracking-tight ${
                      isDisabled ? 'text-ink-faint' : 'text-ink'
                    }`}
                  >
                    {item.value}
                  </div>
                  {'sub' in item && item.sub ? (
                    <div className="font-mono text-[11px] text-ink-muted mt-1.5">{item.sub}</div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {collection.salePhase === 'whitelist' && (
            <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4 text-body-sm text-ink-muted">
              Whitelist mint is currently active. Public mint opens at{' '}
              <span className="font-medium text-ink">{formatTimestamp(collection.saleStart)}</span>.
            </div>
          )}

          {collectionAddress && (
            <a
              href={`${explorerUrl}/address/${collectionAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-body-sm text-accent hover:underline"
            >
              View on Explorer <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default NFTDetailPage;
