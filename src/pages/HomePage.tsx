import CountUp from '@/components/ui/CountUp';
import { useLaunchpadPresales } from '@/lib/hooks/useLaunchpadPresales';
import { projects } from '@/lib/projects';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Image,
  Lock,
  Rocket,
  Search,
  Send,
  Sliders,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { formatUnits } from 'viem';
import { useAccount } from 'wagmi';

/* ─── Shared Hooks ─── */

function useMousePosition() {
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      x.set(e.clientX / window.innerWidth);
      y.set(e.clientY / window.innerHeight);
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, [x, y]);

  return { mouseX: x, mouseY: y };
}

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

/* ─── MagneticButton ─── */

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
    const MotionLink = motion.create(Link);
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
  { title: 'Create Token', icon: DollarSign, href: '/create/token', description: 'Deploy ERC20 tokens' },
  { title: 'Launch Presale', icon: Sliders, href: '/create/presale', description: 'Raise community funds' },
  { title: 'Token Locker', icon: Lock, href: '/tools/token-locker', description: 'Lock liquidity' },
  { title: 'Airdrop', icon: Send, href: '/tools/airdrop', description: 'Multi-send tokens' },
  { title: 'NFT Deploy', icon: Image, href: '/create/nft', description: 'Launch NFT collections' },
];

/* ─── Main Component ─── */

