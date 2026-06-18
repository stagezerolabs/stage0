import NamesSubnav from '@/components/rns/NamesSubnav';
import { ArrowRight, Search, Star } from '@/components/ui/icons';
import { fetchRnsPricing, type RnsPricingSummary } from '@/lib/api/rns';
import {
  useRnsApproveForAll,
  useRnsContracts,
  useRnsCreateMarketplaceAuction,
  useRnsIsApproved,
  useRnsOwnedLabel,
} from '@/lib/hooks/rns';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { parseEther } from 'viem';
import { useAccount } from 'wagmi';

type ListingKind = 'auction' | 'buy-now';

type MarketplaceListing = {
  label: string;
  length: number;
  kind: ListingKind;
  priceEth: number;
  bids?: number;
  ends?: string;
  seller: string;
};

const featuredNames = [
  { label: 'ai', bid: 10.0, bids: 23, ends: '4h 12m' },
  { label: 'gm', bid: 8.4, bids: 41, ends: '1d 03h' },
  { label: 'ok', bid: 6.2, bids: 17, ends: '11h 40m' },
  { label: 'vc', bid: 5.0, bids: 9, ends: '2d 06h' },
  { label: 'eth', bid: 18.0, bids: 64, ends: '9h 12m' },
  { label: 'x0', bid: 4.2, bids: 13, ends: '6h 55m' },
];

const listings: MarketplaceListing[] = [
  { label: 'dao', length: 3, kind: 'auction', priceEth: 0.34, bids: 21, ends: '7h 02m', seller: '0xA1...3f2' },
  { label: 'nft', length: 3, kind: 'buy-now', priceEth: 0.4, seller: 'rise.dev' },
  { label: 'defi', length: 4, kind: 'auction', priceEth: 0.082, bids: 14, ends: '5h 20m', seller: 'degen.rise' },
  { label: 'mint', length: 4, kind: 'buy-now', priceEth: 0.06, seller: '0x4C...A71' },
  { label: 'web3', length: 4, kind: 'auction', priceEth: 0.051, bids: 9, ends: '3h 02m', seller: '0x8E...c92' },
  { label: 'apex', length: 4, kind: 'buy-now', priceEth: 0.045, seller: '0xF0...9d1' },
  { label: 'node', length: 4, kind: 'auction', priceEth: 0.038, bids: 7, ends: '1d 04h', seller: 'minabo.lab' },
  { label: 'vault', length: 5, kind: 'auction', priceEth: 0.018, bids: 11, ends: '8h 47m', seller: '0x12...4ab' },
  { label: 'trade', length: 5, kind: 'buy-now', priceEth: 0.012, seller: '0x77...fba5' },
];

