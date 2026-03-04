import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAccount, useChainId, useReadContracts } from 'wagmi';
import { Copy, ExternalLink, Package, Plus, Trash2, X } from 'lucide-react';
import { erc20Abi, getExplorerUrl } from '@/config';
import { formatUnits, isAddress, type Address } from 'viem';
import { useUserTokens } from '@/lib/hooks/useUserTokens';
import { useBlockchainStore } from '@/lib/store/blockchain-store';
import { toast } from 'sonner';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

const TokensPage: React.FC = () => {
  const { isConnected, address: userAddress } = useAccount();
  const chainId = useChainId();
  const explorerUrl = getExplorerUrl(chainId);
  const { tokens: allTokens, factoryTokens, isLoading } = useUserTokens();
  const { addImportedToken, removeImportedToken } = useBlockchainStore();

  const [showImportModal, setShowImportModal] = useState(false);
  const [importAddress, setImportAddress] = useState('');

  // Build a set of factory token addresses for labeling
  const factorySet = useMemo(() => {
    const set = new Set<string>();
    for (const t of factoryTokens) set.add(t.toLowerCase());
    return set;
  }, [factoryTokens]);

  const tokenMetaQueries = useMemo(() => {
    if (allTokens.length === 0) return [];
    return allTokens.flatMap((token) => [
      { abi: erc20Abi, address: token, functionName: 'symbol' },
      { abi: erc20Abi, address: token, functionName: 'name' },
      { abi: erc20Abi, address: token, functionName: 'decimals' },
      { abi: erc20Abi, address: token, functionName: 'totalSupply' },
      { abi: erc20Abi, address: token, functionName: 'balanceOf', args: [userAddress as Address] },
    ] as const);
  }, [allTokens, userAddress]);

  const { data: tokenMetaResults } = useReadContracts({
    contracts: tokenMetaQueries,
    query: {
      enabled: tokenMetaQueries.length > 0 && Boolean(userAddress),
    },
  });

  const tokenList = useMemo(() => {
    if (allTokens.length === 0) return [];
    return allTokens.map((token, index) => {
      const base = index * 5;
      const symbol = tokenMetaResults?.[base]?.result as string | undefined;
      const name = tokenMetaResults?.[base + 1]?.result as string | undefined;
      const decimals = tokenMetaResults?.[base + 2]?.result as number | bigint | undefined;
      const totalSupply = tokenMetaResults?.[base + 3]?.result as bigint | undefined;
      const balance = tokenMetaResults?.[base + 4]?.result as bigint | undefined;
      const decimalsValue = typeof decimals === 'number' ? decimals : Number(decimals ?? 18);
      const isFactory = factorySet.has(token.toLowerCase());

      return {
        address: token,
        symbol: symbol ?? 'TOKEN',
        name: name ?? 'Token',
        decimals: decimalsValue,
        totalSupply,
        balance,
        isFactory,
      };
    });
  }, [allTokens, tokenMetaResults, factorySet]);

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success('Copied to clipboard.');
  };

  const handleImport = () => {
    const trimmed = importAddress.trim();
    if (!isAddress(trimmed)) {
      toast.error('Invalid ERC20 address.');
      return;
    }
    if (!userAddress) return;
    addImportedToken(userAddress, chainId, trimmed as Address);
    toast.success('Token imported.');
    setImportAddress('');
    setShowImportModal(false);
  };

  const handleRemoveImported = (tokenAddress: Address) => {
    if (!userAddress) return;
    removeImportedToken(userAddress, chainId, tokenAddress);
    toast.success('Token removed.');
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-10"
    >
      <motion.section variants={itemVariants} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-display text-display-lg text-ink">Token Management</h1>
          <p className="text-body-lg text-ink-muted">
            Manage your created and imported tokens.
          </p>
        </div>
        {isConnected && (
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Import Token
          </button>
        )}
      </motion.section>

      {/* Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
            onClick={() => setShowImportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card rounded-3xl p-6 w-full max-w-md space-y-4 border border-border"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-display-sm text-ink">Import Token</h3>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="p-2 rounded-xl text-ink-muted hover:text-ink transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-body-sm text-ink-muted">
                Paste any ERC20 token contract address to add it to your management dashboard.
              </p>
              <input
                type="text"
                value={importAddress}
                onChange={(e) => setImportAddress(e.target.value)}
                placeholder="0x..."
                className="input-field font-mono text-body-sm"
              />
              <button
                onClick={handleImport}
                disabled={!importAddress.trim()}
                className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Import
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isConnected ? (
        <motion.div variants={itemVariants} className="glass-card rounded-3xl p-8 text-center">
          <p className="text-body text-ink-muted">Connect your wallet to view tokens.</p>
        </motion.div>
      ) : isLoading ? (
        <motion.div variants={itemVariants} className="glass-card rounded-3xl p-8 text-center">
          <p className="text-body text-ink-muted">Loading tokens...</p>
        </motion.div>
      ) : tokenList.length === 0 ? (
        <motion.div variants={itemVariants} className="glass-card rounded-3xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-accent-muted text-accent mx-auto flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <p className="text-body text-ink-muted">No tokens found. Create or import a token to get started.</p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/create/token" className="btn-secondary inline-flex">
              Create Token
            </Link>
            <button
              onClick={() => setShowImportModal(true)}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Import Token
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.section variants={itemVariants} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {tokenList.map((token) => (
              <div key={token.address} className="glass-card rounded-3xl p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-display text-display-sm text-ink">{token.symbol}</p>
                      <p className="text-body-sm text-ink-muted">{token.name}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        token.isFactory
                          ? 'bg-accent/15 text-accent'
                          : 'bg-ink/10 text-ink-muted'
                      }`}
                    >
                      {token.isFactory ? 'Created' : 'Imported'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {!token.isFactory && (
                      <button
                        onClick={() => handleRemoveImported(token.address)}
                        className="p-2 rounded-xl text-ink-muted hover:text-status-error transition-colors"
                        aria-label="Remove imported token"
                        title="Remove from list"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleCopy(token.address)}
                      className="p-2 rounded-xl bg-canvas text-ink-muted hover:text-ink transition-colors"
                      aria-label="Copy token address"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <code className="text-body-sm font-mono text-ink-muted break-all">
                  {token.address}
                </code>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {token.balance !== undefined && (
                    <p className="text-body-sm text-ink-muted">
                      Balance:{' '}
                      <span className="font-mono text-ink">
                        {Number(formatUnits(token.balance, token.decimals)).toLocaleString()}
                      </span>{' '}
                      {token.symbol}
                    </p>
                  )}
                  {token.totalSupply !== undefined && (
                    <p className="text-body-sm text-ink-muted">
                      Total Supply:{' '}
                      <span className="font-mono text-ink">
                        {Number(formatUnits(token.totalSupply, token.decimals)).toLocaleString()}
                      </span>{' '}
                      {token.symbol}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={`${explorerUrl}/token/${token.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary inline-flex items-center gap-2"
                  >
                    Explorer <ExternalLink className="w-4 h-4" />
                  </a>
                  <Link to={`/create/presale?token=${token.address}`} className="btn-secondary">Launch Presale</Link>
                  <Link to={`/tools/airdrop?token=${token.address}`} className="btn-secondary">Airdrop</Link>
                  <Link to={`/tools/token-locker?token=${token.address}`} className="btn-secondary">Lock</Link>
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}
    </motion.div>
  );
};

export default TokensPage;
