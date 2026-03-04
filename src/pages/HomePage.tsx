import CountUp from '@/components/ui/CountUp';
import { useLaunchpadPresales } from '@/lib/hooks/useLaunchpadPresales';
import { projects } from '@/lib/projects';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  Rocket,
  Search,
  TrendingUp,
  Users,
  Wallet,
  Wrench
} from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import { formatUnits } from 'viem';
import { useAccount } from 'wagmi';

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

const HomePage: React.FC = () => {
  const { openConnectModal } = useConnectModal();
  const { isConnected } = useAccount();
  const { presales } = useLaunchpadPresales('all');

  const livePresales = presales.filter((p) => p.status === 'live');
  const upcomingPresales = presales.filter((p) => p.status === 'upcoming');
  const featuredPresales = [...livePresales, ...upcomingPresales].slice(0, 3);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-20"
    >
      {/* Hero Section */}
      <motion.section variants={itemVariants} className="text-center pt-8 md:pt-16">
        <div className="relative max-w-4xl mx-auto space-y-6">
          <span className="ghost-numeral -top-20 left-1/2 -translate-x-1/2" aria-hidden="true">0</span>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-ink leading-tight text-engraved">
            Community Driven Launches on{' '}
            <span style={{ color: '#8B7CFF' }}>Rise</span> Chain
          </h1>
          <p className="text-base sm:text-lg text-ink-muted max-w-2xl mx-auto">
            Stage0 is a premium launchpad for high-conviction onchain projects. Discover promising
            teams, join fair launches, and ship faster with integrated creator tooling.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/presales" className="btn-primary inline-flex items-center gap-2">
              <Rocket className="w-4 h-4" />
              Explore IDOs
            </Link>
            {!isConnected && (
              <button
                onClick={openConnectModal}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </motion.section>

      {/* Stats Section */}
      <motion.section variants={itemVariants}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="ambient-stat-card ambient-stat-card--orange text-center relative">
            <span className="ghost-numeral -top-8 -right-4 text-[8rem]" aria-hidden="true">$</span>
            <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-500 ring-1 ring-blue-500/30 active:ring-blue-500/60 mx-auto flex items-center justify-center mb-4 transition-all">
              <TrendingUp className="w-6 h-6" />
            </div>
            <p className="font-display text-display-md text-ink">
              <CountUp to={2.4} durationMs={2200} decimals={1} prefix="$" suffix="M+" />
            </p>
            <p className="text-body text-ink-muted mt-1">Total Raised</p>
          </div>
          <div className="ambient-stat-card ambient-stat-card--blue text-center relative">
            <span className="ghost-numeral -top-8 -right-4 text-[8rem]" aria-hidden="true">#</span>
            <div className="w-12 h-12 rounded-2xl bg-green-500/15 text-green-500 ring-1 ring-green-500/30 active:ring-green-500/60 mx-auto flex items-center justify-center mb-4 transition-all">
              <Rocket className="w-6 h-6" />
            </div>
            <p className="font-display text-display-md text-ink">
              <CountUp to={12} durationMs={1800} />
            </p>
            <p className="text-body text-ink-muted mt-1">Projects Launched</p>
          </div>
          <div className="ambient-stat-card ambient-stat-card--purple text-center relative">
            <span className="ghost-numeral -top-8 -right-4 text-[8rem]" aria-hidden="true">+</span>
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 text-purple-500 ring-1 ring-purple-500/30 active:ring-purple-500/60 mx-auto flex items-center justify-center mb-4 transition-all">
              <Users className="w-6 h-6" />
            </div>
            <p className="font-display text-display-md text-ink">
              <CountUp to={3200} durationMs={2400} suffix="+" />
            </p>
            <p className="text-body text-ink-muted mt-1">Active Participants</p>
          </div>
        </div>
      </motion.section>

      {/* Featured Presales */}
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
              <motion.div key={presale.address} variants={itemVariants} custom={index}>
                <Link to={`/presales/${presale.address}`}>
                  <div className="project-card rounded-3xl p-6 space-y-4">
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
                      <div className="w-full h-2 bg-ink/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all duration-500"
                          style={{ width: `${presale.progress}%` }}
                        />
                      </div>
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
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects
              .filter((p) => p.status === 'Live' || p.status === 'Upcoming')
              .slice(0, 3)
              .map((item, index) => (
                <motion.div key={item.id} variants={itemVariants} custom={index}>
                  <Link to={`/project/${item.address}`}>
                    <div className="project-card rounded-3xl p-6 space-y-4">
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
                        <div className="w-full h-2 bg-ink/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full transition-all duration-500"
                            style={{ width: `${item.raisePercentage}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-body-sm text-ink-muted">
                          <span>{item.raised}</span>
                          <span>{item.targetRaise}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
          </div>
        )}
      </motion.section>

      {/* How it Works */}
      <motion.section variants={itemVariants} className="space-y-12">
        <div className="text-center">
          <h2 className="font-display text-display-md text-ink">How It Works</h2>
          <p className="text-body-lg text-ink-muted max-w-2xl mx-auto mt-4">
            Participating in Stage0 is simple and straightforward.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: 1,
              title: 'Connect Wallet',
              description: 'Link your wallet to access Stage0 and all launchpad features.',
              icon: Wallet,
            },
            {
              step: 2,
              title: 'Explore Projects',
              description:
                'Browse live and upcoming IDOs. Review project details, tokenomics, and team information.',
              icon: Search,
            },
            {
              step: 3,
              title: 'Participate & Build',
              description:
                'Contribute to presales you believe in and claim your tokens when the sale finalizes.',
              icon: CheckCircle2,
            },
          ].map((item, index) => (
            <motion.div key={index} variants={itemVariants} custom={index}>
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-accent-muted text-accent mx-auto flex items-center justify-center icon-surreal">
                  <item.icon className="w-7 h-7" />
                </div>
                <h3 className="font-display text-display-sm text-ink">{item.title}</h3>
                <p className="text-body text-ink-muted">{item.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Creator Tools */}
      <motion.section variants={itemVariants} className="space-y-6">
        <div className="space-y-2">
          <p className="text-label text-ink-faint uppercase tracking-wider">For Builders</p>
          <h2 className="font-display text-display-md text-ink">Creator Tools</h2>
          <p className="text-body text-ink-muted max-w-2xl">
            Everything you need to deploy tokens, run airdrops, lock liquidity, and manage your onchain presence — all in one place.
          </p>
        </div>
        <Link to="/tools" className="glass-card rounded-3xl p-6 group flex items-center justify-between w-full transition-colors duration-300 hover:border-accent/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-accent-muted text-accent flex items-center justify-center">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <p className="font-display text-display-sm text-ink">Open Creator Tools</p>
              <p className="text-body-sm text-ink-muted">Tokens, locks, airdrops, and more</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-ink-muted group-hover:text-ink transition-colors duration-300" />
        </Link>
      </motion.section>

      {/* CTA Banner */}
      <motion.section variants={itemVariants}>
        <div className="relative overflow-hidden rounded-3xl border border-border bg-canvas-alt p-8 md:p-12">
          <div
            className="absolute inset-0 opacity-35 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,138,0,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(59,130,246,0.1) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
              maskImage: 'radial-gradient(circle at center, black 30%, transparent 90%)',
            }}
          />
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-accent/20 blur-[80px] pointer-events-none" />
          <div className="absolute -left-24 -bottom-24 h-88 w-88 rounded-full bg-accent-secondary/20 blur-[100px] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-nebula/15 blur-[80px] pointer-events-none" />

          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="space-y-4 max-w-xl">
              <p className="text-label text-accent-secondary uppercase tracking-[0.18em]">Tier Access Engine</p>
              <h3 className="font-display text-display-md text-ink">
                Stake on Stage0 to unlock
                <br />
                <span className="text-accent-secondary">exclusive allocations</span>
              </h3>
              <p className="text-body text-ink-muted">
                Higher tier levels unlock guaranteed allocations and priority access to the most
                anticipated launches on Stage0.
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

export default HomePage;
