import { Badge } from '@/components/ui/badge';
import { useUserOwnedNFTTokens } from '@/lib/hooks/useUserOwnedNFTTokens';
import { ArrowRight, Image, Wallet } from 'lucide-react';
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';

const MyNFTsPage: React.FC = () => {
  const { address, isConnected } = useAccount();

  const {
    tokens,
    holdings,
    totalOwned,
    isLoading,
    isTruncatedScan,
    truncatedCollections,
    scanLimitPerCollection,
  } = useUserOwnedNFTTokens(address, isConnected);

  const liveCount = useMemo(
    () => holdings.filter((holding) => holding.status === 'live').length,
    [holdings]
  );

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-display-lg text-ink">My NFTs</h1>
        <div className="glass-card rounded-3xl p-10 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-canvas-alt border border-border mx-auto flex items-center justify-center">
            <Wallet className="w-6 h-6 text-ink-muted" />
          </div>
          <p className="text-body text-ink-muted">Connect your wallet to view NFTs you own.</p>
          <Link to="/presales" className="btn-secondary inline-flex">
            Browse Launchpad
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="font-display text-display-lg text-ink">My NFTs</h1>
        <p className="text-body text-ink-muted">
          View NFTs minted and currently held across launchpad collections.
        </p>
      </section>

      <section className="md:hidden rounded-2xl border border-border bg-canvas-alt overflow-hidden">
        <div className="divide-y divide-border/60">
          <div className="flex items-center justify-between p-4">
            <p className="text-label text-ink-faint uppercase">Collections</p>
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
        </div>
      </section>

      <section className="hidden md:grid md:grid-cols-3 gap-4">
        <div className="stat-card p-5">
          <p className="text-label text-ink-faint uppercase">Collections</p>
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

      {isLoading && tokens.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center">
          <p className="text-body text-ink-muted">Loading your NFT holdings…</p>
        </div>
      ) : tokens.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center space-y-4">
          <p className="text-body text-ink-muted">
            No NFT holdings found yet. Mint from live collections on launchpad.
          </p>
          <Link to="/presales" className="btn-secondary inline-flex items-center gap-2">
            Open Launchpad <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-body text-ink-muted">
              {tokens.length} NFTs across {holdings.length} collections, {liveCount} collections currently live.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {tokens.map((token) => {
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
                  {token.image ? (
                    <img
                      src={token.image}
                      alt={token.metadataName || `${token.collectionSymbol} #${token.tokenId.toString()}`}
                      className="w-full h-40 object-cover"
                    />
                  ) : (
                    <div className="w-full h-40 bg-canvas-alt border-b border-border flex items-center justify-center">
                      <Image className="w-8 h-8 text-ink-faint" />
                    </div>
                  )}

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
        </section>
      )}
    </div>
  );
};

export default MyNFTsPage;