function formatEth(value: number) {
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

function formatUsd(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'USD loading';
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function DomainsMarketplacePage() {
  const { address, isConnected } = useAccount();
  const { chainId, marketplace } = useRnsContracts();
  const { allDomains } = useRnsOwnedLabel(address);
  const { isApproved, refetch: refetchApproval } = useRnsIsApproved(address, marketplace);
  const {
    approve,
    isPending: isApprovalPending,
    isConfirming: isApprovalConfirming,
    isSuccess: isApprovalSuccess,
    error: approvalError,
  } = useRnsApproveForAll(marketplace);
  const {
    createAuction,
    isPending: isCreateAuctionPending,
    isConfirming: isCreateAuctionConfirming,
    isSuccess: isCreateAuctionSuccess,
    error: createAuctionError,
  } = useRnsCreateMarketplaceAuction();
  const [kind, setKind] = useState<'all' | ListingKind>('all');
  const [lengthFilter, setLengthFilter] = useState<'all' | '2' | '3' | '4' | '5'>('all');
  const [sort, setSort] = useState('hot');
  const [query, setQuery] = useState('');
  const [pricing, setPricing] = useState<RnsPricingSummary | null>(null);
  const [selectedAuctionName, setSelectedAuctionName] = useState('');
  const [reserveEth, setReserveEth] = useState('0.05');
  const [auctionDays, setAuctionDays] = useState('3');

  const ownedNames = useMemo(
    () => allDomains.filter((domain) => Boolean(domain.label)),
    [allDomains],
  );
  const ethUsd = pricing?.ethUsd ?? null;
  const reserveUsd = Number(reserveEth) > 0 && ethUsd ? Number(reserveEth) * ethUsd : null;
  const canCreateAuction =
    isConnected &&
    Boolean(selectedAuctionName) &&
    Number(reserveEth) > 0 &&
    Number.parseInt(auctionDays, 10) > 0;
  const isApprovalBusy = isApprovalPending || isApprovalConfirming;
  const isCreateAuctionBusy = isCreateAuctionPending || isCreateAuctionConfirming;

  const filteredListings = useMemo(() => {
    let result = listings.filter((listing) => {
      const kindMatch = kind === 'all' || listing.kind === kind;
      const lengthMatch =
        lengthFilter === 'all' ||
        (lengthFilter === '5' ? listing.length >= 5 : listing.length === Number(lengthFilter));
      const queryMatch = !query || listing.label.includes(query.toLowerCase());
      return kindMatch && lengthMatch && queryMatch;
    });

    if (sort === 'price-low') result = [...result].sort((a, b) => a.priceEth - b.priceEth);
    if (sort === 'price-high') result = [...result].sort((a, b) => b.priceEth - a.priceEth);
    if (sort === 'ending') result = [...result].sort((a, b) => (a.ends ?? 'z').localeCompare(b.ends ?? 'z'));

    return result;
  }, [kind, lengthFilter, query, sort]);

  useEffect(() => {
    let cancelled = false;
    fetchRnsPricing({ chainId })
      .then((next) => {
        if (!cancelled) setPricing(next);
      })
      .catch(() => {
        if (!cancelled) setPricing(null);
      });
    return () => {
      cancelled = true;
    };
  }, [chainId]);

  useEffect(() => {
    if (!selectedAuctionName && ownedNames[0]?.label) {
      setSelectedAuctionName(ownedNames[0].label);
    }
  }, [ownedNames, selectedAuctionName]);

  useEffect(() => {
    if (isApprovalSuccess) {
      toast.success('Marketplace approved for your RNS names.');
      void refetchApproval();
    }
  }, [isApprovalSuccess, refetchApproval]);

  useEffect(() => {
    if (approvalError) {
      toast.error(approvalError.message.split('\n')[0] ?? 'Marketplace approval failed.');
    }
  }, [approvalError]);

  useEffect(() => {
    if (isCreateAuctionSuccess) {
      toast.success('Auction created. Senna will index it shortly.');
    }
  }, [isCreateAuctionSuccess]);

  useEffect(() => {
    if (createAuctionError) {
      toast.error(createAuctionError.message.split('\n')[0] ?? 'Auction creation failed.');
    }
  }, [createAuctionError]);

  const handleCreateAuction = () => {
    if (!canCreateAuction) {
      toast.error('Choose a name, reserve price, and auction duration.');
      return;
    }
    if (!isApproved) {
      toast.error('Approve marketplace escrow first.');
      return;
    }

    const durationDays = Number.parseInt(auctionDays, 10);
    const startTime = BigInt(Math.floor(Date.now() / 1000) + 120);
    const endTime = startTime + BigInt(durationDays * 24 * 60 * 60);

    createAuction({
      name: selectedAuctionName,
      reservePrice: parseEther(reserveEth),
      minIncrementBps: 500,
      startTime,
      endTime,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="names-marketplace-page"
    >
      <section className="names-hero">
        <div>
          <div className="eyebrow">RNS Marketplace</div>
          <h1 className="ds-h1 mt-2">
            Buy and sell <span className="text-accent">.rise</span> names
          </h1>
          <p className="text-body-lg text-ink-muted mt-3 max-w-2xl">
            Browse .rise name auctions, track bid prices in ETH and USD, and put your owned names up for auction.
          </p>
        </div>
        <NamesSubnav />
      </section>

      <section className="mkt-hero-grid">
        <div className="rns-card rns-card-pad">
          <div className="names-card-heading">
            <div>
              <div className="nm-suggest-label">Most contested</div>
              <h2 className="font-display text-2xl text-ink mt-1">Hottest short names</h2>
            </div>
            <span className="nm-tag nm-tag-auction">Preview</span>
          </div>
          <div className="hot-grid mkt-featured-grid">
            {featuredNames.map((name) => (
              <div key={name.label} className="hot-card big">
                <div className="hot-top">
                  <span className="nm-tier">{name.label.length}-char</span>
                </div>
                <div className="hot-name">
                  {name.label}<span className="tld">.rise</span>
                </div>
                <div className="hot-meta">
                  <div className="hot-bid-lbl">Top bid</div>
                  <div className="hot-bid">{formatEth(name.bid)} ETH</div>
                  <div className="mkt-price-usd">≈ {formatUsd(ethUsd ? name.bid * ethUsd : null)}</div>
                </div>
                <div className="hot-foot">
                  <span>{name.bids} bids</span>
                  <span className="hot-timer">{name.ends}</span>
                </div>
                <button type="button" disabled className="mkt-card-cta is-auction">
                  Bidding soon
                </button>
              </div>
            ))}
          </div>
        </div>

        <aside className="rns-card rns-card-pad mkt-owned-panel">
          <span className="nm-primary-pill">
            <Star className="w-3 h-3" />
            Your names
          </span>
          <h2 className="font-display text-2xl text-ink mt-4">List-ready inventory</h2>
          <p className="text-body-sm text-ink-muted mt-2">
            {ownedNames.length > 0
              ? `You have ${ownedNames.length} .rise name${ownedNames.length === 1 ? '' : 's'} ready to list or auction.`
              : 'Register a name first, then come back to create a listing or auction.'}
          </p>
          {ownedNames.length > 0 ? (
            <div className="nm-list mkt-owned-list">
              {ownedNames.slice(0, 4).map((domain) => (
                <div key={domain.node} className="nm-row">
                  <span className="nm-row-name">
                    <b>{domain.label}</b><span className="tld">.rise</span>
                  </span>
                  <span className="nm-tier">Owned</span>
                </div>
              ))}
            </div>
          ) : null}
          {ownedNames.length > 0 ? (
            <div className="mkt-auction-form">
              <div className="nm-suggest-label">Create auction</div>
              <label className="mkt-field">
                <span>Name</span>
                <select value={selectedAuctionName} onChange={(event) => setSelectedAuctionName(event.target.value)}>
                  {ownedNames.map((domain) => (
                    <option key={domain.node} value={domain.label}>
                      {domain.label}.rise
                    </option>
                  ))}
                </select>
              </label>
              <div className="mkt-field-grid">
                <label className="mkt-field">
                  <span>Reserve ETH</span>
                  <input value={reserveEth} onChange={(event) => setReserveEth(event.target.value)} inputMode="decimal" />
                </label>
                <label className="mkt-field">
                  <span>Days</span>
                  <input value={auctionDays} onChange={(event) => setAuctionDays(event.target.value)} inputMode="numeric" />
                </label>
              </div>
              <div className="mkt-auction-estimate">
                Reserve ≈ {formatUsd(reserveUsd)} · 5% minimum bid step
              </div>
              {!isApproved ? (
                <button
                  type="button"
                  onClick={approve}
                  disabled={isApprovalBusy}
                  className="btn-secondary names-action-btn w-full disabled:opacity-60"
                >
                  {isApprovalBusy ? 'Approving...' : 'Approve marketplace'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateAuction}
                  disabled={!canCreateAuction || isCreateAuctionBusy}
                  className="btn-primary names-action-btn w-full disabled:opacity-60"
                >
                  {isCreateAuctionBusy ? 'Creating auction...' : 'Start auction'}
                </button>
              )}
            </div>
          ) : null}
          <Link to="/domains" className="btn-primary names-action-btn mt-5">
            Register a name <ArrowRight className="w-4 h-4" />
          </Link>
        </aside>
      </section>

      <section className="mkt-filter-section">
        <div className="filter-bar">
          <Search className="w-4 h-4 text-ink-faint" />
          <input
            className="search-input"
            placeholder="Search listings..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="chip-group">
            {[
              ['all', 'All'],
              ['auction', 'Auctions'],
              ['buy-now', 'Buy now'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`chip ${kind === value ? 'active' : ''}`}
                onClick={() => setKind(value as 'all' | ListingKind)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="chip-group">
            {[
              ['all', 'Any'],
              ['2', '2 char'],
              ['3', '3 char'],
              ['4', '4 char'],
              ['5', '5+'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`chip ${lengthFilter === value ? 'active-secondary' : ''}`}
                onClick={() => setLengthFilter(value as 'all' | '2' | '3' | '4' | '5')}
              >
                {label}
              </button>
            ))}
          </div>
          <select className="sort-dropdown" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="hot">Sort: Hottest</option>
            <option value="price-low">Price low to high</option>
            <option value="price-high">Price high to low</option>
            <option value="ending">Ending soon</option>
          </select>
        </div>
      </section>

      <section>
        <div className="mkt-grid">
          {filteredListings.map((listing) => (
            <div key={listing.label} className="mkt-card">
              <div className="mkt-card-top">
                <div>
                  <div className="mkt-card-name">
                    {listing.label}<span className="tld">.rise</span>
                  </div>
                  <div className="mkt-card-seller">by {listing.seller}</div>
                </div>
              </div>
              <div className="mkt-card-price-row">
                <div>
                  <div className="mkt-price-lbl">{listing.kind === 'auction' ? 'Current bid' : 'Price'}</div>
                  <div className="mkt-price-eth">{formatEth(listing.priceEth)} ETH</div>
                  <div className="mkt-price-usd">≈ {formatUsd(ethUsd ? listing.priceEth * ethUsd : null)}</div>
                </div>
                <div className="mkt-price-right">
                  <div className="mkt-price-lbl">{listing.kind === 'auction' ? 'Ends in' : 'Length'}</div>
                  <div className={`mkt-price-meta ${listing.kind === 'auction' ? 'timer' : ''}`}>
                    {listing.kind === 'auction' ? listing.ends : `${listing.length} char`}
                  </div>
                  <div className="mkt-price-usd">{listing.kind === 'auction' ? `${listing.bids} bids` : 'Instant'}</div>
                </div>
              </div>
              <button
                type="button"
                disabled
                className={`mkt-card-cta ${listing.kind === 'auction' ? 'is-auction' : 'is-buy-now'}`}
              >
            {listing.kind === 'auction' ? 'Bidding soon' : 'Buying soon'}
              </button>
            </div>
          ))}
        </div>

        {filteredListings.length === 0 ? (
          <div className="rns-card rns-card-pad mkt-empty-state">
            <h3 className="font-display text-2xl text-ink">No listings match your filters</h3>
            <p className="text-body-sm text-ink-muted mt-2">Try clearing the search or length filters.</p>
          </div>
        ) : null}
      </section>

      <section className="mkt-list-banner">
        <div>
          <div className="eyebrow">Own a name?</div>
          <h2 className="font-display text-3xl text-ink mt-2">List it for sale or auction</h2>
          <p className="text-body-sm text-ink-muted mt-3 max-w-md">
            Owned names can now be escrowed into the marketplace for auction. If you are outbid, your previous bid is withdrawable from the contract.
          </p>
        </div>
        <Link to="/domains" className="btn-primary names-action-btn">
          Manage names <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </motion.div>
  );
}

export default DomainsMarketplacePage;
