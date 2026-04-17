import ProjectCard from '@/components/ProjectCard';
import stage0Logo from '@/assets/STAGE0.png';
import { motion } from 'framer-motion';
import { Rocket, Zap, Shield } from 'lucide-react';
import React from 'react';

const projects = [
  {
    id: '1',
    name: 'Nexus Protocol',
    logo: stage0Logo,
    status: 'Live' as const,
    raisePercentage: 75,
    description: 'Cross-chain liquidity aggregation protocol enabling seamless DeFi interoperability.',
    tokenSymbol: 'NXS',
    targetRaise: '$750,000',
  },
  {
    id: '2',
    name: 'Quantum Vault',
    logo: stage0Logo,
    status: 'Upcoming' as const,
    raisePercentage: 0,
    description: 'Next-generation yield optimization with quantum-resistant security architecture.',
    tokenSymbol: 'QVT',
    targetRaise: '$1,200,000',
  },
  {
    id: '3',
    name: 'Aether Finance',
    logo: stage0Logo,
    status: 'Closed' as const,
    raisePercentage: 100,
    description: 'Decentralized derivatives trading platform with advanced risk management.',
    tokenSymbol: 'AETH',
    targetRaise: '$500,000',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

const LandingPage: React.FC = () => {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-16"
    >
      {/* Hero Section */}
      <motion.section variants={itemVariants} className="text-center">
        <h1 className="font-display text-display-xl text-ink">
          The Future of Community-Driven Launches
        </h1>
        <p className="text-body-lg text-ink-muted max-w-3xl mx-auto mt-4">
          Stage0 is a premium launchpad and onchain tooling suite for teams shipping serious token and NFT launches.
        </p>
      </motion.section>

      {/* How it Works Section */}
      <motion.section variants={itemVariants} className="space-y-12">
        <div className="text-center">
          <h2 className="font-display text-display-md text-ink">Get Started in Minutes</h2>
          <p className="text-body-lg text-ink-muted max-w-2xl mx-auto mt-4">
            Joining Stage0 is simple. Here's how you can get started.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-accent-muted text-accent mx-auto flex items-center justify-center">
              <span className="font-display text-display-sm">1</span>
            </div>
            <h3 className="font-display text-display-sm text-ink">Connect Your Wallet</h3>
            <p className="text-body text-ink-muted">
              Connect your wallet to Stage0 to get started.
            </p>
          </div>
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-accent-muted text-accent mx-auto flex items-center justify-center">
              <span className="font-display text-display-sm">2</span>
            </div>
            <h3 className="font-display text-display-sm text-ink">Explore Projects</h3>
            <p className="text-body text-ink-muted">
              Browse upcoming Launches and find the next big thing.
            </p>
          </div>
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-accent-muted text-accent mx-auto flex items-center justify-center">
              <span className="font-display text-display-sm">3</span>
            </div>
            <h3 className="font-display text-display-sm text-ink">Participate & Build</h3>
            <p className="text-body text-ink-muted">
              Participate in Launches, stake your tokens, or build your own project with our tools.
            </p>
          </div>
        </div>
      </motion.section>

      {/* Projects Section */}
      <motion.section variants={itemVariants} className="space-y-8">
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <p className="text-label text-ink-faint uppercase tracking-wider">
              Active Raises
            </p>
            <h2 className="font-display text-display-md text-ink">
              Upcoming Launches
            </h2>
          </div>
          <button className="btn-ghost">
            View All
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, index) => (
            <motion.div
              key={project.id}
              variants={itemVariants}
              custom={index}
            >
              <ProjectCard {...project} />
            </motion.div>
          ))}
        </div>
      </motion.section>



      {/* Featured Banner */}
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
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
          <div className="absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-accent-secondary/20 blur-3xl pointer-events-none" />

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
                anticipated launches.
              </p>
              <button className="btn-primary">
                Start Staking
              </button>
            </div>

            <div className="w-full lg:w-auto grid grid-cols-3 gap-3">
              {[
                { label: 'Shielded', Icon: Shield },
                { label: 'Fastlane', Icon: Zap },
                { label: 'Launch', Icon: Rocket },
              ].map(({ label, Icon }, index) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.08, duration: 0.45 }}
                  className="min-w-[110px] rounded-2xl border border-border bg-canvas/70 px-4 py-4 text-center"
                >
                  <Icon className="w-5 h-5 mx-auto text-accent mb-2" />
                  <p className="text-body-sm text-ink">{label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
};

export default LandingPage;
