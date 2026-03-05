import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { ArrowRight, Image, Lock, Package, Plus, Settings, TrendingUp, Wallet, Wrench } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useBalance, useChainId, useReadContracts } from 'wagmi';
import { formatUnits, type Address } from 'viem';
import {
  LaunchpadPresaleContract,
  StakingContract,
  erc20Abi,
  getExplorerUrl,
  getNativeTokenLabel,
  getStakingContractAddress,
} from '@/config';
import { useLaunchpadPresales } from '@/lib/hooks/useLaunchpadPresales';
import { useNFTDeployments } from '@/lib/hooks/useNFTDeployments';
import { useUserTokens } from '@/lib/hooks/useUserTokens';

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

const ConnectWalletPlaceholder: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center text-center py-12 bg-canvas-alt rounded-3xl border border-border">
    <div className="w-16 h-16 rounded-full bg-canvas flex items-center justify-center mb-4">
      <Wallet className="w-6 h-6 text-ink-muted" />
    </div>
    <h3 className="font-display text-display-sm text-ink mb-2">Connect Your Wallet</h3>
    <p className="text-body text-ink-muted max-w-xs">{message}</p>
  </div>
);

const Dashboard: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [nftTypeFilter, setNftTypeFilter] = useState<'all' | 'erc721' | 'erc721a'>('all');
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;
  const safeAddress = (address ?? ZERO_ADDRESS) as Address;
  const chainId = useChainId();
  const nativeToken = getNativeTokenLabel(chainId);
  const stakingAddress = getStakingContractAddress(chainId);
  const explorerUrl = getExplorerUrl(chainId);

  const { data: balance, isLoading: isBalanceLoading } = useBalance({
    address: safeAddress,
    query: { enabled: Boolean(address) },
  });

  const { presales, isLoading: isPresalesLoading } = useLaunchpadPresales('all');
  const { tokens: createdTokens, isLoading: isTokensLoading } = useUserTokens();
  const {
    deployments: myNFTDeployments,
    isLoading: isMyNFTDeploymentsLoading,
  } = useNFTDeployments({
    creator: address as Address | undefined,
    enabled: isConnected && Boolean(address),
  });

  const { data: stakingTokenData } = useReadContracts({
    contracts: [
      { address: stakingAddress, abi: StakingContract, functionName: 'stakingToken' },
    ],
    query: {
      enabled: stakingAddress !== ZERO_ADDRESS,
    },
  });

  const stakingToken = stakingTokenData?.[0]?.result as Address | undefined;

  const { data: stakingData, isLoading: isStakingLoading } = useReadContracts({
    contracts: stakingToken && address
      ? ([
          { address: stakingToken, abi: erc20Abi, functionName: 'symbol' },
          { address: stakingToken, abi: erc20Abi, functionName: 'decimals' },
          { address: stakingAddress, abi: StakingContract, functionName: 'balanceOf', args: [safeAddress] },
          { address: stakingAddress, abi: StakingContract, functionName: 'pendingRewards', args: [safeAddress] },
        ] as const)
      : [],
    query: {
      enabled: Boolean(stakingToken && address),
    },
  });

  const stakingSymbol = (stakingData?.[0]?.result as string | undefined) ?? nativeToken;
  const stakingDecimalsRaw = stakingData?.[1]?.result as number | bigint | undefined;
  const stakingDecimals = typeof stakingDecimalsRaw === 'number'
    ? stakingDecimalsRaw
    : Number(stakingDecimalsRaw ?? 18);
  const stakedBalance = (stakingData?.[2]?.result as bigint | undefined) ?? 0n;
  const pendingRewards = (stakingData?.[3]?.result as bigint | undefined) ?? 0n;
  const hasStakedAllocation = stakedBalance > 0n || pendingRewards > 0n;

  const contributionQueries = useMemo(() => {
    if (!address || presales.length === 0) return [];
    return presales.flatMap((presale) => [
      {
        abi: LaunchpadPresaleContract,
        address: presale.address,
        functionName: 'contributions',
        args: [address],
      },
      {
        abi: LaunchpadPresaleContract,
        address: presale.address,
        functionName: 'purchasedTokens',
        args: [address],
      },
    ] as const);
  }, [address, presales]);

  const { data: contributionResults, isLoading: isContributionsLoading } = useReadContracts({
    contracts: contributionQueries,
    query: {
      enabled: contributionQueries.length > 0,
    },
  });

  const allocations = useMemo(() => {
    if (!address || presales.length === 0 || !contributionResults) return [];

    const results: Array<{
      presale: typeof presales[number];
      contribution: bigint;
      purchasedTokens: bigint;
    }> = [];

    for (let i = 0; i < presales.length; i += 1) {
      const contribution = (contributionResults[i * 2]?.result ?? 0n) as bigint;
      const purchasedTokens = (contributionResults[i * 2 + 1]?.result ?? 0n) as bigint;

      if (contribution > 0n || purchasedTokens > 0n) {
        results.push({ presale: presales[i], contribution, purchasedTokens });
      }
    }

    return results;
  }, [address, presales, contributionResults]);

  const tokenMetaQueries = useMemo(() => {
    if (createdTokens.length === 0) return [];
    return createdTokens.flatMap((token) => [
      { abi: erc20Abi, address: token, functionName: 'symbol' },
      { abi: erc20Abi, address: token, functionName: 'name' },
    ] as const);
  }, [createdTokens]);

  const { data: tokenMetaResults } = useReadContracts({
    contracts: tokenMetaQueries,
    query: {
      enabled: tokenMetaQueries.length > 0,
    },
  });

  const createdTokenList = useMemo(() => {
    if (createdTokens.length === 0) return [];

    return createdTokens.map((token, index) => {
      const symbol = tokenMetaResults?.[index * 2]?.result as string | undefined;
      const name = tokenMetaResults?.[index * 2 + 1]?.result as string | undefined;

      return {
        address: token,
        symbol: symbol ?? 'TOKEN',
        name: name ?? 'Token',
      };
    });
  }, [createdTokens, tokenMetaResults]);

  const createdPresales = useMemo(() => {
    if (!address) return [];
    return presales.filter((presale) => presale.owner?.toLowerCase() === address.toLowerCase());
  }, [address, presales]);

  const filteredMyNFTDeployments = useMemo(() => {
    if (nftTypeFilter === 'all') return myNFTDeployments;
    if (nftTypeFilter === 'erc721a') return myNFTDeployments.filter((deployment) => deployment.is721A);
    return myNFTDeployments.filter((deployment) => !deployment.is721A);
  }, [myNFTDeployments, nftTypeFilter]);

  const balanceDisplay = balance
    ? `${Number(balance.formatted).toLocaleString(undefined, {
        maximumFractionDigits: 4,
      })} ${balance.symbol ?? nativeToken}`
    : `0 ${nativeToken}`;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-12"
    >
      {/* Hero Section */}
      <motion.section variants={itemVariants} className="space-y-2">
        <h1 className="font-display text-display-md sm:text-display-lg text-ink">
          {address ? (
            <>
              <span className="text-ink-muted">Welcome back, </span>
              <br className="sm:hidden" />
              <span className="text-accent-gradient font-mono text-body-lg sm:text-display-md">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
            </>
          ) : (
            <>
              <span className="text-ink-muted">Hello, </span>
              <span className="text-accent-gradient">Guest</span>
            </>
          )}
        </h1>
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-12 gap-y-12">
        {/* === Left Column: Sidebar === */}
        <div className="lg:col-span-1 space-y-12">
          {/* Overview */}
          <motion.section variants={itemVariants} className="space-y-6">
            <h2 className="font-display text-display-md text-ink">Overview</h2>
            {isConnected ? (
              <div className="space-y-4">
                <div className="stat-card p-5">
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-label text-ink-faint uppercase">Native Balance</span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-muted text-accent">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="font-display text-display-md text-ink">
                    {isBalanceLoading ? 'Loading…' : balanceDisplay}
                  </p>
                </div>
              </div>
            ) : (
              <ConnectWalletPlaceholder message="Connect your wallet to see your balance." />
            )}
          </motion.section>
        </div>

        {/* === Right Column: Main Content === */}
        <div className="lg:col-span-2 space-y-12">
          {/* Allocations Table */}
          <motion.section variants={itemVariants} className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-display-md text-ink">Your Allocations</h2>
            </div>

            {isConnected ? (
              allocations.length === 0 && !hasStakedAllocation && !isPresalesLoading && !isContributionsLoading ? (
                <div className="bg-canvas-alt rounded-3xl border border-border p-8 text-center">
                  <p className="text-body text-ink-muted">No presale allocations yet.</p>
                </div>
              ) : (
                <div className="bg-canvas-alt rounded-3xl border border-border overflow-hidden">
                  {/* Table Header */}
                  <div className="hidden md:grid grid-cols-12 gap-6 px-6 py-4 border-b border-border bg-canvas/40">
                    <span className="text-label text-ink-faint uppercase col-span-4">Presale</span>
                    <span className="text-label text-ink-faint uppercase text-right col-span-3">Contributed</span>
                    <span className="text-label text-ink-faint uppercase text-right col-span-3">Purchased</span>
                    <span className="text-label text-ink-faint uppercase text-right col-span-2">Status</span>
                  </div>
                  {/* Table Body */}
                  <div className="divide-y divide-border">
                    {allocations.map(({ presale, contribution, purchasedTokens }) => {
                      const paymentSymbol = presale.isPaymentETH
                        ? nativeToken
                        : presale.paymentTokenSymbol ?? 'TOKEN';
                      const saleSymbol = presale.saleTokenSymbol ?? 'TOKEN';
                      const contributionValue = formatUnits(contribution, presale.paymentTokenDecimals ?? 18);
                      const purchasedValue = formatUnits(purchasedTokens, presale.saleTokenDecimals ?? 18);

                      const statusVariant =
                        presale.status === 'live'
                          ? 'live'
                          : presale.status === 'upcoming'
                          ? 'upcoming'
                          : 'closed';

                      return (
                        <Link
                          key={presale.address}
                          to={`/presales/${presale.address}`}
                          className="grid grid-cols-1 md:grid-cols-12 gap-6 px-6 py-5 hover:bg-canvas/40 transition-colors duration-300 group items-center"
                        >
                          <div className="col-span-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-canvas border border-border flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-mono text-ink-muted">{saleSymbol.slice(0, 3)}</span>
                            </div>
                            <div>
                              <p className="text-body font-medium text-ink group-hover:text-accent transition-colors duration-300">
                                {presale.saleTokenName ?? presale.saleTokenSymbol ?? 'Presale'}
                              </p>
                              <p className="text-body-sm text-ink-muted font-mono">{saleSymbol}</p>
                            </div>
                          </div>
                          <p className="hidden md:block font-mono text-body text-ink text-right col-span-3">
                            {Number(contributionValue).toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
                            {paymentSymbol}
                          </p>
                          <p className="hidden md:block font-mono text-body text-ink text-right col-span-3">
                            {Number(purchasedValue).toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
                            {saleSymbol}
                          </p>
                          <div className="col-span-2 flex items-center justify-end">
                            <Badge variant={statusVariant}>{presale.status}</Badge>
                          </div>
                        </Link>
                      );
                    })}
                    {hasStakedAllocation && !isStakingLoading && (
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 px-6 py-5 bg-canvas/30 items-center">
                        <div className="col-span-4 flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-canvas border border-border flex items-center justify-center flex-shrink-0">
                            <Wallet className="w-4 h-4 text-ink-muted" />
                          </div>
                          <div>
                            <p className="text-body font-medium text-ink">Staked Tokens</p>
                            <p className="text-body-sm text-ink-muted font-mono">{stakingSymbol}</p>
                          </div>
                        </div>
                        <p className="hidden md:block font-mono text-body text-ink text-right col-span-3">
                          {Number(formatUnits(stakedBalance, stakingDecimals)).toLocaleString(undefined, {
                            maximumFractionDigits: 4,
                          })}{' '}
                          {stakingSymbol}
                        </p>
                        <p className="hidden md:block font-mono text-body text-ink text-right col-span-3">
                          {pendingRewards > 0n
                            ? `${Number(formatUnits(pendingRewards, stakingDecimals)).toLocaleString(undefined, {
                                maximumFractionDigits: 4,
                              })} ${stakingSymbol}`
                            : '—'}
                        </p>
                        <div className="col-span-2 flex items-center justify-end">
                          <Badge variant="live">staked</Badge>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            ) : (
              <ConnectWalletPlaceholder message="Connect your wallet to view your presale allocations." />
            )}
          </motion.section>
        </div>
      </div>

      {/* My Token Creations */}
      <motion.section variants={itemVariants} className="space-y-6">
        <h2 className="font-display text-display-md text-ink">My Token Creations</h2>
        {isConnected ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
            {/* Created Tokens */}
            <div className="bg-canvas-alt rounded-2xl border border-border p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-canvas flex items-center justify-center">
                  <Package className="w-5 h-5 text-ink-muted" />
                </div>
                <div>
                  <h3 className="font-display text-body text-ink">Created Tokens</h3>
                  <p className="text-body-sm text-ink-muted">
                    {isTokensLoading ? 'Loading…' : `${createdTokenList.length} total`}
                  </p>
                </div>
              </div>

              {isTokensLoading && createdTokenList.length === 0 ? (
                <p className="text-body-sm text-ink-muted">Loading tokens…</p>
              ) : createdTokenList.length === 0 ? (
                <p className="text-body-sm text-ink-muted">You haven't created any tokens yet.</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-auto no-scrollbar">
                  {createdTokenList.slice(0, 5).map((token) => (
                    <Link
                      key={token.address}
                      to="/tokens"
                      className="flex items-center justify-between rounded-xl bg-canvas/40 px-3 py-2 text-body-sm text-ink hover:bg-canvas transition-colors"
                    >
                      <span>{token.symbol}</span>
                      <span className="font-mono text-ink-muted">
                        {token.address.slice(0, 6)}…{token.address.slice(-4)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {createdTokenList.length > 0 ? (
                <Link to="/tokens" className="btn-secondary w-full">
                  Manage Tokens
                </Link>
              ) : (
                <Link to="/create/token" className="btn-secondary w-full">
                  Create Token
                </Link>
              )}
            </div>

            {/* Created Presales */}
            <div className="bg-canvas-alt rounded-2xl border border-border p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-canvas flex items-center justify-center">
                  <Plus className="w-5 h-5 text-ink-muted" />
                </div>
                <div>
                  <h3 className="font-display text-body text-ink">Created Presales</h3>
                  <p className="text-body-sm text-ink-muted">
                    {isPresalesLoading ? 'Loading…' : `${createdPresales.length} total`}
                  </p>
                </div>
              </div>

              {isPresalesLoading && createdPresales.length === 0 ? (
                <p className="text-body-sm text-ink-muted">Loading presales…</p>
              ) : createdPresales.length === 0 ? (
                <p className="text-body-sm text-ink-muted">
                  Launch your next IDO or manage existing presales.
                </p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-auto no-scrollbar">
                  {createdPresales.slice(0, 5).map((presale) => {
                    const statusVariant =
                      presale.status === 'live'
                        ? 'live'
                        : presale.status === 'upcoming'
                        ? 'upcoming'
                        : 'closed';
                    return (
                      <Link
                        key={presale.address}
                        to={`/presales/manage/${presale.address}`}
                        className="flex items-center justify-between rounded-xl bg-canvas/40 px-3 py-2 text-body-sm text-ink hover:bg-canvas transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Settings className="w-3.5 h-3.5 text-ink-muted" />
                          {presale.saleTokenSymbol ?? 'Presale'}
                        </span>
                        <Badge variant={statusVariant}>{presale.status}</Badge>
                      </Link>
                    );
                  })}
                </div>
              )}

              {createdPresales.length > 0 ? (
                <Link to="/create/presale" className="btn-secondary w-full">
                  Create Another Presale
                </Link>
              ) : (
                <Link to="/create/presale" className="btn-secondary w-full">Create Presale</Link>
              )}
            </div>

            {/* Token Locks */}
            <div className="bg-canvas-alt rounded-2xl border border-border p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-canvas flex items-center justify-center">
                  <Lock className="w-5 h-5 text-ink-muted" />
                </div>
                <div>
                  <h3 className="font-display text-body text-ink">Token Locks</h3>
                  <p className="text-body-sm text-ink-muted">Lock tokens for vesting or liquidity.</p>
                </div>
              </div>
              <Link to="/tools/token-locker" className="btn-secondary w-full">Create Lock</Link>
            </div>

          </div>
        ) : (
          <ConnectWalletPlaceholder message="Connect your wallet to manage your created tokens, presales, and locks." />
        )}
      </motion.section>

      {/* My NFTs */}
      <motion.section variants={itemVariants} className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-display text-display-md text-ink">My NFTs</h2>
          <div className="flex items-center gap-2">
            {[
              { label: 'All', value: 'all' as const },
              { label: 'ERC721', value: 'erc721' as const },
              { label: 'ERC721A', value: 'erc721a' as const },
            ].map((tag) => (
              <button
                key={tag.value}
                onClick={() => setNftTypeFilter(tag.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  nftTypeFilter === tag.value
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-ink/5 text-ink-muted hover:bg-ink/10'
                }`}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
        {isConnected ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
            <div className="bg-canvas-alt rounded-2xl border border-border p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-canvas flex items-center justify-center">
                  <Image className="w-5 h-5 text-ink-muted" />
                </div>
                <div>
                  <h3 className="font-display text-body text-ink">Your Collections</h3>
                  <p className="text-body-sm text-ink-muted">
                    {isMyNFTDeploymentsLoading ? 'Loading…' : `${myNFTDeployments.length} deployed`}
                  </p>
                </div>
              </div>

              {isMyNFTDeploymentsLoading && myNFTDeployments.length === 0 ? (
                <p className="text-body-sm text-ink-muted">Loading NFT collections…</p>
              ) : myNFTDeployments.length === 0 ? (
                <p className="text-body-sm text-ink-muted">
                  No NFT collections yet. Launch your first collection.
                </p>
              ) : filteredMyNFTDeployments.length === 0 ? (
                <p className="text-body-sm text-ink-muted">
                  No collections match this tag.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-auto no-scrollbar">
                  {filteredMyNFTDeployments.slice(0, 8).map((collection) => {
                    const statusVariant =
                      collection.status === 'live'
                        ? 'live'
                        : collection.status === 'upcoming'
                        ? 'upcoming'
                        : 'closed';

                    return (
                      <div
                        key={collection.address}
                        className="rounded-xl bg-canvas/40 px-3 py-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-body-sm font-medium text-ink">
                              {collection.name}
                            </p>
                            <p className="text-label text-ink-faint font-mono">
                              {collection.symbol}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant={statusVariant}>{collection.status}</Badge>
                            <span className="inline-flex rounded-full bg-ink/10 px-2 py-1 text-xs font-medium text-ink-muted">
                              {collection.is721A ? 'ERC721A' : 'ERC721'}
                            </span>
                          </div>
                        </div>
                        <p className="text-body-sm text-ink-muted">
                          Minted{' '}
                          <span className="font-mono text-ink">
                            {collection.totalMinted.toLocaleString()}
                          </span>{' '}
                          /{' '}
                          <span className="font-mono text-ink">
                            {collection.maxSupply.toLocaleString()}
                          </span>
                        </p>
                        <div className="flex items-center gap-2">
                          <Link to={`/nfts/manage/${collection.address}`} className="btn-secondary">
                            Manage
                          </Link>
                          <a
                            href={`${explorerUrl}/address/${collection.address}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary"
                          >
                            Explorer
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <Link to="/create/nft" className="btn-secondary w-full">
                {myNFTDeployments.length > 0 ? 'Create Another NFT' : 'Create NFT'}
              </Link>
            </div>
          </div>
        ) : (
          <ConnectWalletPlaceholder message="Connect your wallet to manage your NFT collections." />
        )}
      </motion.section>

      {/* Creator Tools */}
      <motion.section variants={itemVariants} className="space-y-6">
        <div className="space-y-2">
          <p className="text-label text-ink-faint uppercase tracking-wider">For Builders</p>
          <h2 className="font-display text-display-md text-ink">Creator Tools</h2>
          <p className="text-body text-ink-muted max-w-2xl">
            Deploy tokens and NFTs, run airdrops, lock liquidity, and manage your onchain presence — all in one place.
          </p>
        </div>
        <Link to="/tools" className="glass-card rounded-3xl p-6 group flex items-center justify-between w-full transition-colors duration-300 hover:border-accent/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-accent-muted text-accent flex items-center justify-center">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <p className="font-display text-display-sm text-ink">Open Creator Tools</p>
              <p className="text-body-sm text-ink-muted">Tokens, NFTs, locks, airdrops, and more</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-ink-muted group-hover:text-ink transition-colors duration-300" />
        </Link>
      </motion.section>
    </motion.div>
  );
};

export default Dashboard;
