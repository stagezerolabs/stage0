import { Badge } from '@/components/ui/badge';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import FallbackImage from '@/components/ui/fallback-image';
import { NFT_COLLECTION_IMAGES, getExplorerUrl, getNativeTokenLabel } from '@/config';
import { useNFTDeployments } from '@/lib/hooks/useNFTDeployments';
import { useUserNFTHoldings } from '@/lib/hooks/useUserNFTHoldings';
import { ArrowRight, ExternalLink, Image as ImageIcon, Settings, Wallet } from '@/components/ui/icons';
import React from 'react';
import { Link } from 'react-router-dom';
import { formatUnits, type Address } from 'viem';
import { useAccount, useChainId } from 'wagmi';

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

  const {
    holdings,
    totalOwned,
    isLoading,
  } = useUserNFTHoldings(address, isConnected);

  const {
    deployments: createdCollections,
    isLoading: isCreatedCollectionsLoading,
  } = useNFTDeployments({
    creator: address as Address | undefined,
    enabled: isConnected && Boolean(address),
  });

  const hasAnyNFTPortfolio = holdings.length > 0 || createdCollections.length > 0;
  const isPortfolioLoading = isLoading || isCreatedCollectionsLoading;

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <section>
          <h1 className="ds-h1">Collectibles</h1>
          <p className="text-body text-ink-muted mt-3 max-w-2xl">
            Track NFT holdings, minted items, and collections created from this wallet.
          </p>
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
      <section>
        <h1 className="ds-h1">Collectibles</h1>
        <p className="text-body text-ink-muted mt-3 max-w-2xl">
          Track NFT holdings, minted items, and collections created from this wallet.
        </p>
      </section>

      <section className="md:hidden grid grid-cols-3 gap-3">
        <div className="stat-card rounded-2xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Held Collections</p>
          <p className="font-display text-[24px] leading-none text-ink mt-3">{holdings.length}</p>
        </div>
        <div className="stat-card rounded-2xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">NFTs Held</p>
          <p className="font-display text-[24px] leading-none text-ink mt-3">{totalOwned.toString()}</p>
        </div>
        <div className="stat-card rounded-2xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Created</p>
          <p className="font-display text-[24px] leading-none text-ink mt-3">{createdCollections.length}</p>
        </div>
      </section>

      <section className="hidden md:grid md:grid-cols-3 gap-4">
        <div className="stat-card p-5">
          <p className="text-label text-ink-faint uppercase">Held Collections</p>
          <p className="font-display text-display-md text-ink">{holdings.length}</p>
        </div>
        <div className="stat-card p-5">
          <p className="text-label text-ink-faint uppercase">NFTs Held</p>
          <p className="font-display text-display-md text-ink">{totalOwned.toString()}</p>
        </div>
        <div className="stat-card p-5">
          <p className="text-label text-ink-faint uppercase">Created</p>
          <p className="font-display text-display-md text-ink">{createdCollections.length}</p>
        </div>
      </section>

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
        <div className="flex flex-col gap-10">
          {holdings.length > 0 && (
            <section className="order-2 space-y-4">
              <div className="section-head">
                <div>
                  <h2 className="ds-h2 mt-1.5">Owned collections</h2>
                </div>
              </div>

              <div className="holdings-grid">
                {holdings.map((holding) => (
                  <Link to={`/my-nfts/${holding.address}`} key={`holding-${holding.address}`} className="holding-card">
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

          {createdCollections.length > 0 && (
            <section className="order-1 space-y-4">
              <div className="section-head">
                <div>
                  <h2 className="ds-h2 mt-1.5">Created collections</h2>
                </div>
              </div>

              <Carousel
                opts={{
                  align: 'start',
                  slidesToScroll: 1,
                }}
              >
                <CarouselContent>
                  {createdCollections.map((collection) => {
                    const statusVariant =
                      collection.status === 'live'
                        ? 'live'
                        : collection.status === 'upcoming'
                          ? 'upcoming'
                          : 'closed';

                    return (
                      <CarouselItem key={collection.address} className="basis-1/2 md:basis-1/3">
                        <div className="group h-full overflow-hidden rounded-3xl border border-border bg-canvas-alt shadow-sm transition duration-300 hover:-translate-y-1 hover:border-border-strong">
                          <Link to={`/my-nfts/${collection.address}`} className="block">
                            <div className="relative aspect-[4/3] overflow-hidden bg-canvas">
                              <FallbackImage
                                src={collection.metadataImage}
                                fallbackSrc={NFT_COLLECTION_IMAGES[collection.address.toLowerCase()]}
                                alt={collection.name}
                                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                placeholder={
                                  <div className="flex h-full w-full items-center justify-center">
                                    <ImageIcon className="h-6 w-6 text-ink-muted md:h-8 md:w-8" />
                                  </div>
                                }
                              />
                              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
                              <div className="absolute left-3 top-3 md:left-4 md:top-4">
                                <Badge variant={statusVariant}>{collection.status}</Badge>
                              </div>
                            </div>
                          </Link>

                          <div className="flex flex-col gap-4 p-3 md:p-5">
                            <div className="min-w-0">
                              <Link
                                to={`/my-nfts/${collection.address}`}
                                className="block truncate font-display text-[17px] font-semibold leading-tight text-ink transition hover:text-accent md:text-[20px]"
                              >
                                {collection.name}
                              </Link>
                              <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                                {collection.symbol}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2 text-[12px] md:grid-cols-2">
                              <div className="rounded-2xl border border-border bg-canvas/50 p-3">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                                  Minted
                                </div>
                                <div className="mt-1 font-mono text-[12px] text-ink md:text-[13px]">
                                  {collection.totalMinted.toLocaleString()} / {collection.maxSupply.toLocaleString()}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-border bg-canvas/50 p-3">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                                  Price
                                </div>
                                <div className="mt-1 truncate font-mono text-[12px] text-ink md:text-[13px]">
                                  {formatMintPrice(collection.mintPrice, nativeToken)}
                                </div>
                              </div>
                            </div>

                            <div className="mt-auto flex flex-col gap-2 md:flex-row md:flex-wrap">
                              <Link
                                to={`/nfts/manage/${collection.address}`}
                                className="btn-secondary btn-sm inline-flex items-center justify-center gap-1.5"
                              >
                                <Settings className="h-3.5 w-3.5" />
                                Manage
                              </Link>
                              <Link
                                to={`/nfts/${collection.address}`}
                                className="btn-ghost btn-sm inline-flex items-center justify-center"
                              >
                                Sale page
                              </Link>
                              <a
                                href={`${explorerUrl}/address/${collection.address}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-ghost btn-sm inline-flex items-center justify-center gap-1.5"
                              >
                                Explorer <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
                <div className="mt-4 flex justify-end gap-2">
                  <CarouselPrevious className="static h-9 w-9 translate-x-0 translate-y-0" />
                  <CarouselNext className="static h-9 w-9 translate-x-0 translate-y-0" />
                </div>
              </Carousel>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default MyNFTsPage;
