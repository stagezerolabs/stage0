import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import {
  useAccount,
  useBalance,
  useChainId,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { formatEther, isAddress, parseEther, type Address } from 'viem';
import { toast } from 'sonner';
import { ArrowLeft, ExternalLink, Loader2, Save, Shield, Wallet } from 'lucide-react';
import { NFT_COLLECTION_IMAGES, NFTCollectionContract, getExplorerUrl } from '@/config';
import { getFriendlyTxErrorMessage } from '@/lib/utils/tx-errors';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
};

function toDateTimeLocal(ts: bigint | undefined): string {
  if (!ts || ts === 0n) return '';
  const date = new Date(Number(ts) * 1000);
  const tzOffsetMs = date.getTimezoneOffset() * 60_000;
  const local = new Date(date.getTime() - tzOffsetMs);
  return local.toISOString().slice(0, 16);
}

const ManageNFTPage: React.FC = () => {
  const { address: collectionParam } = useParams<{ address: string }>();
  const { address: connectedAddress } = useAccount();
  const chainId = useChainId();
  const explorerUrl = getExplorerUrl(chainId);
  const isValidAddress = Boolean(collectionParam && isAddress(collectionParam, { strict: false }));
  const collectionAddress = (isValidAddress ? collectionParam : undefined) as Address | undefined;
  const collectionImage = collectionAddress
    ? NFT_COLLECTION_IMAGES[collectionAddress.toLowerCase()]
    : undefined;

  const [mintPriceInput, setMintPriceInput] = useState('');
  const [walletLimitInput, setWalletLimitInput] = useState('0');
  const [saleStartInput, setSaleStartInput] = useState('');
  const [saleEndInput, setSaleEndInput] = useState('');
  const [payoutWalletInput, setPayoutWalletInput] = useState('');
  const [baseURIInput, setBaseURIInput] = useState('');
  const [withdrawInput, setWithdrawInput] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [initialisedFromChain, setInitialisedFromChain] = useState(false);

  const {
    data: hash,
    writeContract,
    isPending,
    error: writeError,
    reset,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const handledHashRef = useRef<`0x${string}` | undefined>(undefined);

  const collectionQueries = useMemo(() => {
    if (!collectionAddress) return [];
    return [
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'name' },        // 0
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'symbol' },      // 1
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'owner' },       // 2
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'maxSupply' },   // 3
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'totalMinted' }, // 4
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'mintPrice' },   // 5
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'walletLimit' }, // 6
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'saleStart' },   // 7
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'saleEnd' },     // 8
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'payoutWallet' },// 9
    ] as const;
  }, [collectionAddress]);

  const {
    data: collectionResults,
    isLoading: isCollectionLoading,
    error: collectionReadError,
    refetch: refetchCollection,
  } = useReadContracts({
    contracts: collectionQueries as readonly any[],
    query: {
      enabled: collectionQueries.length > 0,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const hasSuccessfulCollectionRead = useMemo(() => {
    if (!collectionResults || collectionResults.length === 0) return false;
    return collectionResults.some((entry) => entry.status === 'success');
  }, [collectionResults]);

  const { data: contractBalance, refetch: refetchBalance } = useBalance({
    address: collectionAddress,
    query: {
      enabled: Boolean(collectionAddress),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const collection = useMemo(() => {
    if (
      !collectionAddress ||
      !collectionResults ||
      collectionResults.length < 10 ||
      !hasSuccessfulCollectionRead
    ) {
      return null;
    }

    const readAt = <T,>(index: number, fallback: T): T => {
      const entry = collectionResults[index];
      if (!entry || entry.status !== 'success' || entry.result === undefined) return fallback;
      return entry.result as T;
    };

    return {
      address: collectionAddress,
      name: readAt<string>(0, 'NFT Collection'),
      symbol: readAt<string>(1, 'NFT'),
      owner: readAt<Address | undefined>(2, undefined),
      maxSupply: readAt<bigint>(3, 0n),
      totalMinted: readAt<bigint>(4, 0n),
      mintPrice: readAt<bigint>(5, 0n),
      walletLimitRaw: readAt<bigint | number | undefined>(6, undefined),
      saleStart: readAt<bigint>(7, 0n),
      saleEnd: readAt<bigint>(8, 0n),
      payoutWallet: readAt<Address | undefined>(9, undefined),
    };
  }, [collectionAddress, collectionResults, hasSuccessfulCollectionRead]);

  const isOwner = useMemo(() => {
    if (!connectedAddress || !collection?.owner) return false;
    return connectedAddress.toLowerCase() === collection.owner.toLowerCase();
  }, [connectedAddress, collection?.owner]);

  // Initialise form fields from chain data once
  useEffect(() => {
    if (!collection || initialisedFromChain) return;
    const walletLimitRaw = collection.walletLimitRaw;
    const walletLimitNumber =
      typeof walletLimitRaw === 'number' ? walletLimitRaw : Number(walletLimitRaw ?? 0);
    setMintPriceInput(formatEther(collection.mintPrice));
    setWalletLimitInput(String(walletLimitNumber));
    setSaleStartInput(toDateTimeLocal(collection.saleStart));
    setSaleEndInput(toDateTimeLocal(collection.saleEnd));
    setPayoutWalletInput(collection.payoutWallet ?? '');
    setInitialisedFromChain(true);
  }, [collection, initialisedFromChain]);

  useEffect(() => {
    if (!writeError) return;
    toast.error(getFriendlyTxErrorMessage(writeError, 'NFT action'));
  }, [writeError]);

  useEffect(() => {
    if (!hash || !isSuccess) return;
    if (handledHashRef.current === hash) return;
    handledHashRef.current = hash;
    toast.success('Transaction confirmed.');
    setPendingAction(null);
    void Promise.all([refetchCollection(), refetchBalance()]);
    reset();
  }, [hash, isSuccess, refetchBalance, refetchCollection, reset]);

  const isBusy = isPending || isConfirming;

  const handleSaveMintConfig = () => {
    if (!collectionAddress) return;
    if (!mintPriceInput.trim()) { toast.error('Mint price is required.'); return; }
    if (!saleStartInput) { toast.error('Sale start date is required.'); return; }

    let mintPriceValue: bigint;
    try { mintPriceValue = parseEther(mintPriceInput.trim()); }
    catch { toast.error('Invalid mint price.'); return; }

    const walletLimitNumber = Number(walletLimitInput || '0');
    if (!Number.isInteger(walletLimitNumber) || walletLimitNumber < 0 || walletLimitNumber > 4_294_967_295) {
      toast.error('Wallet limit must be between 0 and 4,294,967,295.');
      return;
    }

    const saleStartTs = Math.floor(new Date(saleStartInput).getTime() / 1000);
    if (!Number.isFinite(saleStartTs) || saleStartTs <= 0) { toast.error('Invalid sale start time.'); return; }

    const saleEndTs = saleEndInput ? Math.floor(new Date(saleEndInput).getTime() / 1000) : 0;
    if (saleEndInput && (!Number.isFinite(saleEndTs) || saleEndTs <= saleStartTs)) {
      toast.error('Sale end must be later than sale start.');
      return;
    }

    setPendingAction('saveMintConfig');
    writeContract({
      abi: NFTCollectionContract,
      address: collectionAddress,
      functionName: 'setMintConfig',
      args: [{
        saleStart: BigInt(saleStartTs),
        saleEnd: BigInt(saleEndTs),
        walletLimit: walletLimitNumber,
        price: mintPriceValue,
      }],
    });
  };

  const handleSetBaseURI = () => {
    if (!collectionAddress) return;
    if (!baseURIInput.trim()) { toast.error('Base URI cannot be empty.'); return; }
    setPendingAction('setBaseURI');
    writeContract({
      abi: NFTCollectionContract,
      address: collectionAddress,
      functionName: 'setBaseURI',
      args: [baseURIInput.trim()],
    });
  };

  const handleSetPayoutWallet = () => {
    if (!collectionAddress) return;
    if (!isAddress(payoutWalletInput.trim())) { toast.error('Enter a valid payout wallet address.'); return; }
    setPendingAction('setPayoutWallet');
    writeContract({
      abi: NFTCollectionContract,
      address: collectionAddress,
      functionName: 'setPayoutWallet',
      args: [payoutWalletInput.trim() as Address],
    });
  };

  const handleWithdrawRaised = () => {
    if (!collectionAddress) return;
    let amount = 0n;
    if (withdrawInput.trim()) {
      try { amount = parseEther(withdrawInput.trim()); }
      catch { toast.error('Invalid withdraw amount.'); return; }
    }
    setPendingAction('withdrawRaised');
    writeContract({
      abi: NFTCollectionContract,
      address: collectionAddress,
      functionName: 'withdrawRaised',
      args: [amount],
    });
  };

  if (!isValidAddress || !collectionAddress) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        <motion.div variants={itemVariants} className="glass-card rounded-3xl p-8 text-center space-y-4">
          <h1 className="font-display text-display-md text-ink">Invalid Collection Address</h1>
          <p className="text-body text-ink-muted">The provided NFT collection address is not valid.</p>
          <Link to="/dashboard" className="btn-primary inline-flex">Back to Dashboard</Link>
        </motion.div>
      </motion.div>
    );
  }

  if (isCollectionLoading) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        <motion.div variants={itemVariants} className="glass-card rounded-3xl p-8 text-center space-y-4">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-accent" />
          <p className="text-body text-ink-muted">Loading collection details...</p>
        </motion.div>
      </motion.div>
    );
  }

  if (!collection) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        <motion.div variants={itemVariants} className="glass-card rounded-3xl p-8 text-center space-y-4">
          <h1 className="font-display text-display-md text-ink">Failed to Load Collection</h1>
          <p className="text-body text-ink-muted">
            Could not fetch data for this collection. Ensure the address is correct and your wallet is on RISE Testnet.
          </p>
          {collectionReadError && (
            <p className="text-body-sm text-status-error">
              {getFriendlyTxErrorMessage(collectionReadError, 'Read collection')}
            </p>
          )}
          <a
            href={collectionAddress ? `${explorerUrl}/address/${collectionAddress}` : explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary inline-flex items-center gap-2"
          >
            Check on Explorer <ExternalLink className="w-4 h-4" />
          </a>
          <Link to="/dashboard" className="btn-primary inline-flex">Back to Dashboard</Link>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8 max-w-4xl">
      {/* Header */}
      <motion.section variants={itemVariants} className="space-y-3">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div className="flex items-center gap-4">
            {collectionImage && (
              <img
                src={collectionImage}
                alt={collection.name}
                className="w-16 h-16 rounded-2xl object-cover border border-ink/10"
              />
            )}
            <div className="space-y-1">
              <h1 className="font-display text-display-lg text-ink">Manage NFT Collection</h1>
              <p className="text-body-lg text-ink-muted">
                {collection.name} ({collection.symbol})
              </p>
            </div>
          </div>
          <a
            href={`${explorerUrl}/address/${collection.address}`}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary inline-flex items-center gap-2"
          >
            View on Explorer <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </motion.section>

      {/* Stats */}
      <motion.section variants={itemVariants} className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-body-sm text-ink-muted">Minted</p>
          <p className="font-display text-display-sm text-ink">
            {collection.totalMinted.toString()}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-body-sm text-ink-muted">Max Supply</p>
          <p className="font-display text-display-sm text-ink">
            {collection.maxSupply.toString()}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-body-sm text-ink-muted">Mint Price</p>
          <p className="font-display text-display-sm text-ink">
            {formatEther(collection.mintPrice)} ETH
          </p>
        </div>
        <div className="stat-card">
          <p className="text-body-sm text-ink-muted">Contract Balance</p>
          <p className="font-display text-display-sm text-ink">
            {contractBalance
              ? `${Number(contractBalance.formatted).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${contractBalance.symbol ?? 'ETH'}`
              : '0 ETH'}
          </p>
        </div>
      </motion.section>

      {!isOwner && (
        <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6">
          <p className="text-body text-ink-muted">
            Connected wallet is not the collection owner. You can view this collection, but only the owner can update settings.
          </p>
        </motion.section>
      )}

      {isOwner && (
        <>
          {/* Sale Configuration */}
          <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent" />
              <h2 className="font-display text-display-sm text-ink">Sale Configuration</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-body-sm text-ink-muted font-medium">Mint Price (ETH)</label>
                <input
                  value={mintPriceInput}
                  onChange={(e) => setMintPriceInput(e.target.value)}
                  className="input-field w-full"
                  placeholder="0.01"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-body-sm text-ink-muted font-medium">Wallet Limit (0 = unlimited)</label>
                <input
                  type="number"
                  min="0"
                  value={walletLimitInput}
                  onChange={(e) => setWalletLimitInput(e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-body-sm text-ink-muted font-medium">Sale Start</label>
                <input
                  type="datetime-local"
                  value={saleStartInput}
                  onChange={(e) => setSaleStartInput(e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-body-sm text-ink-muted font-medium">Sale End (optional)</label>
                <input
                  type="datetime-local"
                  value={saleEndInput}
                  onChange={(e) => setSaleEndInput(e.target.value)}
                  className="input-field w-full"
                />
              </div>
            </div>
            <button
              onClick={handleSaveMintConfig}
              disabled={isBusy}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
            >
              {pendingAction === 'saveMintConfig' && isBusy ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
              ) : (
                <><Save className="w-4 h-4" />Save Sale Config</>
              )}
            </button>
          </motion.section>

          {/* Collection Settings */}
          <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-5">
            <h2 className="font-display text-display-sm text-ink">Collection Settings</h2>

            <div className="space-y-2">
              <label className="text-body-sm text-ink-muted font-medium">Base URI</label>
              <input
                value={baseURIInput}
                onChange={(e) => setBaseURIInput(e.target.value)}
                placeholder="ipfs://.../"
                className="input-field w-full"
              />
              <button
                onClick={handleSetBaseURI}
                disabled={isBusy}
                className="btn-secondary inline-flex disabled:opacity-60"
              >
                {pendingAction === 'setBaseURI' && isBusy ? 'Updating...' : 'Update Base URI'}
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-body-sm text-ink-muted font-medium">Payout Wallet</label>
              <input
                value={payoutWalletInput}
                onChange={(e) => setPayoutWalletInput(e.target.value)}
                placeholder="0x..."
                className="input-field w-full font-mono text-sm"
              />
              <button
                onClick={handleSetPayoutWallet}
                disabled={isBusy}
                className="btn-secondary inline-flex disabled:opacity-60"
              >
                {pendingAction === 'setPayoutWallet' && isBusy ? 'Updating...' : 'Update Payout Wallet'}
              </button>
            </div>
          </motion.section>

          {/* Withdraw */}
          <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-5">
            <h2 className="font-display text-display-sm text-ink">Withdraw Raised Funds</h2>
            <p className="text-body-sm text-ink-muted">
              Leave amount empty to withdraw the entire contract balance.
            </p>
            <div className="space-y-2">
              <label className="text-body-sm text-ink-muted font-medium">Amount (ETH)</label>
              <input
                value={withdrawInput}
                onChange={(e) => setWithdrawInput(e.target.value)}
                placeholder="e.g. 1.25"
                className="input-field w-full"
              />
              <button
                onClick={handleWithdrawRaised}
                disabled={isBusy}
                className="btn-secondary inline-flex items-center gap-2 disabled:opacity-60"
              >
                {pendingAction === 'withdrawRaised' && isBusy ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Withdrawing...</>
                ) : (
                  <><Wallet className="w-4 h-4" />Withdraw</>
                )}
              </button>
            </div>
          </motion.section>
        </>
      )}
    </motion.div>
  );
};

export default ManageNFTPage;
