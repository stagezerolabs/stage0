import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Globe, Lock, Sliders, Send, Image, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import type { Address } from 'viem';
import { useIsAdmin } from '@/lib/utils/admin';

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
  hidden: { opacity: 0, y: 40, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 1,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, filter: 'blur(3px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

const tools: Array<{
  id: string;
  title: string;
  description: string;
  icon: typeof Globe;
  href: string;
  bgColor: string;
  textColor: string;
  iconBg: string;
  enabledForAll?: boolean;
}> = [
    {
      id: 'nft',
      title: 'Create an NFT',
      description: 'Deploy and manage NFT collections onchain.',
      icon: Image,
      href: '/create/nft',
      bgColor: 'bg-canvas-alt',
      textColor: 'text-ink',
      iconBg: 'bg-ink/10',
      enabledForAll: true,
    },
    {
      id: 'domains',
      title: 'Mint a Name',
      description: 'Claim a .rise name.',
      icon: Globe,
      href: '/domains',
      bgColor: 'bg-canvas-alt',
      textColor: 'text-ink',
      iconBg: 'bg-ink/10',
      enabledForAll: true,
    },
    {
      id: 'createToken',
      title: 'Create a Token',
      description: 'Deploy a standard, mintable, burnable, or taxable ERC20 token.',
      icon: DollarSign,
      href: '/create/token',
      bgColor: 'bg-canvas-alt',
      textColor: 'text-ink',
      iconBg: 'bg-ink/10',
    },
    {
      id: 'createPresale',
      title: 'Create Launch',
      description: 'Launch your token sale with configurable onchain parameters.',
      icon: Sliders,
      href: '/create/presale',
      bgColor: 'bg-canvas-alt',
      textColor: 'text-ink',
      iconBg: 'bg-ink/10',
    },
    {
      id: 'tokenLocker',
      title: 'Locker',
      description: 'Lock token and liquidity.',
      icon: Lock,
      href: '/tools/token-locker',
      bgColor: 'bg-canvas-alt',
      textColor: 'text-ink',
      iconBg: 'bg-ink/10',
    },
    {
      id: 'airdrop',
      title: 'Airdrop / Multi-Send',
      description: 'Send tokens or native currency to multiple addresses at once.',
      icon: Send,
      href: '/tools/airdrop',
      bgColor: 'bg-canvas-alt',
      textColor: 'text-ink',
      iconBg: 'bg-ink/10',
    },
  ];

const Tools: React.FC = () => {
  const { address } = useAccount();
  const { isAdmin } = useIsAdmin(address as Address | undefined);

  // Group tools into active (live) and upcoming (coming soon) categories
  const activeTools = tools.filter((t) => t.id === 'nft' || t.id === 'domains');
  const comingSoonTools = tools.filter((t) => t.id !== 'nft' && t.id !== 'domains');

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-16 max-w-6xl mx-auto"
    >
      {/* Header */}
      <motion.section variants={itemVariants} className="space-y-3 text-left">
        <h1 className="font-display text-display-lg text-ink">
          Create & Manage
        </h1>
        <p className="text-body-lg text-ink-muted max-w-2xl">
          Deploy premium NFT collections and claim your unique RNS domain name natively on RISE Testnet.
        </p>
      </motion.section>

      {/* Active Tools Section */}
      <motion.section variants={itemVariants} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {activeTools.map((tool) => {
            const IconComponent = tool.icon;
            const isNft = tool.id === 'nft';

            return (
              <motion.div key={tool.id} variants={cardVariants} className="h-full">
                <Link
                  to={tool.href}
                  className={`${tool.bgColor} ${tool.textColor} rounded-3xl border border-accent/40 hover:border-accent hover:ring-1 hover:ring-accent/40 p-8 md:p-10 text-left relative overflow-hidden group transition-all duration-500 backdrop-blur-md shadow-float hover:shadow-float-hover hover:-translate-y-2 flex flex-col justify-between h-full`}
                >
                  {/* Atmospheric Glow Backdrops */}
                  <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/15 blur-2xl pointer-events-none" />
                  <div className="absolute -left-10 -bottom-10 h-36 w-36 rounded-full bg-accent-secondary/10 blur-3xl pointer-events-none" />

                  <div className="relative flex flex-col justify-between h-full z-10">
                    <div>
                      <div className={`${tool.iconBg} w-14 h-14 rounded-full flex items-center justify-center mb-6 group-hover:bg-accent/20 group-hover:text-accent transition-colors`}>
                        <IconComponent className="w-7 h-7" />
                      </div>
                      <h3 className="font-display text-3xl font-semibold mb-3 group-hover:text-accent transition-colors">
                        {tool.title}
                      </h3>
                      <p className="text-body opacity-80 mb-8 max-w-md">
                        {tool.description}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 text-body-sm font-medium text-ink group-hover:text-accent transition-colors">
                      Open Tool <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* Coming Soon Section */}
      <motion.section variants={itemVariants} className="space-y-6">
        <h2 className="font-display text-display-sm text-ink">
          {isAdmin ? 'Creator Tools (Admin Access)' : 'Coming Soon'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {comingSoonTools.map((tool) => {
            const IconComponent = tool.icon;
            const isEnabled = isAdmin || Boolean(tool.enabledForAll);

            if (isEnabled) {
              return (
                <motion.div key={tool.id} variants={cardVariants}>
                  <Link
                    to={tool.href}
                    className={`${tool.bgColor} ${tool.textColor} rounded-3xl border border-border p-6 md:p-8 text-left relative overflow-hidden group transition-all duration-500 backdrop-blur-md shadow-float hover:shadow-float-hover hover:-translate-y-2 hover:border-accent hover:ring-1 hover:ring-accent/30 block`}
                  >
                    <div className={`${tool.iconBg} w-12 h-12 rounded-full flex items-center justify-center mb-4 group-hover:bg-accent/20 group-hover:text-accent transition-colors`}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <h3 className="font-display text-display-sm font-semibold mb-2 group-hover:text-accent transition-colors">
                      {tool.title}
                    </h3>
                    <p className="text-body-sm opacity-80 mb-6">
                      {tool.description}
                    </p>
                    <div className="absolute bottom-6 right-6">
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                    </div>
                  </Link>
                </motion.div>
              );
            }

            return (
              <motion.div key={tool.id} variants={cardVariants}>
                <div
                  aria-disabled="true"
                  className={`${tool.bgColor} ${tool.textColor} rounded-3xl border border-border p-6 md:p-8 text-left relative overflow-hidden backdrop-blur-md shadow-float opacity-50 grayscale select-none cursor-not-allowed`}
                >
                  <div className="absolute top-4 right-4 text-[10px] font-semibold tracking-[0.1em] uppercase px-2 py-1 rounded-full bg-ink/10 text-ink-muted">
                    Soon
                  </div>
                  <div className={`${tool.iconBg} w-12 h-12 rounded-full flex items-center justify-center mb-4`}>
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <h3 className="font-display text-display-sm font-semibold mb-2">
                    {tool.title}
                  </h3>
                  <p className="text-body-sm opacity-80 mb-6">
                    {tool.description}
                  </p>
                  <div className="absolute bottom-6 right-6">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.section>
    </motion.div>
  );
};

export default Tools;
