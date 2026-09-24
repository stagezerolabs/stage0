import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, X } from '@/components/ui/icons';

type Category = 'Art' | 'Collectibles' | 'Worlds' | 'Gaming';
type Timeframe = '24h' | '7d' | '30d';
type Collection = {
  id: string;
  name: string;
  creator: string;
  category: Category;
  floor: number;
  volume: Record<Timeframe, number>;
  change: Record<Timeframe, number>;
  art: number;
  description: string;
};
type Item = {
  id: string;
  name: string;
  collectionId: string;
  owner: string;
  price: number;
  art: number;
  likes: number;
  description: string;
};

const collections: Collection[] = [
  { id: 'chrome-tide', name: 'Chrome Tide', creator: 'by studio.eight', category: 'Art', floor: 0.82, volume: { '24h': 42.8, '7d': 218.4, '30d': 964.1 }, change: { '24h': 18.4, '7d': 6.2, '30d': 2.4 }, art: 0, description: 'Liquid forms suspended between nature and machine.' },
  { id: 'aether-arc', name: 'Aether Arc', creator: 'by ina.studio', category: 'Worlds', floor: 0.46, volume: { '24h': 31.6, '7d': 184.2, '30d': 802.7 }, change: { '24h': 12.8, '7d': 22.3, '30d': -2.1 }, art: 1, description: 'Quiet monuments from places that never existed.' },
  { id: 'fuzz-club', name: 'Fuzz Club', creator: 'by little.blue', category: 'Collectibles', floor: 0.29, volume: { '24h': 28.4, '7d': 143.7, '30d': 617.3 }, change: { '24h': 34.2, '7d': 7.1, '30d': 19.9 }, art: 2, description: 'A colorful crowd of charming oddballs.' },
  { id: 'glass-garden', name: 'Glass Garden', creator: 'by solenne', category: 'Art', floor: 0.64, volume: { '24h': 22.9, '7d': 126.8, '30d': 528.5 }, change: { '24h': -3.6, '7d': -5.2, '30d': 4.2 }, art: 3, description: 'Impossible botanicals made from light and glass.' },
  { id: 'velocity-relics', name: 'Velocity Relics', creator: 'by apex.lab', category: 'Gaming', floor: 0.38, volume: { '24h': 19.7, '7d': 110.5, '30d': 476.9 }, change: { '24h': 8.7, '7d': 15.3, '30d': 9.1 }, art: 4, description: 'Artifacts from the future of racing.' },
  { id: 'moonline', name: 'Moonline', creator: 'by north.world', category: 'Worlds', floor: 0.51, volume: { '24h': 16.2, '7d': 92.4, '30d': 401.6 }, change: { '24h': 5.1, '7d': 27.7, '30d': 3.8 }, art: 5, description: 'Dreamlike terrain beneath a borrowed moon.' },
];

const items: Item[] = [
  { id: 'koi-082', name: 'Liquid Koi #082', collectionId: 'chrome-tide', owner: '0xA8...91D2', price: 1.24, art: 0, likes: 148, description: 'A chrome koi caught in a single fluid moment.' },
  { id: 'arch-114', name: 'Silent Arch #114', collectionId: 'aether-arc', owner: '0x7C...42B0', price: 0.88, art: 1, likes: 96, description: 'An imagined passage through a violet horizon.' },
  { id: 'orbit-026', name: 'Blue Orbit #026', collectionId: 'fuzz-club', owner: '0xB4...2F18', price: 0.42, art: 2, likes: 203, description: 'A curious little character with very big eyes.' },
  { id: 'bloom-208', name: 'Ember Bloom #208', collectionId: 'glass-garden', owner: '0x9D...7A64', price: 0.76, art: 3, likes: 117, description: 'A translucent flower radiating color in the dark.' },
  { id: 'apex-017', name: 'Apex Helmet #017', collectionId: 'velocity-relics', owner: '0x2E...C95F', price: 0.55, art: 4, likes: 84, description: 'A racing relic from a faster tomorrow.' },
  { id: 'echo-391', name: 'Emerald Echo #391', collectionId: 'moonline', owner: '0xF1...840E', price: 0.69, art: 5, likes: 132, description: 'A quiet valley beneath an oversized moon.' },
];

const categories = ['All', 'Art', 'Collectibles', 'Worlds', 'Gaming'] as const;
const artUrl = '/nft-marketplace-demo-art.png';

