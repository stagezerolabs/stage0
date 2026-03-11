import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAccount, useChainId, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { decodeEventLog, isAddress, parseEther, type Address } from 'viem';
import { NFTFactory, getContractAddresses, getExplorerUrl } from '@/config';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Image,
  Layers,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { getFriendlyTxErrorMessage } from '@/lib/utils/tx-errors';
import { normalizeContractURI } from '@/lib/utils/ipfs';

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

function parseDateTimeInput(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed / 1000);
}

function formatPreviewDate(value: string): string {
  const ts = parseDateTimeInput(value);
  return ts ? new Date(ts * 1000).toLocaleString() : 'Not set';
}

const CreateNFTPage: React.FC = () => {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { nftFactory } = getContractAddresses(chainId);
  const explorerUrl = getExplorerUrl(chainId);

  const [mode, setMode] = useState<NFTMode>('erc721');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [baseURI, setBaseURI] = useState('');
  const [contractURI, setContractURI] = useState('');
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
    if (!whitelistEnabled || whitelistStart || !saleStart) return;

    const saleStartMs = new Date(saleStart).getTime();
    if (!Number.isFinite(saleStartMs)) return;

    const suggested = new Date(saleStartMs - 60 * 60 * 1000);
    if (!Number.isFinite(suggested.getTime()) || suggested.getTime() <= 0) return;

    const tzOffsetMs = suggested.getTimezoneOffset() * 60_000;
    const local = new Date(suggested.getTime() - tzOffsetMs);
    setWhitelistStart(local.toISOString().slice(0, 16));
  }, [whitelistEnabled, whitelistStart, saleStart]);

  const validation = useMemo<ValidationResult>(() => {
    if (!isConnected) return { valid: false, message: 'Connect your wallet to deploy.' };
    if (!name.trim()) return { valid: false, message: 'Collection name is required.' };
    if (!symbol.trim()) return { valid: false, message: 'Collection symbol is required.' };
    if (!baseURI.trim()) return { valid: false, message: 'Base URI is required.' };
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

    const normalizedContractURI = contractURI.trim() ? normalizeContractURI(contractURI) : '';
    if (contractURI.trim() && !normalizedContractURI) {
      return { valid: false, message: 'Contract URI must be a valid ipfs:// or http(s) URL.' };
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
    contractURI,
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
    const normalizedContractURI = contractURI.trim() ? normalizeContractURI(contractURI) : '';
    const walletLimitValue = walletLimit.trim() ? Number(walletLimit) : 0;

    if (!saleStartTs || !saleEndTs) {
      toast.error('Sale dates are invalid.');
      return;
    }

    if (whitelistEnabled && !whitelistStartTs) {
      toast.error('Whitelist start is invalid.');
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
            contractURI: normalizedContractURI,
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

  const saleModel = whitelistEnabled ? 'Whitelist + Public' : 'Public Only';
  const walletLimitLabel = walletLimit.trim() && Number(walletLimit) > 0 ? walletLimit : 'Unlimited';

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
                <li>Set or confirm your payout wallet and metadata URIs.</li>
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
      <motion.section variants={itemVariants} className="space-y-2">
        <h1 className="font-display text-display-lg text-ink">Create NFT Collection</h1>
        <p className="text-body-lg text-ink-muted">
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
              <p className="text-body-sm text-ink-muted">Set the collection identity and metadata endpoints.</p>
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
                  placeholder="ipfs://.../"
                  className="input-field w-full"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-body-sm text-ink-muted font-medium">Contract URI (optional)</label>
                <input
                  type="text"
                  value={contractURI}
                  onChange={(e) => setContractURI(e.target.value)}
                  placeholder="ipfs://CID"
                  className="input-field w-full"
                />
                <p className="text-xs text-ink-faint">Used for collection-level metadata such as description and hero image.</p>
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
              <div className="space-y-1.5">
                <label className="text-body-sm text-ink-muted font-medium">Public Sale Start</label>
                <input
                  type="datetime-local"
                  value={saleStart}
                  onChange={(e) => setSaleStart(e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-body-sm text-ink-muted font-medium">Sale End</label>
                <input
                  type="datetime-local"
                  value={saleEnd}
                  onChange={(e) => setSaleEnd(e.target.value)}
                  className="input-field w-full"
                />
              </div>
            </div>
          </motion.section>

          <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="font-display text-display-sm text-ink">Whitelist Mint</h2>
                <p className="text-body-sm text-ink-muted">
                  Add an earlier allowlist window with a separate price before public mint opens.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-body-sm text-ink">
                <input
                  type="checkbox"
                  checked={whitelistEnabled}
                  onChange={(e) => setWhitelistEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                />
                Enable
              </label>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${whitelistEnabled ? '' : 'opacity-60'}`}>
              <div className="space-y-1.5">
                <label className="text-body-sm text-ink-muted font-medium">Whitelist Start</label>
                <input
                  type="datetime-local"
                  value={whitelistStart}
                  onChange={(e) => setWhitelistStart(e.target.value)}
                  disabled={!whitelistEnabled}
                  className="input-field w-full disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-body-sm text-ink-muted font-medium">Whitelist Price (ETH)</label>
                <input
                  type="text"
                  value={whitelistPrice}
                  onChange={(e) => setWhitelistPrice(e.target.value)}
                  disabled={!whitelistEnabled}
                  placeholder="0.03"
                  className="input-field w-full disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-canvas-alt p-4 text-body-sm text-ink-muted">
              When enabled, whitelist mint must start before the public sale. Approved wallets will pay the whitelist
              price until the public window opens.
            </div>
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
