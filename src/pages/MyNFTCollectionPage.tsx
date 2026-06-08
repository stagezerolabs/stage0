import { Badge } from '@/components/ui/badge';
import FallbackImage from '@/components/ui/fallback-image';
import { NFT_COLLECTION_IMAGES, getExplorerUrl } from '@/config';
import { ArrowLeft, ExternalLink, Image as ImageIcon, Settings, Wallet } from '@/components/ui/icons';
import { useUserOwnedNFTTokens } from '@/lib/hooks/useUserOwnedNFTTokens';
import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { isAddress, type Address } from 'viem';
import { useAccount, useChainId } from 'wagmi';

const MyNFTCollectionPage: React.FC = () => {
  const { collectionAddress: collectionParam } = useParams<{ collectionAddress: string }>();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const explorerUrl = getExplorerUrl(chainId);

  const collectionAddress = useMemo(() => {
    if (!collectionParam || !isAddress(collectionParam, { strict: false })) return undefined;
    return collectionParam as Address;
  }, [collectionParam]);

  const {
    tokens,
    holdings,
    totalOwned,
    isLoading,
    isTruncatedScan,
    scanLimitPerCollection,
  } = useUserOwnedNFTTokens(address, isConnected && Boolean(collectionAddress), {
    collectionAddress,
  });

  const collection = holdings[0];
  const fallbackImage = collectionAddress ? NFT_COLLECTION_IMAGES[collectionAddress.toLowerCase()] : undefined;
  const isOwner = Boolean(address && collection?.owner && collection.owner.toLowerCase() === address.toLowerCase());
  const statusVariant = collection?.status === 'live'
    ? 'live'
    : collection?.status === 'upcoming'
      ? 'upcoming'
      : 'closed';

  if (!collectionAddress) {
    return (
      <div className="space-y-6">
        <Link to="/my-nfts" className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Collectibles
        </Link>
        <div className="glass-card rounded-3xl p-10 text-center">
          <p className="text-body text-ink-muted">The provided NFT collection address is not valid.</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <Link to="/my-nfts" className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Collectibles
        </Link>
        <div className="glass-card rounded-3xl p-10 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border bg-canvas-alt">
            <Wallet className="h-6 w-6 text-ink-muted" />
          </div>
          <p className="text-body text-ink-muted">Connect your wallet to view NFTs you own in this collection.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/my-nfts" className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Collectibles
        </Link>
        <div className="flex flex-wrap gap-2">
          {isOwner && (
            <Link to={`/nfts/manage/${collectionAddress}`} className="btn-secondary inline-flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Manage
            </Link>
          )}
          <Link to={`/nfts/${collectionAddress}`} className="btn-secondary">
            Sale page
          </Link>
          <a
            href={`${explorerUrl}/address/${collectionAddress}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost inline-flex items-center gap-2"
          >
            Explorer <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-border bg-canvas-alt">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
          <div className="relative min-h-[260px] bg-canvas">
            <FallbackImage
              src={collection?.metadataImage}
              fallbackSrc={fallbackImage}
              alt={collection?.name ?? 'NFT collection'}
              className="h-full w-full object-cover"
              placeholder={
                <div className="flex h-full min-h-[260px] w-full items-center justify-center">
                  <ImageIcon className="h-10 w-10 text-ink-muted" />
                </div>
              }
            />
          </div>

          <div className="p-6 md:p-8 lg:p-10">
            {collection ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-label uppercase text-ink-faint">Owned collection</p>
                    <h1 className="ds-h1 mt-2">{collection.name}</h1>
                    <p className="mt-2 font-mono text-body-sm uppercase tracking-[0.16em] text-ink-muted">
                      {collection.symbol}
                    </p>
                  </div>
                  <Badge variant={statusVariant}>{collection.status}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-border bg-canvas/50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Owned</p>
                    <p className="mt-2 font-display text-[26px] leading-none text-ink">{collection.ownedCount.toString()}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-canvas/50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Loaded</p>
                    <p className="mt-2 font-display text-[26px] leading-none text-ink">{tokens.length}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-canvas/50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Minted</p>
                    <p className="mt-2 font-mono text-[14px] text-ink">
                      {collection.totalMinted.toLocaleString()} / {collection.maxSupply.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-canvas/50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Type</p>
                    <p className="mt-2 font-mono text-[14px] text-ink">{collection.is721A ? 'ERC721A' : 'ERC721'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[260px] items-center">
                <p className="text-body text-ink-muted">
                  {isLoading ? 'Loading your NFTs in this collection...' : 'No owned NFTs found in this collection.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {isTruncatedScan && (
        <div className="rounded-2xl border border-status-upcoming/30 bg-status-upcoming-bg p-4">
          <p className="text-body-sm text-status-upcoming">
            This collection is large. Scanning is capped at {scanLimitPerCollection} token IDs for now.
          </p>
        </div>
      )}

      <section className="space-y-4">
        <div className="section-head">
          <div>
            <p className="text-label uppercase text-ink-faint">Owned NFTs</p>
            <h2 className="ds-h2 mt-1.5">Items in this collection</h2>
          </div>
          {collection && (
            <p className="text-body-sm text-ink-muted">
              Showing {tokens.length} of {totalOwned.toString()} owned NFTs
            </p>
          )}
        </div>

        {isLoading && tokens.length === 0 ? (
          <div className="glass-card rounded-3xl p-10 text-center">
            <p className="text-body text-ink-muted">Loading owned token metadata...</p>
          </div>
        ) : tokens.length === 0 ? (
          <div className="glass-card rounded-3xl p-10 text-center">
            <p className="text-body text-ink-muted">No owned token items found for this collection.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {tokens.map((token) => {
              const name = token.metadataName || `${token.collectionSymbol} #${token.tokenId.toString()}`;
              return (
                <article
                  key={`${token.collectionAddress}-${token.tokenId.toString()}`}
                  className="overflow-hidden rounded-3xl border border-border bg-canvas-alt"
                >
                  <FallbackImage
                    src={token.image}
                    alt={name}
                    className="h-56 w-full object-cover"
                    placeholder={
                      <div className="flex h-56 w-full items-center justify-center border-b border-border bg-canvas">
                        <ImageIcon className="h-8 w-8 text-ink-faint" />
                      </div>
                    }
                  />

                  <div className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-display text-display-sm text-ink">{name}</h3>
                        <p className="mt-1 font-mono text-body-sm text-ink-muted">
                          Token #{token.tokenId.toString()}
                        </p>
                      </div>
                      <span className="rounded-full border border-border bg-canvas px-2.5 py-1 font-mono text-[11px] text-ink-muted">
                        {token.is721A ? '721A' : '721'}
                      </span>
                    </div>

                    {token.metadataDescription && (
                      <p className="line-clamp-3 text-body-sm text-ink-faint">
                        {token.metadataDescription}
                      </p>
                    )}

                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Traits</p>
                      {token.attributes && token.attributes.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {token.attributes.map((attribute, index) => (
                            <div
                              key={`${token.collectionAddress}-${token.tokenId.toString()}-${attribute.traitType}-${index}`}
                              className="rounded-2xl border border-border bg-canvas/55 p-3"
                            >
                              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                                {attribute.traitType}
                              </p>
                              <p className="mt-1 truncate font-mono text-[12px] text-ink">
                                {attribute.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-2xl border border-border bg-canvas/45 p-3 text-body-sm text-ink-muted">
                          No traits found in this token metadata.
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default MyNFTCollectionPage;
