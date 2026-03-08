import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, Link } from 'react-router-dom';
import {
  useAccount,
  useChainId,
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
  Users,
  Shield,
  Layers,
} from 'lucide-react';
import { NFTCollectionContract, NFT_COLLECTION_IMAGES, getExplorerUrl } from '@/config';
import { getFriendlyTxErrorMessage } from '@/lib/utils/tx-errors';
import { contractUriToHttp, ipfsUriToHttp, normalizeContractURI } from '@/lib/utils/ipfs';

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
      return (
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold bg-status-closed-bg text-status-closed">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Ended
        </span>
      );
    default:
      return null;
  }
}

function computeStatus(
  saleStart: bigint,
  saleEnd: bigint,
  totalMinted: bigint,
  maxSupply: bigint
): 'live' | 'upcoming' | 'ended' {
  if (maxSupply > 0n && totalMinted >= maxSupply) return 'ended';
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (saleStart > now) return 'upcoming';
  if (saleEnd !== 0n && saleEnd <= now) return 'ended';
  return 'live';
}

function resolveMetadataImageUri(imageUri: string, metadataUri: string): string {
  const normalized = imageUri.trim();
  if (!normalized) return '';

  if (
    normalized.startsWith('ipfs://') ||
    normalized.startsWith('http://') ||
    normalized.startsWith('https://')
  ) {
    return ipfsUriToHttp(normalized);
  }

  const metadataHttpUri = `${contractUriToHttp(metadataUri).replace(/\/+$/, '')}/`;
  try {
    return new URL(normalized, metadataHttpUri).toString();
  } catch {
    return ipfsUriToHttp(normalized);
  }
}

