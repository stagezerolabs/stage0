import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAccount, useChainId, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { decodeEventLog, isAddress, parseEther, type Address } from 'viem';
import { NFTFactory, getContractAddresses, getExplorerUrl } from '@/config';
import { AlertTriangle, CheckCircle2, ExternalLink, Image, Layers, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getFriendlyTxErrorMessage } from '@/lib/utils/tx-errors';

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

type NFTMode = 'erc721' | 'erc721a';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

const CreateNFTPage: React.FC = () => {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { nftFactory } = getContractAddresses(chainId);
  const explorerUrl = getExplorerUrl(chainId);

  const [mode, setMode] = useState<NFTMode>('erc721');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [baseURI, setBaseURI] = useState('');
  const [maxSupply, setMaxSupply] = useState('');
  const [mintPrice, setMintPrice] = useState('');
  const [walletLimit, setWalletLimit] = useState('');
  const [saleStart, setSaleStart] = useState('');
  const [saleEnd, setSaleEnd] = useState('');
  const [payoutWallet, setPayoutWallet] = useState('');
  const [createdCollectionAddress, setCreatedCollectionAddress] = useState<string | null>(null);
  const [showPostDeployPopup, setShowPostDeployPopup] = useState(false);

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
      toast.success('NFT collection deployed successfully. Check the next-steps popup.');
    }
  }, [isSuccess, receipt, nftFactory, createdCollectionAddress]);

  const canSubmit = useMemo(() => {
    if (!isConnected) return false;
    if (!name || !symbol || !baseURI || !maxSupply || !mintPrice || !saleStart) return false;
    if (!Number.isFinite(Number(maxSupply)) || Number(maxSupply) <= 0) return false;
    if (!Number.isFinite(Number(mintPrice)) || Number(mintPrice) < 0) return false;
    if (walletLimit && (!Number.isInteger(Number(walletLimit)) || Number(walletLimit) < 0)) return false;
    if (payoutWallet && !isAddress(payoutWallet)) return false;
    if (!Number.isFinite(new Date(saleStart).getTime())) return false;
    if (saleEnd && !Number.isFinite(new Date(saleEnd).getTime())) return false;
    return true;
  }, [isConnected, name, symbol, baseURI, maxSupply, mintPrice, walletLimit, payoutWallet, saleStart, saleEnd]);

  const handleSubmit = () => {
    if (!canSubmit) return;

    const saleStartTs = Math.floor(new Date(saleStart).getTime() / 1000);
    const saleEndTs = saleEnd ? Math.floor(new Date(saleEnd).getTime() / 1000) : 0;
    if (saleEndTs !== 0 && saleEndTs <= saleStartTs) {
      toast.error('Sale end must be later than sale start.');
      return;
    }

    const limit = walletLimit ? Number(walletLimit) : 0;
    if (limit > 4_294_967_295) {
      toast.error('Wallet limit is too large.');
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
            baseURI: baseURI.trim(),
            maxSupply: BigInt(maxSupply),
            payoutWallet: payoutWallet ? (payoutWallet as Address) : ZERO_ADDRESS,
            mintConfig: {
              saleStart: BigInt(saleStartTs),
              saleEnd: BigInt(saleEndTs),
              walletLimit: limit,
              price: parseEther(mintPrice),
            },
          },
        ],
      });
    } catch {
      toast.error('Invalid mint configuration. Please check your inputs.');
    }
  };

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
              <Link
                to={`/nfts/manage/${createdCollectionAddress}`}
                className="btn-secondary inline-flex items-center gap-2"
              >
                Manage Collection
              </Link>
              <Link to="/dashboard" className="btn-secondary inline-flex">
                Open Dashboard
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
                <h3 className="font-display text-display-sm text-ink">Next Steps</h3>
                <p className="text-body-sm text-ink-muted">
                  Your collection is deployed. Follow these steps before opening mint.
                </p>
              </div>
              <ol className="list-decimal pl-5 space-y-2 text-body-sm text-ink-muted">
                <li>Open `Manage Collection` and confirm sale window, mint price, and wallet limit.</li>
                <li>Set your payout wallet and base URI.</li>
                <li>Share your explorer link with your community.</li>
                <li>Track collection activity from Dashboard and Launchpad NFT tags.</li>
              </ol>
              <div className="flex flex-wrap gap-2">
                <Link to={`/nfts/manage/${createdCollectionAddress}`} className="btn-primary">
                  Open Manage Collection
                </Link>
                <button
                  onClick={() => setShowPostDeployPopup(false)}
                  className="btn-secondary"
                >
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
      className="max-w-3xl mx-auto space-y-8"
    >
      <motion.section variants={itemVariants} className="space-y-2">
        <h1 className="font-display text-display-lg text-ink">Create NFT Collection</h1>
        <p className="text-body-lg text-ink-muted">
          Deploy a new ERC721 or ERC721A collection with custom sale settings.
        </p>
      </motion.section>

      <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-6">
        <h2 className="font-display text-display-sm text-ink">Collection Type</h2>
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
            <p className="text-body-sm">Standard NFT contract.</p>
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
            <p className="text-body-sm">Gas-optimized for batch minting.</p>
          </button>
        </div>

        <h2 className="font-display text-display-sm text-ink">Collection Details</h2>
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
              placeholder="ipfs://.../"
              className="input-field w-full"
            />
          </div>
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
            <label className="text-body-sm text-ink-muted font-medium">Mint Price (ETH)</label>
            <input
              type="text"
              value={mintPrice}
              onChange={(e) => setMintPrice(e.target.value)}
              placeholder="0.05"
              className="input-field w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-body-sm text-ink-muted font-medium">Wallet Limit (0 = unlimited)</label>
            <input
              type="number"
              min="0"
              value={walletLimit}
              onChange={(e) => setWalletLimit(e.target.value)}
              placeholder="5"
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
          <div className="space-y-1.5">
            <label className="text-body-sm text-ink-muted font-medium">Sale Start</label>
            <input
              type="datetime-local"
              value={saleStart}
              onChange={(e) => setSaleStart(e.target.value)}
              className="input-field w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-body-sm text-ink-muted font-medium">Sale End (optional)</label>
            <input
              type="datetime-local"
              value={saleEnd}
              onChange={(e) => setSaleEnd(e.target.value)}
              className="input-field w-full"
            />
          </div>
        </div>

        {writeError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-status-error-bg text-status-error text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>{getFriendlyTxErrorMessage(writeError, 'Create NFT')}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || isPending || isConfirming}
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
