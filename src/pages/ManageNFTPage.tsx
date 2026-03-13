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
import { ArrowLeft, ExternalLink, Loader2, Wallet } from 'lucide-react';
import { NFT_COLLECTION_IMAGES, NFTCollectionContract, getExplorerUrl } from '@/config';
import { getFriendlyTxErrorMessage } from '@/lib/utils/tx-errors';
import { isWhitelistLocked } from '@/lib/utils/nft-sales';
import { normalizeContractURI } from '@/lib/utils/ipfs';

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

function parseWalletList(value: string): Address[] {
  const addresses = value
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const deduped = Array.from(new Set(addresses.map((entry) => entry.toLowerCase())));
  const invalid = deduped.find((entry) => !isAddress(entry));
  if (invalid) {
    throw new Error(`Invalid wallet address: ${invalid}`);
  }

  return deduped as Address[];
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

  const [payoutWalletInput, setPayoutWalletInput] = useState('');
  const [baseURIInput, setBaseURIInput] = useState('');
  const [contractURIInput, setContractURIInput] = useState('');
  const [withdrawInput, setWithdrawInput] = useState('');
  const [whitelistWalletsInput, setWhitelistWalletsInput] = useState('');
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
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'name' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'symbol' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'owner' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'maxSupply' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'totalMinted' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'mintPrice' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'saleEnd' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'whitelistEnabled' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'whitelistStart' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'whitelistPrice' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'payoutWallet' },
      { abi: NFTCollectionContract, address: collectionAddress, functionName: 'contractURI' },
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
      collectionResults.length < 12 ||
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
      saleEnd: readAt<bigint>(6, 0n),
      whitelistEnabled: readAt<boolean>(7, false),
      whitelistStart: readAt<bigint>(8, 0n),
      whitelistPrice: readAt<bigint>(9, 0n),
      payoutWallet: readAt<Address | undefined>(10, undefined),
      contractURI: readAt<string>(11, ''),
    };
  }, [collectionAddress, collectionResults, hasSuccessfulCollectionRead]);

  const isOwner = useMemo(() => {
    if (!connectedAddress || !collection?.owner) return false;
    return connectedAddress.toLowerCase() === collection.owner.toLowerCase();
  }, [connectedAddress, collection?.owner]);

  useEffect(() => {
    if (!collection || initialisedFromChain) return;
    setPayoutWalletInput(collection.payoutWallet ?? '');
    setContractURIInput(collection.contractURI ?? '');
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
    setWhitelistWalletsInput('');
    void Promise.all([refetchCollection(), refetchBalance()]);
    reset();
  }, [hash, isSuccess, refetchBalance, refetchCollection, reset]);

  const isBusy = isPending || isConfirming;
  const whitelistLocked = collection
    ? isWhitelistLocked(collection.whitelistEnabled, collection.whitelistStart)
    : false;

  const handleWhitelistUpdate = (mode: 'add' | 'remove') => {
    if (!collectionAddress) return;
    if (whitelistLocked) {
      toast.error('Whitelist wallets can no longer be edited because the whitelist phase has started.');
      return;
    }

    let wallets: Address[];
    try {
      wallets = parseWalletList(whitelistWalletsInput);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Whitelist contains an invalid address.');
      return;
    }

    if (wallets.length === 0) {
      toast.error('Enter at least one wallet address.');
      return;
    }
    if (wallets.length > 500) {
      toast.error('Whitelist batch size cannot exceed 500 wallets per transaction.');
      return;
    }

    const isSingle = wallets.length === 1;
    const functionName =
      mode === 'add'
        ? (isSingle ? 'addToWhitelist' : 'addManyToWhitelist')
        : (isSingle ? 'removeFromWhitelist' : 'removeManyFromWhitelist');

    setPendingAction(mode === 'add' ? 'whitelistAdd' : 'whitelistRemove');
    writeContract({
      abi: NFTCollectionContract,
      address: collectionAddress,
      functionName,
      args: isSingle ? [wallets[0]] : [wallets],
    });
  };

  const handleSetBaseURI = () => {
    if (!collectionAddress) return;
    if (!baseURIInput.trim()) {
      toast.error('Base URI cannot be empty.');
      return;
    }
    setPendingAction('setBaseURI');
    writeContract({
      abi: NFTCollectionContract,
      address: collectionAddress,
      functionName: 'setBaseURI',
      args: [baseURIInput.trim()],
    });
  };

  const handleSetContractURI = () => {
    if (!collectionAddress) return;
    const normalized = contractURIInput.trim() ? normalizeContractURI(contractURIInput.trim()) : '';
    if (contractURIInput.trim() && !normalized) {
      toast.error('Enter a valid contract URI (for example ipfs://CID).');
      return;
    }
    setPendingAction('setContractURI');
    writeContract({
      abi: NFTCollectionContract,
      address: collectionAddress,
      functionName: 'setContractURI',
      args: [normalized],
    });
  };

  const handleSetPayoutWallet = () => {
    if (!collectionAddress) return;
    if (!isAddress(payoutWalletInput.trim())) {
      toast.error('Enter a valid payout wallet address.');
      return;
    }
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
      try {
        amount = parseEther(withdrawInput.trim());
      } catch {
        toast.error('Invalid withdraw amount.');
        return;
      }
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

  const contractBalanceLabel = contractBalance
    ? `${Number(contractBalance.formatted).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${
        contractBalance.symbol ?? 'ETH'
      }`
    : '0 ETH';
  const whitelistStatusLabel = collection.whitelistEnabled ? 'Enabled' : 'Disabled';
  const whitelistStatusDetail =
    collection.whitelistEnabled && collection.whitelistStart > 0n
      ? `Starts ${new Date(Number(collection.whitelistStart) * 1000).toLocaleString()}`
      : 'No whitelist phase configured';
  const saleEndLabel =
    collection.saleEnd > 0n ? new Date(Number(collection.saleEnd) * 1000).toLocaleDateString() : 'Unset';

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8 max-w-5xl">
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

      <motion.section variants={itemVariants} className="md:hidden">
        <div className="glass-card rounded-3xl p-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-body-sm text-ink-muted">Minted</p>
              <p className="font-display text-display-sm text-ink">{collection.totalMinted.toString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-body-sm text-ink-muted">Max Supply</p>
              <p className="font-display text-display-sm text-ink">{collection.maxSupply.toString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-body-sm text-ink-muted">Public Price</p>
              <p className="font-display text-display-sm text-ink">{formatEther(collection.mintPrice)} ETH</p>
            </div>
            <div className="space-y-1">
              <p className="text-body-sm text-ink-muted">Whitelist Price</p>
              <p className="font-display text-display-sm text-ink">
                {collection.whitelistEnabled ? `${formatEther(collection.whitelistPrice)} ETH` : 'Disabled'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-body-sm text-ink-muted">Contract Balance</p>
              <p className="font-display text-display-sm text-ink">{contractBalanceLabel}</p>
            </div>
            <div className="space-y-1">
              <p className="text-body-sm text-ink-muted">Sale End</p>
              <p className="font-display text-display-sm text-ink">{saleEndLabel}</p>
            </div>
            <div className="col-span-2 space-y-1 border-t border-border pt-4">
              <p className="text-body-sm text-ink-muted">Whitelist Status</p>
              <p className="font-display text-display-sm text-ink">{whitelistStatusLabel}</p>
              <p className="text-body-sm text-ink-muted">{whitelistStatusDetail}</p>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section variants={itemVariants} className="hidden md:grid md:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="stat-card">
          <p className="text-body-sm text-ink-muted">Minted</p>
          <p className="font-display text-display-sm text-ink">{collection.totalMinted.toString()}</p>
        </div>
        <div className="stat-card">
          <p className="text-body-sm text-ink-muted">Max Supply</p>
          <p className="font-display text-display-sm text-ink">{collection.maxSupply.toString()}</p>
        </div>
        <div className="stat-card">
          <p className="text-body-sm text-ink-muted">Public Price</p>
          <p className="font-display text-display-sm text-ink">{formatEther(collection.mintPrice)} ETH</p>
        </div>
        <div className="stat-card">
          <p className="text-body-sm text-ink-muted">Whitelist Price</p>
          <p className="font-display text-display-sm text-ink">
            {collection.whitelistEnabled ? `${formatEther(collection.whitelistPrice)} ETH` : 'Disabled'}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-body-sm text-ink-muted">Contract Balance</p>
          <p className="font-display text-display-sm text-ink">{contractBalanceLabel}</p>
        </div>
      </motion.section>

      <motion.section variants={itemVariants} className="hidden md:grid md:grid-cols-1 gap-4">
        <div className="glass-card rounded-3xl p-5 space-y-1">
          <p className="text-body-sm text-ink-muted">Whitelist Status</p>
          <p className="font-display text-display-sm text-ink">{whitelistStatusLabel}</p>
          <p className="text-body-sm text-ink-muted">{whitelistStatusDetail}</p>
        </div>
        <div className="glass-card rounded-3xl p-5 space-y-1">
          <p className="text-body-sm text-ink-muted">Sale End</p>
          <p className="font-display text-display-sm text-ink">{saleEndLabel}</p>
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
          <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="font-display text-display-sm text-ink">Whitelist Wallets</h2>
              <p className="text-body-sm text-ink-muted">
                Paste one wallet per line, or separate addresses with commas or spaces. Batch limit is 500 per transaction.
              </p>
            </div>
            <textarea
              value={whitelistWalletsInput}
              onChange={(e) => setWhitelistWalletsInput(e.target.value)}
              rows={8}
              disabled={whitelistLocked}
              placeholder="0x1234...\n0xabcd..."
              className="input-field w-full min-h-[180px] resize-y font-mono text-sm disabled:cursor-not-allowed disabled:opacity-60"
            />
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleWhitelistUpdate('add')}
                disabled={isBusy || whitelistLocked}
                className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
              >
                {pendingAction === 'whitelistAdd' && isBusy ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Adding...</>
                ) : (
                  'Add Wallets'
                )}
              </button>
              <button
                onClick={() => handleWhitelistUpdate('remove')}
                disabled={isBusy || whitelistLocked}
                className="btn-secondary inline-flex items-center gap-2 disabled:opacity-60"
              >
                {pendingAction === 'whitelistRemove' && isBusy ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Removing...</>
                ) : (
                  'Remove Wallets'
                )}
              </button>
            </div>
          </motion.section>

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
              <button onClick={handleSetBaseURI} disabled={isBusy} className="btn-secondary inline-flex disabled:opacity-60">
                {pendingAction === 'setBaseURI' && isBusy ? 'Updating...' : 'Update Base URI'}
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-body-sm text-ink-muted font-medium">Contract URI</label>
              <input
                value={contractURIInput}
                onChange={(e) => setContractURIInput(e.target.value)}
                placeholder="ipfs://CID"
                className="input-field w-full"
              />
              <button onClick={handleSetContractURI} disabled={isBusy} className="btn-secondary inline-flex disabled:opacity-60">
                {pendingAction === 'setContractURI' && isBusy ? 'Updating...' : 'Update Contract URI'}
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
              <button onClick={handleSetPayoutWallet} disabled={isBusy} className="btn-secondary inline-flex disabled:opacity-60">
                {pendingAction === 'setPayoutWallet' && isBusy ? 'Updating...' : 'Update Payout Wallet'}
              </button>
            </div>
          </motion.section>

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