const HomePage: React.FC = () => {
  const { openConnectModal } = useConnectModal();
  const { isConnected } = useAccount();
  const { presales } = useLaunchpadPresales('all');
  const reducedMotion = useReducedMotion();
  const { mouseX, mouseY } = useMousePosition();

  const livePresales = presales.filter((p) => p.status === 'live');
  const upcomingPresales = presales.filter((p) => p.status === 'upcoming');
  const featuredPresales = [...livePresales, ...upcomingPresales].slice(0, 3);

  // Parallax transforms for hero orbs
  const orbX1 = useTransform(mouseX, [0, 1], [30, -30]);
  const orbY1 = useTransform(mouseY, [0, 1], [30, -30]);
  const orbX2 = useTransform(mouseX, [0, 1], [-20, 20]);
  const orbY2 = useTransform(mouseY, [0, 1], [-20, 20]);
  const orbX3 = useTransform(mouseX, [0, 1], [15, -15]);
  const orbY3 = useTransform(mouseY, [0, 1], [-15, 15]);

  // CTA parallax
  const ctaGridX = useTransform(mouseX, [0, 1], [8, -8]);
  const ctaGridY = useTransform(mouseY, [0, 1], [8, -8]);

  // Word-by-word title
  const titleWords = 'Community Driven Launches on'.split(' ');

  // Tilt for stat cards
  const stat1 = useTiltCard(12);
  const stat2 = useTiltCard(12);
  const stat3 = useTiltCard(12);
  const statTilts = [stat1, stat2, stat3];

  // Timeline ref
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineInView = useInView(timelineRef, { once: true, margin: '-100px' });

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-20"
    >
      {/* ─── Hero Section ─── */}
      <motion.section variants={itemVariants} className="text-center pt-8 md:pt-16">
        <div className="relative max-w-4xl mx-auto space-y-6">
          {/* Parallax orbs */}
          {!reducedMotion && (
            <>
              <motion.div
                className="absolute -top-20 left-1/4 w-72 h-72 rounded-full bg-accent/15 blur-[80px] pointer-events-none"
                style={{ x: orbX1, y: orbY1 }}
              />
              <motion.div
                className="absolute -top-10 right-1/4 w-60 h-60 rounded-full bg-accent-secondary/15 blur-[70px] pointer-events-none"
                style={{ x: orbX2, y: orbY2 }}
              />
              <motion.div
                className="absolute top-20 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-accent-tertiary/10 blur-[60px] pointer-events-none"
                style={{ x: orbX3, y: orbY3 }}
              />
            </>
          )}

          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-ink leading-tight text-engraved relative z-10">
            {titleWords.map((word, i) => (
              <motion.span
                key={i}
                className="inline-block mr-[0.3em]"
                initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{
                  duration: 0.8,
                  delay: 0.4 + i * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                {word}
              </motion.span>
            ))}
            <motion.span
              className="inline-block"
              style={{ color: '#8B7CFF' }}
              initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{
                duration: 0.8,
                delay: 0.4 + titleWords.length * 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              Rise
            </motion.span>{' '}
            <motion.span
              className="inline-block"
              initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{
                duration: 0.8,
                delay: 0.4 + (titleWords.length + 1) * 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              Chain
            </motion.span>
          </h1>
          <motion.p
            className="text-base sm:text-lg text-ink-muted max-w-2xl mx-auto relative z-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            StageZero is a launchpad for high-conviction onchain projects. Discover promising
            teams, join fair launches, and ship faster with integrated creator tooling.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 relative z-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <MagneticButton as="link" to="/presales" className="btn-primary inline-flex items-center gap-2 p-6 rounded-full font-semibold">
              Explore Projects
            </MagneticButton>
            {/* {!isConnected && (
              <MagneticButton onClick={openConnectModal} className="btn-secondary inline-flex items-center gap-2">
                Connect Wallet
              </MagneticButton>
            )} */}
          </motion.div>
        </div>
      </motion.section>

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
            const tilt = statTilts[i];
            return (
              <motion.div
                key={stat.label}
                ref={tilt.ref}
                className={`ambient-stat-card ${stat.cardClass} text-center relative`}
                style={{
                  rotateX: reducedMotion ? 0 : tilt.springX,
                  rotateY: reducedMotion ? 0 : tilt.springY,
                  transformPerspective: 800,
                }}
                onMouseMove={reducedMotion ? undefined : tilt.handleMouseMove}
                onMouseLeave={reducedMotion ? undefined : tilt.handleMouseLeave}
                whileHover={reducedMotion ? {} : { scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <span className="ghost-numeral -top-8 -right-4 text-[8rem]" aria-hidden="true">
                  {stat.ghost}
                </span>
                <StatGauge fill={stat.gaugeFill} color={stat.gaugeColor} />
                <div
                  className={`w-12 h-12 rounded-2xl ${stat.iconBg} mx-auto flex items-center justify-center mb-4 transition-all`}
                >
                  <stat.icon className="w-6 h-6" />
                </div>
                <p className="font-display text-display-md text-ink">
                  <CountUp
                    to={stat.value}
                    durationMs={stat.duration}
                    decimals={stat.decimals}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                  />
                </p>
                <p className="text-body text-ink-muted mt-1">{stat.label}</p>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* ─── Featured Presales ─── */}
      <motion.section variants={itemVariants} className="space-y-8">
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <p className="text-label text-ink-faint uppercase tracking-wider">Featured</p>
            <h2 className="font-display text-display-md text-ink">Live &amp; Upcoming IDOs</h2>
          </div>
          <Link to="/presales" className="btn-ghost inline-flex items-center gap-1">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {featuredPresales.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredPresales.map((presale, index) => (
              <PresaleCard key={presale.address} index={index} reducedMotion={!!reducedMotion}>
                <Link to={`/presales/${presale.address}`}>
                  <div className="project-card project-card-enhanced rounded-3xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-display-sm text-ink">
                        {presale.saleTokenSymbol || 'Unknown Token'}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${presale.status === 'live'
                          ? 'bg-status-live-bg text-status-live'
                          : 'bg-status-upcoming-bg text-status-upcoming'
                          }`}
                      >
                        {presale.status === 'live' ? 'Live' : 'Upcoming'}
                      </span>
                    </div>
                    <p className="text-body-sm text-ink-muted">
                      {presale.saleTokenName || 'Token Sale'}
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-body-sm">
                        <span className="text-ink-muted">Progress</span>
                        <span className="text-ink font-medium">{presale.progress}%</span>
                      </div>
                      <ProgressBar progress={presale.progress} />
                      <div className="flex justify-between text-body-sm text-ink-muted">
                        <span>
                          {presale.totalRaised
                            ? formatUnits(presale.totalRaised, presale.paymentTokenDecimals ?? 18)
                            : '0'}{' '}
                          {presale.paymentTokenSymbol || ''}
                        </span>
                        <span>
                          {presale.hardCap
                            ? formatUnits(presale.hardCap, presale.paymentTokenDecimals ?? 18)
                            : '0'}{' '}
                          {presale.paymentTokenSymbol || ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </PresaleCard>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects
              .filter((p) => p.status === 'Live' || p.status === 'Upcoming')
              .slice(0, 3)
              .map((item, index) => (
                <PresaleCard key={item.id} index={index} reducedMotion={!!reducedMotion}>
                  <Link to={`/project/${item.address}`}>
                    <div className="project-card project-card-enhanced rounded-3xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-display text-display-sm text-ink">{item.symbol}</h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${item.status === 'Live'
                            ? 'bg-status-live-bg text-status-live'
                            : 'bg-status-upcoming-bg text-status-upcoming'
                            }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="text-body-sm text-ink-muted">{item.name}</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-body-sm">
                          <span className="text-ink-muted">Progress</span>
                          <span className="text-ink font-medium">{item.raisePercentage}%</span>
                        </div>
                        <ProgressBar progress={item.raisePercentage} />
                        <div className="flex justify-between text-body-sm text-ink-muted">
                          <span>{item.raised}</span>
                          <span>{item.targetRaise}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </PresaleCard>
              ))}
          </div>
        )}
      </motion.section>

      {/* ─── How It Works — Connected Timeline ─── */}
      <motion.section variants={itemVariants} className="space-y-12">
        <div className="text-center">
          <h2 className="font-display text-display-md text-ink">How It Works</h2>
          <p className="text-body-lg text-ink-muted max-w-2xl mx-auto mt-4">
            Participating in StageZero is simple and straightforward.
          </p>
        </div>
        <div ref={timelineRef} className="relative">
          {/* Connecting line (desktop only) */}
          <motion.div
            className="hidden md:block absolute top-8 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-accent/40 via-accent-secondary/40 to-accent-tertiary/40"
            initial={{ scaleX: 0 }}
            animate={timelineInView ? { scaleX: 1 } : { scaleX: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
            style={{ transformOrigin: 'left' }}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: 1,
                title: 'Connect Wallet',
                description: 'Link your wallet to access StageZero and all launchpad features.',
                icon: Wallet,
                floatDuration: 3,
              },
              {
                step: 2,
                title: 'Explore Projects',
                description:
                  'Browse live and upcoming IDOs. Review project details, tokenomics, and team information.',
                icon: Search,
                floatDuration: 3.5,
              },
              {
                step: 3,
                title: 'Participate & Build',
                description:
                  'Contribute to presales you believe in and claim your tokens when the sale finalizes.',
                icon: CheckCircle2,
                floatDuration: 4,
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{
                  duration: 0.7,
                  delay: index * 0.15,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <div className="text-center space-y-4">
                  <div className="relative mx-auto w-16 h-16">
                    {/* Expanding halo */}
                    {!reducedMotion && (
                      <motion.div
                        className="absolute inset-0 rounded-full bg-accent/20"
                        initial={{ scale: 1, opacity: 0.6 }}
                        whileInView={{ scale: 2.5, opacity: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.5, delay: 0.5 + index * 0.15, ease: 'easeOut' }}
                      />
                    )}
                    {/* Floating icon */}
                    <motion.div
                      className="w-16 h-16 rounded-full bg-accent-muted text-accent flex items-center justify-center icon-surreal relative z-10"
                      animate={
                        reducedMotion
                          ? {}
                          : { y: [0, -6, 0] }
                      }
                      transition={
                        reducedMotion
                          ? {}
                          : {
                            duration: item.floatDuration,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }
                      }
                    >
                      <item.icon className="w-7 h-7" />
                    </motion.div>
                  </div>
                  <h3 className="font-display text-display-sm text-ink">{item.title}</h3>
                  <p className="text-body text-ink-muted">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ─── Creator Tools — Bento Grid ─── */}
      <motion.section variants={itemVariants} className="space-y-6">
        <div className="space-y-2">
          <p className="text-label text-ink-faint uppercase tracking-wider">For Builders</p>
          <h2 className="font-display text-display-md text-ink">Creator Tools</h2>
          <p className="text-body text-ink-muted max-w-2xl">
            Everything you need to deploy tokens, run airdrops, lock liquidity, and manage your onchain
            presence — all in one place.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {creatorTools.map((tool) => (
            <motion.div
              key={tool.href}
              whileHover={reducedMotion ? {} : { scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <Link
                to={tool.href}
                className="glass-card rounded-2xl p-5 flex flex-col gap-3 h-full group transition-colors duration-300 hover:border-accent/30"
              >
                <div className="w-10 h-10 rounded-xl bg-accent-muted text-accent flex items-center justify-center transition-shadow duration-500 group-hover:shadow-[0_0_20px_rgba(255,138,0,0.25)]">
                  <tool.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-display text-sm text-ink">{tool.title}</p>
                  <p className="text-xs text-ink-muted mt-0.5">{tool.description}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ─── CTA Banner — Animated Depth ─── */}
      <motion.section
        variants={itemVariants}
        initial={{ opacity: 0, scale: 0.95, filter: 'blur(8px)' }}
        whileInView={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="relative overflow-hidden rounded-3xl border border-border bg-canvas-alt p-8 md:p-12">
          <motion.div
            className="absolute inset-0 opacity-35 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,138,0,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(59,130,246,0.1) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
              maskImage: 'radial-gradient(circle at center, black 30%, transparent 90%)',
              x: reducedMotion ? 0 : ctaGridX,
              y: reducedMotion ? 0 : ctaGridY,
            }}
          />
          {/* Animated gradient orbs */}
          <motion.div
            className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-accent/20 blur-[80px] pointer-events-none"
            animate={
              reducedMotion
                ? {}
                : {
                  x: [0, 30, -10, 0],
                  y: [0, -20, 15, 0],
                  scale: [1, 1.1, 0.95, 1],
                }
            }
            transition={
              reducedMotion
                ? {}
                : { duration: 10, repeat: Infinity, ease: 'easeInOut' }
            }
          />
          <motion.div
            className="absolute -left-24 -bottom-24 h-88 w-88 rounded-full bg-accent-secondary/20 blur-[100px] pointer-events-none"
            animate={
              reducedMotion
                ? {}
                : {
                  x: [0, -20, 25, 0],
                  y: [0, 15, -10, 0],
                  scale: [1, 0.9, 1.15, 1],
                }
            }
            transition={
              reducedMotion
                ? {}
                : { duration: 13, repeat: Infinity, ease: 'easeInOut' }
            }
          />
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-nebula/15 blur-[80px] pointer-events-none"
            animate={
              reducedMotion
                ? {}
                : {
                  x: [0, 15, -15, 0],
                  y: [0, -10, 20, 0],
                  scale: [1, 1.08, 0.92, 1],
                }
            }
            transition={
              reducedMotion
                ? {}
                : { duration: 15, repeat: Infinity, ease: 'easeInOut' }
            }
          />

          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="space-y-4 max-w-xl">
              <p className="text-label text-accent-secondary uppercase tracking-[0.18em]">
                Tier Access Engine
              </p>
              <h3 className="font-display text-display-md text-ink">
                Stake on StageZero to unlock
                <br />
                <span className="text-accent-secondary">exclusive allocations</span>
              </h3>
              <p className="text-body text-ink-muted">
                Higher tier levels unlock guaranteed allocations and priority access to the most
                anticipated launches on StageZero.
              </p>
              <Link to="/staking" className="btn-primary">
                Start Staking
              </Link>
            </div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
};

/* ─── PresaleCard with 3D Tilt ─── */

const PresaleCard: React.FC<{
  children: React.ReactNode;
  index: number;
  reducedMotion: boolean;
}> = ({ children, index, reducedMotion }) => {
  const tilt = useTiltCard(10);

  return (
    <motion.div
      ref={tilt.ref}
      variants={itemVariants}
      custom={index}
      style={{
        rotateX: reducedMotion ? 0 : tilt.springX,
        rotateY: reducedMotion ? 0 : tilt.springY,
        transformPerspective: 800,
      }}
      onMouseMove={reducedMotion ? undefined : tilt.handleMouseMove}
      onMouseLeave={reducedMotion ? undefined : tilt.handleMouseLeave}
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
    <div ref={ref} className="w-full h-2 bg-ink/5 rounded-full overflow-hidden relative">
      <motion.div
        className="h-full bg-accent rounded-full relative progress-glow-trail"
        initial={{ width: 0 }}
        animate={isInView ? { width: `${progress}%` } : { width: 0 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      />
    </div>
  );
};

export default HomePage;