function ArtTile({ art, className = '', style }: { art: number; className?: string; style?: CSSProperties }) {
  const column = art % 3;
  const row = Math.floor(art / 3);
  return (
    <div
      role="img"
      aria-label="Original demo NFT artwork"
      className={`bg-cover bg-no-repeat ${className}`}
      style={{
        backgroundImage: `url(${artUrl})`,
        backgroundSize: '300% 200%',
        backgroundPosition: `${column * 50}% ${row * 100}%`,
        aspectRatio: '2 / 3',
        ...style,
      }}
    />
  );
}

function formatEth(value: number) {
  return `${value.toFixed(2)} ETH`;
}

export default function NFTMarketplacePage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number]>('All');
  const [timeframe, setTimeframe] = useState<Timeframe>('24h');
  const [ranking, setRanking] = useState<'Trending' | 'Top'>('Trending');
  const [sort, setSort] = useState('featured');
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const modalCloseRef = useRef<HTMLButtonElement>(null);

  const orderedCollections = useMemo(() => [...collections].sort((a, b) =>
    ranking === 'Top' ? b.volume[timeframe] - a.volume[timeframe] : b.change[timeframe] - a.change[timeframe]
  ), [ranking, timeframe]);
  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matches = items.filter((item) => {
      const collection = collections.find((entry) => entry.id === item.collectionId)!;
      return (category === 'All' || collection.category === category)
        && (!collectionId || item.collectionId === collectionId)
        && (!normalized || `${item.name} ${collection.name} ${collection.category}`.toLowerCase().includes(normalized));
    });
    if (sort === 'price-low') return matches.sort((a, b) => a.price - b.price);
    if (sort === 'price-high') return matches.sort((a, b) => b.price - a.price);
    if (sort === 'most-liked') return matches.sort((a, b) => b.likes - a.likes);
    return matches;
  }, [query, category, collectionId, sort]);

  useEffect(() => {
    if (!selectedItem) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modalCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedItem(null);
      if (event.key !== 'Tab') return;
      const focusable = modalRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [selectedItem]);

  const selectCollection = (id: string) => {
    setCollectionId(id);
    setCategory('All');
    document.getElementById('explore-nfts')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const toggleFavorite = (id: string) => setFavorites((current) =>
    current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
  );
  const selectedCollection = selectedItem ? collections.find((entry) => entry.id === selectedItem.collectionId) : null;

  return (
    <div className="space-y-11 pb-10 text-ink md:space-y-16">
      <section className="space-y-7">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-accent">Discover on RISE</p>
            <h1 aria-label="NFT Marketplace" className="font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">NFT Marketplace<span className="text-accent">.</span></h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-muted">Find remarkable digital art, meet new collections, and explore the next wave of NFTs on RISE.</p>
          </div>
          <label className="relative block w-full max-w-lg">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint" />
            <input
              aria-label="Search marketplace"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search items and collections"
              className="w-full rounded-2xl border border-border bg-canvas-alt py-4 pl-13 pr-5 text-sm text-ink shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
              style={{ paddingLeft: '3.25rem' }}
            />
          </label>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Marketplace categories">
          {categories.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => { setCategory(entry); setCollectionId(null); }}
              className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition ${category === entry && !collectionId ? 'bg-ink text-canvas' : 'border border-border bg-canvas-alt text-ink-muted hover:border-border-strong hover:text-ink'}`}
            >{entry}</button>
          ))}
        </div>
      </section>

      <section className="space-y-5" aria-labelledby="featured-collections-heading">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Curated picks</p>
            <h2 id="featured-collections-heading" className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Featured collections</h2>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Explore the spotlight</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {collections.slice(0, 3).map((collection, index) => (
            <button
              key={collection.id}
              type="button"
              onClick={() => selectCollection(collection.id)}
              className="group relative flex h-64 overflow-hidden rounded-3xl border border-border bg-canvas-alt text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl sm:h-72"
              aria-label={`Explore ${collection.name}`}
            >
              <div className={`absolute inset-0 ${index === 0 ? 'bg-gradient-to-br from-blue-950 to-blue-600' : index === 1 ? 'bg-gradient-to-br from-violet-950 to-fuchsia-700' : 'bg-gradient-to-br from-blue-950 to-rose-700'}`} />
              <ArtTile art={collection.art} className="absolute opacity-95 transition duration-500 group-hover:scale-105" style={{ top: 0, bottom: 0, right: 0, width: '55%', aspectRatio: 'auto' }} />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent" />
              <div className="relative flex h-full flex-col justify-between p-6 text-white">
                <span className="w-fit rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest backdrop-blur">Featured 0{index + 1}</span>
                <div>
                  <p className="text-xs text-white/70">{collection.creator}</p>
                  <h3 className="mt-1 font-display text-2xl font-bold tracking-tight">{collection.name}</h3>
                  <p className="mt-2 text-sm text-white/80">Floor {formatEth(collection.floor)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-5" aria-labelledby="trending-collections-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Market pulse · Demo data</p>
            <h2 id="trending-collections-heading" className="mt-1 font-display text-2xl font-semibold sm:text-3xl">{ranking} collections</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['Trending', 'Top'] as const).map((entry) => (
              <button key={entry} type="button" onClick={() => setRanking(entry)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${ranking === entry ? 'bg-ink text-canvas' : 'bg-canvas-alt text-ink-muted hover:text-ink'}`}>{entry}</button>
            ))}
            <span className="mx-1 self-center text-border-strong">│</span>
            {(['24h', '7d', '30d'] as const).map((entry) => (
              <button key={entry} type="button" onClick={() => setTimeframe(entry)} className={`rounded-xl px-3 py-2 text-sm font-semibold ${timeframe === entry ? 'bg-accent/15 text-accent' : 'text-ink-muted hover:text-ink'}`}>{entry}</button>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-3xl border border-border bg-canvas-alt">
          <div className="hidden grid-cols-[minmax(0,1fr)_110px_110px_110px] gap-4 border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wider text-ink-faint sm:grid lg:grid-cols-[minmax(0,1fr)_140px_140px_140px]">
            <span>Collection</span><span className="text-right">Floor</span><span className="text-right">{timeframe} change</span><span className="text-right">{timeframe} volume</span>
          </div>
          {orderedCollections.map((collection, index) => (
            <button key={collection.id} type="button" onClick={() => selectCollection(collection.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 px-4 py-3 text-left transition last:border-0 hover:bg-canvas sm:grid-cols-[minmax(0,1fr)_110px_110px_110px] sm:gap-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_140px_140px_140px]" aria-label={`Explore ${collection.name} collection`}>
              <span className="flex min-w-0 items-center gap-3">
                <span className="w-4 shrink-0 text-xs font-semibold text-ink-faint">{index + 1}</span>
                <ArtTile art={collection.art} className="h-12 w-12 shrink-0 rounded-xl sm:h-14 sm:w-14" />
                <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{collection.name}</span><span className="block truncate text-xs text-ink-faint">{collection.creator}</span></span>
              </span>
              <span className="text-right text-sm font-semibold text-ink">{formatEth(collection.floor)}</span>
              <span className={`hidden text-right text-sm font-medium sm:block ${collection.change[timeframe] >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{collection.change[timeframe] > 0 ? '+' : ''}{collection.change[timeframe].toFixed(1)}%</span>
              <span className="hidden text-right text-sm font-medium text-ink sm:block">{formatEth(collection.volume[timeframe])}</span>
            </button>
          ))}
        </div>
      </section>

      <section id="explore-nfts" className="scroll-mt-28 space-y-6" aria-labelledby="explore-nfts-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Browse the gallery</p>
            <h2 id="explore-nfts-heading" className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Explore NFTs</h2>
            <p className="mt-2 text-sm text-ink-muted">{visibleItems.length} items · Demo prices and owners</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <span>Sort by</span>
            <select aria-label="Sort NFTs" value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-xl border border-border bg-canvas-alt px-4 py-2.5 font-semibold text-ink outline-none focus:border-accent">
              <option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="most-liked">Most liked</option>
            </select>
          </label>
        </div>
        {collectionId && (
          <button type="button" onClick={() => setCollectionId(null)} className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-2 text-sm font-semibold text-accent">
            {collections.find((entry) => entry.id === collectionId)?.name} <X className="h-3.5 w-3.5" />
          </button>
        )}
        {visibleItems.length === 0 ? (
          <div className="rounded-3xl border border-border bg-canvas-alt px-6 py-16 text-center text-ink-muted">No demo NFTs match these filters.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {visibleItems.map((item) => {
              const collection = collections.find((entry) => entry.id === item.collectionId)!;
              const isFavorite = favorites.includes(item.id);
              return (
                <article key={item.id} className="group min-w-0 overflow-hidden rounded-2xl border border-border bg-canvas-alt shadow-sm transition hover:-translate-y-1 hover:border-border-strong hover:shadow-lg sm:rounded-3xl">
                  <div className="relative">
                    <button type="button" onClick={() => setSelectedItem(item)} aria-label={`View ${item.name}`} className="block w-full overflow-hidden">
                      <ArtTile art={item.art} className="aspect-[2/3] w-full transition duration-500 group-hover:scale-105" />
                    </button>
                    <button type="button" onClick={() => toggleFavorite(item.id)} aria-label={isFavorite ? `Remove ${item.name} from favorites` : `Add ${item.name} to favorites`} aria-pressed={isFavorite} className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-xl backdrop-blur transition hover:scale-110 ${isFavorite ? 'text-rose-400' : 'text-white'}`}>♥</button>
                  </div>
                  <div className="p-3 sm:p-4">
                    <p className="truncate text-xs font-medium text-ink-muted">{collection.name}</p>
                    <button type="button" onClick={() => setSelectedItem(item)} className="mt-1 block max-w-full truncate text-left text-sm font-bold text-ink hover:text-accent sm:text-base">{item.name}</button>
                    <div className="mt-4 flex items-end justify-between gap-1 border-t border-border pt-3">
                      <div><p className="text-[10px] uppercase tracking-wider text-ink-faint">Price</p><p className="text-sm font-bold text-ink sm:text-base">{formatEth(item.price)}</p></div>
                      <span className="text-xs text-ink-faint">♥ {item.likes + Number(isFavorite)}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col items-start justify-between gap-5 rounded-3xl border border-border bg-canvas-alt p-6 sm:flex-row sm:items-center sm:p-8">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Your collection starts here</p><h2 className="mt-2 font-display text-2xl font-semibold">Create on Stage0</h2><p className="mt-2 max-w-xl text-sm text-ink-muted">Launch a collection today. Marketplace trading will connect to real listings in a later release.</p></div>
        <Link to="/create/nft" className="btn-primary inline-flex shrink-0 items-center gap-2">Create collection <ArrowRight className="h-4 w-4" /></Link>
      </section>

      {selectedItem && selectedCollection && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedItem(null); }}>
          <div ref={modalRef} role="dialog" aria-modal="true" aria-label={selectedItem.name} className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-canvas-alt shadow-2xl md:grid md:grid-cols-2">
            <button ref={modalCloseRef} type="button" onClick={() => setSelectedItem(null)} aria-label="Close item preview" className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white"><X className="h-5 w-5" /></button>
            <ArtTile art={selectedItem.art} className="aspect-[2/3] w-full md:h-full" />
            <div className="flex flex-col p-6 sm:p-8">
              <span className="w-fit rounded-full bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">Demo item</span>
              <p className="mt-8 text-sm font-semibold text-accent">{selectedCollection.name}</p>
              <h2 className="mt-2 font-display text-3xl font-bold">{selectedItem.name}</h2>
              <p className="mt-4 text-sm leading-relaxed text-ink-muted">{selectedItem.description}</p>
              <div className="mt-8 grid grid-cols-2 gap-4 rounded-2xl border border-border p-5 text-sm">
                <div><p className="text-ink-faint">Owner</p><p className="mt-1 font-semibold">{selectedItem.owner}</p></div>
                <div><p className="text-ink-faint">Collection floor</p><p className="mt-1 font-semibold">{formatEth(selectedCollection.floor)}</p></div>
              </div>
              <div className="mt-auto pt-8"><p className="text-xs uppercase tracking-wider text-ink-faint">Listed price · demo</p><p className="mt-1 font-display text-3xl font-bold">{formatEth(selectedItem.price)}</p><button type="button" disabled className="mt-5 w-full cursor-not-allowed rounded-2xl bg-accent px-5 py-4 font-bold text-white opacity-55">Buy now (demo)</button><p className="mt-3 text-center text-xs text-ink-faint">Transactions are disabled in this demo. No wallet action will be requested.</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