const NFTDetailPage: React.FC = () => {
  const { address: collectionParam } = useParams<{ address: string }>();
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const explorerUrl = getExplorerUrl(chainId);

  const isValidAddress = Boolean(collectionParam && isAddress(collectionParam));
  const collectionAddress = (isValidAddress ? collectionParam : undefined) as Address | undefined;
  const collectionImage =
    collectionAddress ? NFT_COLLECTION_IMAGES[collectionAddress.toLowerCase()] : undefined;

  const [mintQty, setMintQty] = useState(1);
  const [contractMetadata, setContractMetadata] = useState<{ image?: string; description?: string } | null>(null);

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
    ] as const;
  }, [collectionAddress]);

  const userMintedQuery = useMemo(() => {
    if (!collectionAddress || !userAddress) return [];
    return [
      {
        abi: NFTCollectionContract,
        address: collectionAddress,
        functionName: 'mintedBy',
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

  const { data: userMintedData, refetch: refetchUserMinted } = useReadContracts({
    contracts: userMintedQuery as readonly any[],
    query: {
      enabled: userMintedQuery.length > 0,
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
    const status = computeStatus(saleStart, saleEnd, totalMinted, maxSupply);
    const remaining = maxSupply > 0n ? maxSupply - totalMinted : 0n;
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
      status,
      remaining,
    };
  }, [collectionAddress, collectionData]);

  useEffect(() => {
    let cancelled = false;

    const rawContractURI = collection?.contractURI?.trim() ?? '';
    const metadataUri = normalizeContractURI(rawContractURI);

    if (!metadataUri) {
      setContractMetadata(null);
      return;
    }

    (async () => {
      try {
        const response = await fetch(contractUriToHttp(metadataUri));
        if (!response.ok) throw new Error(`Failed metadata fetch: ${response.status}`);

        const metadata = (await response.json()) as Record<string, unknown>;
        const image =
          typeof metadata.image === 'string' && metadata.image.trim().length > 0
            ? resolveMetadataImageUri(metadata.image, metadataUri)
            : undefined;
        const description =
          typeof metadata.description === 'string' && metadata.description.trim().length > 0
            ? metadata.description.trim()
            : undefined;

        if (!cancelled) {
          setContractMetadata({ image, description });
        }
      } catch {
        if (!cancelled) {
          setContractMetadata(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [collection?.contractURI]);

  const userMinted = useMemo(() => {
    if (!userMintedData || userMintedData.length === 0) return 0n;
    return (userMintedData[0]?.result as bigint | undefined) ?? 0n;
  }, [userMintedData]);

  const maxMintable = useMemo(() => {
    if (!collection) return 0;
    const walletLimit = collection.walletLimit;
    const remaining = Number(collection.remaining);
    if (walletLimit === 0) {
      // No per-wallet limit, can mint up to remaining supply
      return remaining;
    }
    const leftForWallet = Math.max(0, walletLimit - Number(userMinted));
    return Math.min(leftForWallet, remaining);
  }, [collection, userMinted]);

  const totalCost = useMemo(() => {
    if (!collection) return 0n;
    return collection.mintPrice * BigInt(mintQty);
  }, [collection, mintQty]);

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
    toast.error(getFriendlyTxErrorMessage(writeError, 'mint'));
  }, [writeError]);

  useEffect(() => {
    if (!txHash || !isSuccess) return;
    if (handledHashRef.current === txHash) return;
    handledHashRef.current = txHash;
    toast.success(`Minted ${mintQty} NFT${mintQty > 1 ? 's' : ''} successfully!`);
    setMintQty(1);
    resetWrite();
    void Promise.all([refetch(), refetchUserMinted()]);
  }, [txHash, isSuccess, mintQty, refetch, refetchUserMinted, resetWrite]);

  const handleMint = () => {
    if (!collectionAddress || mintQty < 1) return;
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

  const resolvedCollectionImage = contractMetadata?.image || collectionImage;

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

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Back */}
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
      <motion.section variants={itemVariants} className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-display-lg text-ink">{collection.name}</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent-secondary/15 text-accent-secondary">
                NFT
              </span>
            </div>
            <p className="text-body text-ink-muted">{collection.symbol}</p>
            {contractMetadata?.description && (
              <p className="text-body-sm text-ink-faint max-w-2xl">{contractMetadata.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(collection.status)}
          </div>
        </div>
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Collection image */}
          <motion.div variants={itemVariants} className="glass-card rounded-3xl overflow-hidden">
            {resolvedCollectionImage ? (
              <img
                src={resolvedCollectionImage}
                alt={collection.name}
                className="w-full object-cover max-h-80"
              />
            ) : (
              <div className="w-full h-48 flex items-center justify-center bg-ink/5">
                <Image className="w-12 h-12 text-ink-faint" />
              </div>
            )}
          </motion.div>

          {/* Mint Progress */}
          <motion.div variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-4">
            <h2 className="font-display text-display-sm text-ink">Mint Progress</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-body">
                <span className="text-ink-muted">Minted</span>
                <span className="text-ink font-medium">
                  {collection.totalMinted.toString()} / {collection.maxSupply.toString()}
                </span>
              </div>
              <div className="w-full h-4 bg-ink/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${mintProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-body-sm text-ink-muted">
                <span>{mintProgress}% minted</span>
                <span>{collection.remaining.toString()} remaining</span>
              </div>
            </div>
          </motion.div>

          {/* Collection Details */}
          <motion.div variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-4">
            <h2 className="font-display text-display-sm text-ink">Collection Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  label: 'Mint Price',
                  value: `${formatEther(collection.mintPrice)} ETH`,
                  icon: Layers,
                },
                {
                  label: 'Max Supply',
                  value: collection.maxSupply.toString(),
                  icon: Layers,
                },
                {
                  label: 'Wallet Limit',
                  value: collection.walletLimit === 0 ? 'Unlimited' : collection.walletLimit.toString(),
                  icon: Shield,
                },
                {
                  label: 'Sale Start',
                  value:
                    collection.saleStart && collection.saleStart > 0n
                      ? new Date(Number(collection.saleStart) * 1000).toLocaleString()
                      : 'Immediately',
                  icon: Clock,
                },
                {
                  label: 'Sale End',
                  value:
                    collection.saleEnd && collection.saleEnd > 0n
                      ? new Date(Number(collection.saleEnd) * 1000).toLocaleString()
                      : 'No end date',
                  icon: Clock,
                },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-2xl bg-ink/[0.02]">
                  <div className="w-8 h-8 rounded-xl bg-accent-muted text-accent flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-body-sm text-ink-muted">{item.label}</p>
                    <p className="text-body font-medium text-ink truncate">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
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

        {/* Right column: Mint */}
        <div className="space-y-6">
          {/* User stats */}
          {isConnected && (
            <motion.div variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-3">
              <h3 className="font-display text-display-sm text-ink">Your Mints</h3>
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
              </div>
            </motion.div>
          )}

          {/* Mint form */}
          {collection.status === 'live' && isConnected && (
            <motion.div variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-4">
              <h3 className="font-display text-display-sm text-ink">Mint NFT</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-body-sm text-ink-muted font-medium mb-1 block">
                    Quantity
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setMintQty((q) => Math.max(1, q - 1))}
                      disabled={mintQty <= 1}
                      className="w-9 h-9 rounded-xl bg-ink/5 hover:bg-ink/10 text-ink font-bold disabled:opacity-30 transition-colors"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={maxMintable}
                      value={mintQty}
                      onChange={(e) => {
                        const v = Math.max(1, Math.min(maxMintable, Number(e.target.value) || 1));
                        setMintQty(v);
                        resetWrite();
                      }}
                      className="input-field w-20 text-center"
                    />
                    <button
                      onClick={() => setMintQty((q) => Math.min(maxMintable, q + 1))}
                      disabled={mintQty >= maxMintable}
                      className="w-9 h-9 rounded-xl bg-ink/5 hover:bg-ink/10 text-ink font-bold disabled:opacity-30 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="text-body-sm text-ink-muted space-y-1">
                  <p>Price per NFT: {formatEther(collection.mintPrice)} ETH</p>
                  <p className="font-medium text-ink">
                    Total: {formatEther(totalCost)} ETH
                  </p>
                  {collection.walletLimit > 0 && (
                    <p>Max per wallet: {collection.walletLimit}</p>
                  )}
                </div>

                {maxMintable === 0 ? (
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

          {collection.status === 'upcoming' && (
            <motion.div variants={itemVariants} className="glass-card rounded-3xl p-6 text-center space-y-3">
              <Clock className="w-8 h-8 text-status-upcoming mx-auto" />
              <p className="text-body font-medium text-ink">Sale Not Started</p>
              <p className="text-body-sm text-ink-muted">
                Starts{' '}
                {collection.saleStart > 0n
                  ? new Date(Number(collection.saleStart) * 1000).toLocaleString()
                  : 'soon'}
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
            <motion.div
              variants={itemVariants}
              className="glass-card rounded-3xl p-6 text-center space-y-3"
            >
              <Users className="w-8 h-8 text-accent mx-auto" />
              <p className="text-body text-ink-muted">
                Connect your wallet to mint from this collection.
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default NFTDetailPage;
