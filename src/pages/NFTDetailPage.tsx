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
  Shield,
  Users,
  Layers,
} from 'lucide-react';
import { NFTCollectionContract, NFT_COLLECTION_IMAGES, getExplorerUrl } from '@/config';
import { getFriendlyTxErrorMessage } from '@/lib/utils/tx-errors';
import { contractUriToHttp, ipfsUriToHttp, normalizeContractURI } from '@/lib/utils/ipfs';
import { getNFTActiveMintPrice, getNFTSalePhase, getNFTSaleStatus } from '@/lib/utils/nft-sales';

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
      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold bg-accent/10 text-accent">
        <Shield className="w-3.5 h-3.5" />
        Whitelist Live
      </span>
    );
  }

  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold bg-status-live-bg text-status-live">
        <span className="w-2 h-2 rounded-full bg-status-live animate-pulse" />
        Public Live
      </span>
    );
  }

  if (status === 'upcoming') {
    return (
      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold bg-status-upcoming-bg text-status-upcoming">
        <Clock className="w-3.5 h-3.5" />
        Upcoming
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold bg-status-closed-bg text-status-closed">
      <CheckCircle2 className="w-3.5 h-3.5" />
      Ended
    </span>
  );
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

function formatTimestamp(ts: bigint): string {
  if (!ts || ts === 0n) return 'Not set';
  return new Date(Number(ts) * 1000).toLocaleString();
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
      <motion.div variants={itemVariants}>
        <Link
          to="/presales"
          className="inline-flex items-center gap-2 text-body text-ink-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Launchpad
        </Link>
      </motion.div>

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
            {getStatusBadge(collection.status, collection.salePhase)}
          </div>
        </div>
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
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

          <motion.div variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-4">
            <h2 className="font-display text-display-sm text-ink">Sale Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  label: 'Public Price',
                  value: `${formatEther(collection.mintPrice)} ETH`,
                  icon: Layers,
                },
                {
                  label: 'Whitelist Price',
                  value: collection.whitelistEnabled ? `${formatEther(collection.whitelistPrice)} ETH` : 'Disabled',
                  icon: Shield,
                },
                {
                  label: 'Whitelist Start',
                  value: collection.whitelistEnabled ? formatTimestamp(collection.whitelistStart) : 'Disabled',
                  icon: Clock,
                },
                {
                  label: 'Public Start',
                  value: formatTimestamp(collection.saleStart),
                  icon: Clock,
                },
                {
                  label: 'Sale End',
                  value: formatTimestamp(collection.saleEnd),
                  icon: Clock,
                },
                {
                  label: 'Wallet Limit',
                  value: collection.walletLimit === 0 ? 'Unlimited' : collection.walletLimit.toString(),
                  icon: Users,
                },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3 p-3 rounded-2xl bg-ink/[0.02]">
                  <div className="w-8 h-8 rounded-xl bg-accent-muted text-accent flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-body-sm text-ink-muted">{item.label}</p>
                    <p className="text-body font-medium text-ink">{item.value}</p>
                  </div>
                </div>
              ))}
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

        <div className="space-y-6">
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

          {collection.status === 'live' && isConnected && (
            <motion.div variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-4">
              <h3 className="font-display text-display-sm text-ink">Mint NFT</h3>

              <div className="rounded-2xl border border-border bg-canvas-alt p-4 space-y-1">
                <p className="text-body-sm text-ink-muted">Active phase</p>
                <p className="text-body font-medium text-ink">
                  {collection.salePhase === 'whitelist' ? 'Whitelist mint' : 'Public mint'}
                </p>
                <p className="text-body-sm text-ink-muted">
                  Current price: <span className="font-medium text-ink">{formatEther(unitPrice)} ETH</span>
                </p>
              </div>

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
                  <p>Price per NFT: {formatEther(unitPrice)} ETH</p>
                  <p className="font-medium text-ink">Total: {formatEther(totalCost)} ETH</p>
                  {collection.walletLimit > 0 && <p>Max per wallet: {collection.walletLimit}</p>}
                </div>

                {!userCanMintCurrentPhase ? (
                  <div className="p-3 rounded-xl bg-status-upcoming-bg text-status-upcoming text-sm">
                    Only whitelisted wallets can mint during the current phase. Public mint opens{' '}
                    {formatTimestamp(collection.saleStart)}.
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

          {collection.status === 'upcoming' && (
            <motion.div variants={itemVariants} className="glass-card rounded-3xl p-6 text-center space-y-3">
              <Clock className="w-8 h-8 text-status-upcoming mx-auto" />
              <p className="text-body font-medium text-ink">Mint Has Not Started Yet</p>
              <p className="text-body-sm text-ink-muted">
                {collection.whitelistEnabled
                  ? `Whitelist opens ${formatTimestamp(collection.whitelistStart)}`
                  : `Public mint opens ${formatTimestamp(collection.saleStart)}`}
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
      </div>
    </motion.div>
  );
};

export default NFTDetailPage;
