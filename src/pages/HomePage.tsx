import CountUp from '@/components/ui/CountUp';
import { useLaunchpadPresales } from '@/lib/hooks/useLaunchpadPresales';
import { projects } from '@/lib/projects';
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Image as ImageIcon,
  Lock,
  Rocket,
  Search,
  Send,
  Sliders,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import React, { useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { formatUnits } from 'viem';

/* ─── Shared Hooks ─── */

// function useMousePosition() {
//   const x = useMotionValue(0.5);
//   const y = useMotionValue(0.5);

//   useEffect(() => {
//     const handler = (e: MouseEvent) => {
//       x.set(e.clientX / window.innerWidth);
//       y.set(e.clientY / window.innerHeight);
//     };
//     window.addEventListener('mousemove', handler);
//     return () => window.removeEventListener('mousemove', handler);
//   }, [x, y]);

//   return { mouseX: x, mouseY: y };
// }

function useTiltCard(strength: number = 12) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(rotateX, { stiffness: 200, damping: 20 });
  const springY = useSpring(rotateY, { stiffness: 200, damping: 20 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      rotateY.set(nx * strength);
      rotateX.set(-ny * strength);
    },
    [strength, rotateX, rotateY]
  );

  const handleMouseLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  return { ref, springX, springY, handleMouseMove, handleMouseLeave };
}

const MotionLink = motion.create(Link);

const MagneticButton: React.FC<{
  children: React.ReactNode;
  className?: string;
  as?: 'button' | 'link';
  to?: string;
  onClick?: () => void;
}> = ({ children, className = '', as = 'button', to, onClick }) => {
  const reducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20 });
  const springY = useSpring(y, { stiffness: 300, damping: 20 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (reducedMotion) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      x.set((e.clientX - cx) * 0.25);
      y.set((e.clientY - cy) * 0.25);
    },
    [reducedMotion, x, y]
  );

  const handleMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  const motionProps = {
    style: { x: springX, y: springY },
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    className,
  };

  if (as === 'link' && to) {
    return (
      <MotionLink to={to} {...motionProps}>
        {children}
      </MotionLink>
    );
  }

  return (
    <motion.button {...motionProps} onClick={onClick}>
      {children}
    </motion.button>
  );
};

/* ─── StatGauge ─── */

const StatGauge: React.FC<{ fill: number; color: string }> = ({ fill, color }) => {
  const ref = useRef<SVGSVGElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (fill / 100) * circumference;

  return (
    <svg
      ref={ref}
      className="absolute inset-0 m-auto progress-ring"
      width="100"
      height="100"
      viewBox="0 0 100 100"
      style={{ opacity: 0.15 }}
    >
      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" opacity={0.1} />
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={isInView ? offset : circumference}
        style={{ transition: 'stroke-dashoffset 2s cubic-bezier(0.16, 1, 0.3, 1)' }}
      />
    </svg>
  );
};

