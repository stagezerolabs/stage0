import { Badge } from '@/components/ui/badge';
import FallbackImage from '@/components/ui/fallback-image';
import { NFT_COLLECTION_IMAGES, getExplorerUrl, getNativeTokenLabel } from '@/config';
import { useNFTDeployments } from '@/lib/hooks/useNFTDeployments';
import { useUserOwnedNFTTokens } from '@/lib/hooks/useUserOwnedNFTTokens';
import { ArrowRight, ExternalLink, Image as ImageIcon, Settings, Wallet } from '@/components/ui/icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatUnits, type Address } from 'viem';
import { useAccount, useChainId } from 'wagmi';

const TOKEN_GRID_BATCH_SIZE = 9;

function formatMintPrice(value: bigint, symbol: string): string {
  const amount = Number(formatUnits(value, 18));
  if (!Number.isFinite(amount)) return `0 ${symbol}`;
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol}`;
}

const MyNFTsPage: React.FC = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const explorerUrl = getExplorerUrl(chainId);
  const nativeToken = getNativeTokenLabel(chainId);
  const [visibleTokenCount, setVisibleTokenCount] = useState(TOKEN_GRID_BATCH_SIZE);

  const {
    tokens,
    holdings,
    totalOwned,
    isLoading,
    isTruncatedScan,
    truncatedCollections,
    scanLimitPerCollection,
  } = useUserOwnedNFTTokens(address, isConnected, { metadataLimit: visibleTokenCount });

  const {
    deployments: createdCollections,
    isLoading: isCreatedCollectionsLoading,
  } = useNFTDeployments({
    creator: address as Address | undefined,
    enabled: isConnected && Boolean(address),
  });

  const liveHeldCount = useMemo(
    () => holdings.filter((holding) => holding.status === 'live').length,
    [holdings]
  );

  const liveCreatedCount = useMemo(
    () => createdCollections.filter((collection) => collection.status === 'live').length,
    [createdCollections]
  );

  const hasAnyNFTPortfolio = tokens.length > 0 || holdings.length > 0 || createdCollections.length > 0;
  const isPortfolioLoading = isLoading || isCreatedCollectionsLoading;
  const visibleTokens = useMemo(
    () => tokens.slice(0, visibleTokenCount),
    [tokens, visibleTokenCount]
  );
  const hasMoreTokens = visibleTokenCount < tokens.length;

  useEffect(() => {
    setVisibleTokenCount(TOKEN_GRID_BATCH_SIZE);
  }, [address]);

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <section className="page-hero-card">
          <div className="eyebrow">Collectibles</div>
          <h1 className="ds-h1 mt-2">NFT Portfolio</h1>
        </section>
        <div className="glass-card rounded-3xl p-10 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-canvas-alt border border-border mx-auto flex items-center justify-center">
            <Wallet className="w-6 h-6 text-ink-muted" />
          </div>
          <p className="text-body text-ink-muted">Connect your wallet to view your NFT portfolio.</p>
          <Link to="/presales" className="btn-secondary inline-flex">
            Browse Launchpad
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="page-hero-card">
        <div className="eyebrow">Collectibles</div>
        <h1 className="ds-h1 mt-2">NFT Portfolio</h1>
        <p className="text-body text-ink-muted mt-3">
          Track NFT holdings, minted items, and collections created from this wallet.
        </p>
      </section>

      <section className="md:hidden rounded-2xl border border-border bg-canvas-alt overflow-hidden">
        <div className="divide-y divide-border/60">
          <div className="flex items-center justify-between p-4">
            <p className="text-label text-ink-faint uppercase">Held Collections</p>
            <p className="font-display text-display-sm text-ink">{holdings.length}</p>
          </div>
          <div className="flex items-center justify-between p-4">
            <p className="text-label text-ink-faint uppercase">NFTs Held</p>
            <p className="font-display text-display-sm text-ink">{totalOwned.toString()}</p>
          </div>
          <div className="flex items-center justify-between p-4">
            <p className="text-label text-ink-faint uppercase">Token Items</p>
            <p className="font-display text-display-sm text-ink">{tokens.length}</p>
          </div>
          <div className="flex items-center justify-between p-4">
            <p className="text-label text-ink-faint uppercase">Created</p>
            <p className="font-display text-display-sm text-ink">{createdCollections.length}</p>
          </div>
        </div>
      </section>

      <section className="hidden md:grid md:grid-cols-4 gap-4">
        <div className="stat-card p-5">
          <p className="text-label text-ink-faint uppercase">Held Collections</p>
          <p className="font-display text-display-md text-ink">{holdings.length}</p>
        </div>
        <div className="stat-card p-5">
          <p className="text-label text-ink-faint uppercase">NFTs Held</p>
          <p className="font-display text-display-md text-ink">{totalOwned.toString()}</p>
        </div>
        <div className="stat-card p-5">
          <p className="text-label text-ink-faint uppercase">Token Items</p>
          <p className="font-display text-display-md text-ink">{tokens.length}</p>
        </div>
        <div className="stat-card p-5">
          <p className="text-label text-ink-faint uppercase">Created</p>
          <p className="font-display text-display-md text-ink">{createdCollections.length}</p>
        </div>
      </section>

      {isTruncatedScan && (
        <div className="rounded-2xl border border-status-upcoming/30 bg-status-upcoming-bg p-4">
          <p className="text-body-sm text-status-upcoming">
            Some collections are large. Scanning is capped at {scanLimitPerCollection} token IDs per collection.
          </p>
          <p className="text-body-sm text-ink-muted mt-1">
            Affected collections: {truncatedCollections.map((collection) => collection.symbol).join(', ')}
          </p>
        </div>
      )}

      {isPortfolioLoading && !hasAnyNFTPortfolio ? (
        <div className="glass-card rounded-3xl p-10 text-center">
          <p className="text-body text-ink-muted">Loading your NFT portfolio...</p>
        </div>
      ) : !hasAnyNFTPortfolio ? (
        <div className="glass-card rounded-3xl p-10 text-center space-y-4">
          <p className="text-body text-ink-muted">No NFT holdings or created collections found yet.</p>
          <Link to="/presales" className="btn-secondary inline-flex items-center gap-2">
            Open Launchpad <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {holdings.length > 0 && (
            <section className="space-y-4">
              <div className="section-head">
                <div>
                  <div className="eyebrow">Owned collections</div>
                  <h2 className="ds-h2 mt-1.5">Collection summary</h2>
                </div>
                <span className="font-mono text-[12px] text-ink-faint">{liveHeldCount} live</span>
              </div>

              <div className="holdings-grid">
                {holdings.map((holding) => (
                  <Link to={`/nfts/${holding.address}`} key={`holding-${holding.address}`} className="holding-card">
                    <div className="holding-img">
                      <FallbackImage
                        src={holding.metadataImage}
                        fallbackSrc={NFT_COLLECTION_IMAGES[holding.address.toLowerCase()]}
                        alt={holding.name}
                        className="w-full h-full object-cover"
                        placeholder={<span>{holding.name.slice(0, 1)}</span>}
                      />
                    </div>
                    <div className="holding-info">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="holding-name">{holding.name}</div>
                          <div className="holding-meta">
                            {holding.ownedCount.toString()} held · {holding.symbol}
                          </div>
                        </div>
                        <Badge
                          variant={
                            holding.status === 'live'
                              ? 'live'
                              : holding.status === 'upcoming'
                                ? 'upcoming'
                                : 'closed'
                          }
                        >
                          {holding.status}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {tokens.length > 0 && (
            <section className="space-y-4">
              <div className="section-head">
                <div>
                  <div className="eyebrow">Token items</div>
                  <h2 className="ds-h2 mt-1.5">Owned NFTs</h2>
                </div>
                <p className="text-body-sm text-ink-muted">
                  Showing {visibleTokens.length} of {tokens.length} NFTs across {holdings.length} collections
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {visibleTokens.map((token) => {
                  const showStatusBadge = token.collectionStatus !== 'live';
                  const statusVariant = token.collectionStatus === 'upcoming' ? 'upcoming' : 'closed';
                  const isOwner =
                    Boolean(address) &&
                    token.collectionOwner.toLowerCase() === address?.toLowerCase();

                  return (
                    <div
                      key={`${token.collectionAddress}-${token.tokenId.toString()}`}
                      className="project-card rounded-3xl overflow-hidden flex flex-col"
                    >
                      <FallbackImage
                        src={token.image}
                        alt={token.metadataName || `${token.collectionSymbol} #${token.tokenId.toString()}`}
                        className="w-full h-40 object-cover"
                        placeholder={(
                          <div className="w-full h-40 bg-canvas-alt border-b border-border flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-ink-faint" />
                          </div>
                        )}
                      />

                      <div className="p-5 space-y-4 flex-1 flex flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-display text-display-sm text-ink">
                              {token.metadataName || `${token.collectionSymbol} #${token.tokenId.toString()}`}
                            </p>
                            <p className="text-body-sm text-ink-muted font-mono">
                              {token.collectionName} #{token.tokenId.toString()}
                            </p>
                          </div>
                          {showStatusBadge && <Badge variant={statusVariant}>{token.collectionStatus}</Badge>}
                        </div>

                        {token.metadataDescription && (
                          <p className="text-body-sm text-ink-faint line-clamp-3">
                            {token.metadataDescription}
                          </p>
                        )}

                        <div className="rounded-2xl bg-canvas/40 border border-border p-3 space-y-2">
                          <div className="flex justify-between text-body-sm">
                            <span className="text-ink-muted">Collection</span>
                            <span className="font-mono text-ink">{token.collectionSymbol}</span>
                          </div>
                          <div className="flex justify-between text-body-sm">
                            <span className="text-ink-muted">Token ID</span>
                            <span className="font-mono text-ink">#{token.tokenId.toString()}</span>
                          </div>
                          <div className="flex justify-between text-body-sm">
                            <span className="text-ink-muted">Type</span>
                            <span className="font-mono text-ink">{token.is721A ? 'ERC721A' : 'ERC721'}</span>
                          </div>
                        </div>

                        <div className="mt-auto flex flex-wrap gap-2">
                          <Link to={`/nfts/${token.collectionAddress}`} className="btn-secondary">
                            View Collection
                          </Link>
                          {isOwner && (
                            <Link to={`/nfts/manage/${token.collectionAddress}`} className="btn-secondary">
                              Manage
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasMoreTokens && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    className="btn-secondary inline-flex items-center gap-2"
                    onClick={() =>
                      setVisibleTokenCount((current) =>
                        Math.min(current + TOKEN_GRID_BATCH_SIZE, tokens.length)
                      )
                    }
                  >
                    Load more NFTs
                    <span className="font-mono text-[11px] text-ink-faint">
                      {Math.min(TOKEN_GRID_BATCH_SIZE, tokens.length - visibleTokenCount)} more
                    </span>
                  </button>
                </div>
              )}
            </section>
          )}

          {createdCollections.length > 0 && (
            <section className="space-y-4">
              <div className="section-head">
                <div>
                  <div className="eyebrow">Creator portfolio</div>
                  <h2 className="ds-h2 mt-1.5">Created collections</h2>
                </div>
                <span className="font-mono text-[12px] text-ink-faint">{liveCreatedCount} live</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {createdCollections.map((collection) => {
                  const statusVariant =
                    collection.status === 'live'
                      ? 'live'
                      : collection.status === 'upcoming'
                        ? 'upcoming'
                        : 'closed';

                  return (
                    <div key={collection.address} className="bg-canvas-alt border border-border rounded-2xl p-4 flex gap-4">
                      <div className="w-20 h-20 rounded-xl bg-canvas border border-border flex items-center justify-center overflow-hidden shrink-0">
                        <FallbackImage
                          src={collection.metadataImage}
                          fallbackSrc={NFT_COLLECTION_IMAGES[collection.address.toLowerCase()]}
                          alt={collection.name}
                          className="w-full h-full object-cover"
                          placeholder={<ImageIcon className="w-5 h-5 text-ink-muted" />}
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-ink truncate">{collection.name}</div>
                            <div className="font-mono text-[11px] text-ink-muted">{collection.symbol}</div>
                          </div>
                          <Badge variant={statusVariant}>{collection.status}</Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[12px]">
                          <div className="rounded-xl bg-canvas/40 border border-border p-3">
                            <div className="text-ink-muted">Minted</div>
                            <div className="font-mono text-ink mt-1">
                              {collection.totalMinted.toLocaleString()} / {collection.maxSupply.toLocaleString()}
                            </div>
                          </div>
                          <div className="rounded-xl bg-canvas/40 border border-border p-3">
                            <div className="text-ink-muted">Mint price</div>
                            <div className="font-mono text-ink mt-1">
                              {formatMintPrice(collection.mintPrice, nativeToken)}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Link to={`/nfts/manage/${collection.address}`} className="btn-secondary btn-sm inline-flex items-center gap-1.5">
                            <Settings className="w-3.5 h-3.5" />
                            Manage
                          </Link>
                          <a
                            href={`${explorerUrl}/address/${collection.address}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-ghost btn-sm inline-flex items-center gap-1.5"
                          >
                            Explorer <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <Link to={`/nfts/${collection.address}`} className="btn-ghost btn-sm">
                            View
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default MyNFTsPage;