/* ─── Animation Variants ─── */

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
  hidden: { opacity: 0, y: 40, scale: 0.98, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 1,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

/* ─── Creator Tools Data ─── */

const creatorTools = [
  { title: 'Create Token', icon: DollarSign, href: '/create/token', description: 'Deploy ERC20 tokens natively.' },
  { title: 'Launch Presale', icon: Sliders, href: '/create/presale', description: 'Raise community funds with zero coding.' },
  { title: 'Token Locker', icon: Lock, href: '/tools/token-locker', description: 'Lock liquidity & build trust.' },
  { title: 'Airdrop', icon: Send, href: '/tools/airdrop', description: 'Multi-send tokens to your users.' },
  { title: 'NFT Deploy', icon: ImageIcon, href: '/create/nft', description: 'Launch NFT collections seamlessly.' },
];

/* ─── Rise Glow Orbs (dark mode only) ─── */

const riseOrbs = [
  { color: 'rgba(255, 138, 0, 0.45)', size: 32, blur: 14, left: '10%', top: '20%', x: [0, 18, -12, 8, -18, 4, 0], y: [0, -14, 10, -18, 6, 14, 0], duration: 7.2, scale: [1, 1.35, 0.85, 1.25, 0.9, 1.15, 1] },
  { color: 'rgba(139, 124, 255, 0.38)', size: 38, blur: 16, left: '78%', top: '12%', x: [0, -14, 20, -10, 14, -6, 0], y: [0, 12, -16, 14, -10, 8, 0], duration: 9.8, scale: [1, 0.9, 1.3, 0.88, 1.2, 0.95, 1] },
  { color: 'rgba(255, 170, 50, 0.32)', size: 26, blur: 12, left: '42%', top: '72%', x: [0, 14, -20, 16, -10, 8, 0], y: [0, -18, 8, -12, 16, -6, 0], duration: 6.4, scale: [1, 1.2, 0.9, 1.35, 0.85, 1.1, 1] },
  { color: 'rgba(244, 152, 88, 0.35)', size: 30, blur: 13, left: '88%', top: '58%', x: [0, -10, 16, -14, 12, -8, 0], y: [0, 14, -12, 18, -14, 6, 0], duration: 8.6, scale: [1, 1.15, 0.92, 1.28, 0.88, 1.05, 1] },
  { color: 'rgba(120, 200, 255, 0.28)', size: 22, blur: 11, left: '28%', top: '38%', x: [0, 20, -10, 14, -20, 6, 0], y: [0, -10, 16, -14, 8, -12, 0], duration: 10.2, scale: [1, 0.88, 1.3, 0.9, 1.22, 0.95, 1] },
  { color: 'rgba(255, 138, 0, 0.30)', size: 24, blur: 12, left: '58%', top: '80%', x: [0, -16, 12, -8, 18, -10, 0], y: [0, 10, -14, 16, -12, 8, 0], duration: 7.8, scale: [1, 1.25, 0.88, 1.18, 0.92, 1.1, 1] },
  { color: 'rgba(139, 124, 255, 0.22)', size: 20, blur: 10, left: '50%', top: '10%', x: [0, 12, -18, 10, -14, 16, 0], y: [0, -16, 12, -8, 14, -10, 0], duration: 11.5, scale: [1, 1.1, 0.92, 1.3, 0.86, 1.05, 1] },
];

const RiseGlowOrbs: React.FC = () => (
  <span
    className="hero-rise-orbs"
    style={{ position: 'absolute', inset: '-0.3em -0.4em', zIndex: -1, pointerEvents: 'none' }}
    aria-hidden="true"
  >
    {riseOrbs.map((orb, i) => (
      <motion.span
        key={i}
        style={{
          position: 'absolute',
          width: orb.size,
          height: orb.size,
          left: orb.left,
          top: orb.top,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
          filter: `blur(${orb.blur}px)`,
          mixBlendMode: 'screen',
          transform: 'translate(-50%, -50%)',
        }}
        animate={{
          x: orb.x,
          y: orb.y,
          scale: orb.scale,
        }}
        transition={{
          duration: orb.duration,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    ))}
  </span>
);

/* ─── Main Component ─── */

const HomePage: React.FC = () => {
  const { presales, isLoading: isPresalesLoading } = useLaunchpadPresales('all');
  const reducedMotion = useReducedMotion();

  const livePresales = presales.filter((p) => p.status === 'live');
  const upcomingPresales = presales.filter((p) => p.status === 'upcoming');
  const featuredPresales = [...livePresales, ...upcomingPresales]
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'live' ? -1 : 1;
      return Number(a.startTime ?? 0n) - Number(b.startTime ?? 0n);
    })
    .slice(0, 3);
  const fallbackFeaturedPresales = projects
    .filter((project) => project.status === 'Live' || project.status === 'Upcoming')
    .slice(0, 3);
  const featuredItems =
    featuredPresales.length > 0
      ? featuredPresales
      : isPresalesLoading
      ? []
      : fallbackFeaturedPresales;

  // Global Page Scroll
  const { scrollY } = useScroll();

  // Hero section parallax values
  const heroBgY = useTransform(scrollY, [0, 800], [0, 200]);
  const heroContentY = useTransform(scrollY, [0, 500], [0, 100]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);

  // Tilt for stat cards
  const stat1 = useTiltCard(12);
  const stat2 = useTiltCard(12);
  const stat3 = useTiltCard(12);
  const statTilts = [stat1, stat2, stat3];

  // Timeline Scroll Animation
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: sectionScrollY } = useScroll({
    target: timelineContainerRef,
    offset: ['start 80%', 'end 50%'],
  });
  const lineProgress = useSpring(sectionScrollY, { stiffness: 100, damping: 30, restDelta: 0.001 });

  // Title words for hero
  const titleWords = 'Community Driven Launches on'.split(' ');

  return (
    <div className="w-full relative text-ink min-h-screen pb-20">

      {/* ─── Hero Section ─── */}
      <motion.section
        className="relative pt-24 pb-40 md:pt-20 md:pb-56 overflow-hidden rounded-[3rem] mb-20"
      >
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-canvas/25" />

          <div className="absolute inset-x-3 top-3 bottom-3 md:inset-x-8 md:top-6 md:bottom-6 rounded-[2.4rem] overflow-hidden border border-border/35 shadow-float">
            <motion.div className="absolute -inset-y-8 inset-x-0" style={{ y: heroBgY }}>
              <img
                src="https://res.cloudinary.com/dma1c8i6n/image/upload/v1760355735/8E0E699B-A13D-4070-88B3-95CFB47DBB1F_hexjo9.jpg"
                alt="Hero abstract background"
                className="w-full h-full object-cover object-center scale-[1.05]"
                style={{ opacity: 'var(--hero-image-opacity)' }}
              />
            </motion.div>

            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(255, 255, 255, 0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.08) 1px, transparent 1px)',
                backgroundSize: '34px 34px',
                opacity: 'var(--hero-grid-opacity)',
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to bottom, rgb(var(--color-canvas) / var(--hero-overlay-top)), rgb(var(--color-canvas) / var(--hero-overlay-mid)), rgb(var(--color-canvas) / var(--hero-overlay-bottom)))',
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(120% 85% at 50% 8%, transparent 45%, rgb(var(--color-canvas) / var(--hero-vignette-bottom)) 100%)',
              }}
            />
            <div className="absolute inset-0 border border-border/30 rounded-[2.4rem] pointer-events-none" />
          </div>

          <div
            className="absolute inset-x-0 bottom-0 h-24"
            style={{
              background:
                'linear-gradient(to bottom, transparent, rgb(var(--color-canvas) / var(--hero-bottom-fade)))',
            }}
          />
        </div>

        <motion.div
          className="relative z-20 max-w-5xl mx-auto px-4 text-center space-y-8"
          style={{ y: heroContentY, opacity: heroOpacity }}
        >

          <h1 className="font-display text-4xl sm:text-5xl md:text-7xl lg:text-8xl text-ink leading-[1.1] tracking-tight">
            {titleWords.map((word, i) => (
              <motion.span
                key={i}
                className="inline-block mr-[0.3em]"
                initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.8, delay: 0.2 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              >
                {word}
              </motion.span>
            ))}
            <motion.span
              className="inline-block hero-rise"
              initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, delay: 0.2 + titleWords.length * 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              <RiseGlowOrbs />
              Rise
            </motion.span>{' '}
            <motion.span
              className="inline-block"
              initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, delay: 0.2 + (titleWords.length + 1) * 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              Chain
            </motion.span>
          </h1>
          <motion.p
            className="text-lg md:text-xl text-ink-muted max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            StageZero is the ultimate launchpad for high-conviction onchain projects. Discover promising
            teams, join fair launches, and ship faster with integrated creator tooling.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <MagneticButton as="link" to="/presales" className="btn-primary py-4 px-8 text-lg rounded-full shadow-lg shadow-accent/20">
              Explore Projects
            </MagneticButton>
            <MagneticButton as="link" to="/create/token" className="btn-secondary py-4 px-8 text-lg rounded-full bg-canvas-alt border border-border/40 hover:bg-canvas-alt">
              Launch Token
            </MagneticButton>
          </motion.div>
        </motion.div>
      </motion.section>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-10% 0px' }}
        className="max-w-[1400px] mx-auto px-4 md:px-8 space-y-32"
      >
        {/* ─── Stats Section ─── */}
        <motion.section variants={itemVariants}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                label: 'Total Raised',
                value: 2.4,
                decimals: 1,
                prefix: '$',
                suffix: 'M+',
                duration: 2200,
                icon: TrendingUp,
                iconBg: 'bg-blue-500/15 text-blue-500 ring-1 ring-blue-500/30',
                ghost: '$',
                cardClass: 'ambient-stat-card--orange',
                gaugeColor: 'rgb(255, 138, 0)',
                gaugeFill: 80,
              },
              {
                label: 'Projects Launched',
                value: 12,
                decimals: 0,
                prefix: '',
                suffix: '',
                duration: 1800,
                icon: Rocket,
                iconBg: 'bg-green-500/15 text-green-500 ring-1 ring-green-500/30',
                ghost: '#',
                cardClass: 'ambient-stat-card--blue',
                gaugeColor: 'rgb(59, 130, 246)',
                gaugeFill: 60,
              },
              {
                label: 'Active Participants',
                value: 3200,
                decimals: 0,
                prefix: '',
                suffix: '+',
                duration: 2400,
                icon: Users,
                iconBg: 'bg-purple-500/15 text-purple-500 ring-1 ring-purple-500/30',
                ghost: '+',
                cardClass: 'ambient-stat-card--purple',
                gaugeColor: 'rgb(139, 124, 255)',
                gaugeFill: 90,
              },
            ].map((stat, i) => {
              const { ref, springX, springY, handleMouseMove, handleMouseLeave } = statTilts[i];
              return (
                <motion.div
                  key={stat.label}
                  ref={ref}
                  className={`ambient-stat-card ${stat.cardClass} text-center relative overflow-hidden bg-canvas-alt border border-border/50 rounded-3xl p-8`}
                  style={{
                    rotateX: reducedMotion ? 0 : springX,
                    rotateY: reducedMotion ? 0 : springY,
                    transformPerspective: 800,
                  }}
                  onMouseMove={reducedMotion ? undefined : handleMouseMove}
                  onMouseLeave={reducedMotion ? undefined : handleMouseLeave}
                  whileHover={reducedMotion ? {} : { scale: 1.02, backgroundColor: 'rgba(255,255,255,0.02)' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <span className="absolute -top-12 -right-8 text-[10rem] font-bold text-white/5 select-none pointer-events-none" aria-hidden="true">
                    {stat.ghost}
                  </span>
                  <div className="relative z-10">
                    <StatGauge fill={stat.gaugeFill} color={stat.gaugeColor} />
                    <div className={`w-14 h-14 rounded-2xl ${stat.iconBg} mx-auto flex items-center justify-center mb-6`}>
                      <stat.icon className="w-7 h-7" />
                    </div>
                    <p className="font-display text-4xl md:text-5xl text-ink font-bold tracking-tight">
                      <CountUp
                        to={stat.value}
                        durationMs={stat.duration}
                        decimals={stat.decimals}
                        prefix={stat.prefix}
                        suffix={stat.suffix}
                      />
                    </p>
                    <p className="text-lg text-ink-muted mt-2 font-medium">{stat.label}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ─── Featured Presales w/ Carousel/Grid ─── */}
        <motion.section variants={itemVariants} className="space-y-10">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold uppercase tracking-widest text-ink-muted">
                Featured
              </div>
              <h2 className="font-display text-3xl md:text-5xl text-ink">Live &amp; Upcoming IDOs</h2>
            </div>
            <Link to="/presales" className="btn-ghost group inline-flex items-center gap-2 text-sm uppercase tracking-wider font-semibold">
              View All
              <motion.span
                className="inline-block"
                transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                whileHover={{ x: 5 }}
              >
                <ArrowRight className="w-4 h-4" />
              </motion.span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isPresalesLoading && featuredItems.length === 0
              ? Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`featured-skeleton-${index}`}
                  className="rounded-[2.5rem] border border-white/5 bg-canvas-alt/70 overflow-hidden"
                >
                  <div className="h-48 bg-ink/10 animate-pulse" />
                  <div className="p-8 space-y-4">
                    <div className="h-6 w-3/4 rounded bg-ink/10 animate-pulse" />
                    <div className="h-4 w-1/3 rounded bg-ink/10 animate-pulse" />
                    <div className="h-20 rounded-2xl bg-ink/10 animate-pulse" />
                  </div>
                </div>
              ))
              : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                featuredItems.map((item: any, index) => {
              const isLive = item.status === 'live' || item.status === 'Live';
              const symbol = item.saleTokenSymbol || item.symbol || 'UNK';
              const name = item.saleTokenName || item.name || 'Unknown Project';
              const progress = item.progress || item.raisePercentage || 0;
              const link = item.address ? `/presales/${item.address}` : `/project/${item.id}`;

              return (
                <PresaleCard key={item.address || item.id} index={index} reducedMotion={!!reducedMotion}>
                  <Link to={link}>
                    <div className="group relative overflow-hidden rounded-[2.5rem] bg-canvas-alt border border-white/5 transition-all duration-500 hover:border-accent/40 flex flex-col h-full bg-gradient-to-br from-canvas-alt to-canvas">
                      {/* Presale Card Image Header */}
                      <div className="relative h-48 w-full overflow-hidden">
                        <img
                          src={`https://placehold.co/600x400/111/444?text=${symbol}`}
                          alt={name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-canvas-alt to-transparent" />
                        <span className={`absolute top-5 right-5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg ${isLive
                          ? 'bg-status-live-bg text-status-live border border-status-live/20'
                          : 'bg-status-upcoming-bg text-status-upcoming border border-status-upcoming/20'
                          }`}>
                          {isLive ? 'Live Now' : 'Upcoming'}
                        </span>
                      </div>

                      {/* Presale Details */}
                      <div className="p-8 pt-4 flex-1 flex flex-col justify-between space-y-6 relative z-10">
                        <div>
                          <h3 className="font-display text-2xl font-bold text-ink">{name}</h3>
                          <p className="text-sm font-semibold text-accent mt-1">${symbol}</p>
                        </div>

                        <div className="space-y-3 bg-white/5 rounded-2xl p-5 border border-white/5">
                          <div className="flex justify-between text-sm font-semibold">
                            <span className="text-ink-muted">Progress</span>
                            <span className="text-accent">{progress}%</span>
                          </div>
                          <ProgressBar progress={progress} />
                          <div className="flex justify-between text-xs font-medium text-ink-muted">
                            <span>Raised: {item.totalRaised ? formatUnits(item.totalRaised, item.paymentTokenDecimals ?? 18) : (item.raised || '0')}</span>
                            <span>Cap: {item.hardCap ? formatUnits(item.hardCap, item.paymentTokenDecimals ?? 18) : (item.targetRaise || '0')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </PresaleCard>
              );
                })
              )}
          </div>
        </motion.section>

        {/* ─── How It Works — Connected Timeline ─── */}
        <motion.section
          ref={timelineContainerRef}
          variants={itemVariants}
          className="space-y-16 py-10"
        >
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="font-display text-3xl md:text-5xl text-ink">How StageZero Works</h2>
            <p className="text-lg text-ink-muted">
              Participating in early-stage IDOs on Rise Chain is seamless. Connect, discover, and build with us.
            </p>
          </div>

          <div className="relative max-w-6xl mx-auto">
            {/* Scroll animated horizontal line (Desktop) */}
            <div className="hidden md:block absolute top-[4.5rem] left-[16.67%] right-[16.67%] h-1 bg-white/5 rounded-full" />
            <motion.div
              className="hidden md:block absolute top-[4.5rem] left-[16.67%] right-[16.67%] h-1 bg-gradient-to-r from-accent via-accent-secondary to-accent-tertiary rounded-full origin-left z-10 shadow-[0_0_15px_rgba(255,138,0,0.5)]"
              style={{ scaleX: lineProgress }}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative z-20">
              {[
                {
                  step: 1,
                  title: 'Connect Wallet',
                  description: 'Link your Rise wallet to authenticate and access the launchpad.',
                  icon: Wallet,
                },
                {
                  step: 2,
                  title: 'Explore Projects',
                  description: 'Browse meticulously vetted live and upcoming IDOs and their tokenomics.',
                  icon: Search,
                },
                {
                  step: 3,
                  title: 'Participate & Claim',
                  description: 'Contribute efficiently and claim your tokens via our smart contracts when live.',
                  icon: CheckCircle2,
                },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.7, delay: index * 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col items-center text-center space-y-6"
                >
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <div className="absolute inset-0 bg-canvas-alt rounded-full border border-white/10" />
                    <motion.div
                      className="absolute inset-2 rounded-full bg-accent/10 border border-accent/20"
                      whileInView={reducedMotion ? {} : { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <div className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-br from-canvas to-canvas-alt shadow-inner flex items-center justify-center border border-white/5 text-accent">
                      <item.icon className="w-8 h-8" />
                    </div>
                    {/* Step badge */}
                    <div className="absolute top-0 right-0 w-10 h-10 rounded-full bg-accent text-white font-bold text-lg flex items-center justify-center shadow-lg border-4 border-canvas">
                      {item.step}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-display text-2xl text-ink font-bold mb-3">{item.title}</h3>
                    <p className="text-base text-ink-muted leading-relaxed max-w-xs">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ─── Creator Tools — Bento Layout ─── */}
        <motion.section variants={itemVariants} className="space-y-10">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold uppercase tracking-widest text-ink-muted">
              For Builders
            </div>
            <h2 className="font-display text-3xl md:text-5xl text-ink">Creator Suite</h2>
            <p className="text-lg text-ink-muted max-w-2xl">
              Launch natively on Rise Chain with our powerful, no-code tooling suite. Lock liquidity, deploy tokens, and drop NFTs instantly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-6 auto-rows-[220px]">
            {creatorTools.map((tool, idx) => {
              const layoutClasses = [
                'md:col-span-3 md:row-span-2 md:col-start-1 md:row-start-1',
                'md:col-span-3 md:row-span-1 md:col-start-4 md:row-start-1',
                'md:col-span-3 md:row-span-1 md:col-start-4 md:row-start-2',
                'md:col-span-3 md:row-span-1 md:col-start-1 md:row-start-3',
                'md:col-span-3 md:row-span-1 md:col-start-4 md:row-start-3',
              ];
              const offsetClasses = [
                'md:-translate-y-1',
                'md:-translate-y-2',
                'md:translate-y-2',
                'md:translate-y-1',
                'md:-translate-y-1',
              ];
              const isFeatureCard = idx === 0;

              return (
                <motion.div
                  key={tool.href}
                  className={`relative overflow-hidden rounded-3xl group border border-white/5 bg-canvas-alt min-h-[220px] transition-transform duration-500 ${layoutClasses[idx]} ${offsetClasses[idx]}`}
                  whileHover={reducedMotion ? {} : { scale: 0.99 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <Link to={tool.href} className="block w-full h-full relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/60 to-transparent opacity-90 transition-opacity duration-300 group-hover:opacity-100" />

                    <div className={`absolute inset-x-0 bottom-0 flex flex-col justify-end ${isFeatureCard ? 'p-10 md:p-12' : 'p-7 md:p-8'}`}>
                      <div className={`w-14 h-14 rounded-2xl bg-canvas-alt text-accent flex items-center justify-center transition-all duration-300 group-hover:bg-accent group-hover:text-white shadow-[0_0_20px_rgba(255,138,0,0)] group-hover:shadow-[0_0_30px_rgba(255,138,0,0.3)] ${isFeatureCard ? 'mb-7' : 'mb-5'}`}>
                        <tool.icon className="w-7 h-7" />
                      </div>
                      <h3 className={`font-display font-bold text-ink mb-2 ${isFeatureCard ? 'text-3xl md:text-4xl' : 'text-2xl'}`}>{tool.title}</h3>
                      <p className="text-sm font-medium text-ink-muted/90 max-w-sm">{tool.description}</p>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ─── CTA Banner ─── */}
        <motion.section
          variants={itemVariants}
          initial={{ opacity: 0, scale: 0.95, y: 40 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[3rem] border border-accent/20 bg-canvas-alt"
        >
          <div className="relative z-10 p-12 md:p-20 flex flex-col lg:flex-row items-center justify-between gap-12">
            <div className="space-y-6 max-w-2xl text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/30 text-accent text-sm font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(255,138,0,0.2)]">
                Tier Access Engine
              </div>
              <h3 className="font-display text-4xl md:text-6xl text-ink leading-tight font-bold">
                Stake to unlock <br />
                <span className="text-accent">exclusive allocations</span>
              </h3>
              <p className="text-lg text-ink-muted max-w-xl mx-auto lg:mx-0">
                Level up your tier status for guaranteed allocations and priority access to the most
                anticipated launches on StageZero.
              </p>
            </div>

            <div className="flex-shrink-0">
              <MagneticButton as="link" to="/staking" className="btn-primary py-5 px-10 text-xl rounded-2xl shadow-[0_0_40px_rgba(255,138,0,0.3)] hover:shadow-[0_0_60px_rgba(255,138,0,0.5)] transition-shadow">
                Start Staking Now
              </MagneticButton>
            </div>
          </div>
        </motion.section>

      </motion.div>
    </div>
  );
};

/* ─── PresaleCard with 3D Tilt ─── */

const PresaleCard: React.FC<{
  children: React.ReactNode;
  index: number;
  reducedMotion: boolean;
}> = ({ children, index, reducedMotion }) => {
  const { ref, springX, springY, handleMouseMove, handleMouseLeave } = useTiltCard(8);

  return (
    <motion.div
      ref={ref}
      variants={itemVariants}
      custom={index}
      style={{
        rotateX: reducedMotion ? 0 : springX,
        rotateY: reducedMotion ? 0 : springY,
        transformPerspective: 1000,
      }}
      onMouseMove={reducedMotion ? undefined : handleMouseMove}
      onMouseLeave={reducedMotion ? undefined : handleMouseLeave}
      className="h-full"
    >
      {children}
    </motion.div>
  );
};

/* ─── ProgressBar with animated fill ─── */

const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-20px' });

  return (
    <div ref={ref} className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden relative border border-white/5 shadow-inner">
      <motion.div
        className="h-full bg-gradient-to-r from-accent to-accent-secondary rounded-full relative"
        initial={{ width: 0 }}
        animate={isInView ? { width: `${progress}%` } : { width: 0 }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
      >
        <div className="absolute inset-0 bg-white/20 w-full h-full animate-pulse blur-[2px]" />
      </motion.div>
    </div>
  );
};

export default HomePage;
