import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Lock, Sliders, Send, Image, ArrowRight, ShieldAlert } from 'lucide-react';
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

const tools = [
  {
    id: 'nft',
    title: 'Create an NFT',
    description: 'Deploy and manage NFT collections onchain.',
    icon: Image,
    href: '/create/nft',
    bgColor: 'bg-canvas-alt',
    textColor: 'text-ink',
    iconBg: 'bg-ink/10',
    adminOnly: false,
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
    adminOnly: true,
  },
  {
    id: 'createPresale',
    title: 'Create a Presale',
    description: 'Launch a presale for your token to raise funds from the community.',
    icon: Sliders,
    href: '/create/presale',
    bgColor: 'bg-canvas-alt',
    textColor: 'text-ink',
    iconBg: 'bg-ink/10',
    adminOnly: true,
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
    adminOnly: true,
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
    adminOnly: true,
  },
];

const Tools: React.FC = () => {
  const { address } = useAccount();
  const { isAdmin, isLoading: isCheckingAdmin } = useIsAdmin(address as Address | undefined);

  const featuredTool = tools[0];
  const adminOnlyTools = tools.filter((tool) => tool.adminOnly);
  const FeaturedIcon = featuredTool.icon;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-12"
    >
      {/* Header */}
      <motion.section variants={itemVariants} className="space-y-2">
        <h1 className="font-display text-display-lg text-ink">
          Create & Manage
        </h1>
        <p className="text-body-lg text-ink-muted max-w-2xl">
          NFT creation is currently open. Other tools are temporarily on hold for non-admin wallets.
        </p>
      </motion.section>

      {/* Featured NFT Tool */}
      <motion.section variants={itemVariants} className="space-y-6">
        <motion.div variants={cardVariants} className="max-w-4xl mx-auto">
          <Link
            to={featuredTool.href}
            className={`${featuredTool.bgColor} ${featuredTool.textColor} rounded-3xl border border-accent/40 p-8 md:p-10 text-left relative overflow-hidden group transition-all duration-500 backdrop-blur-md shadow-float hover:shadow-float-hover hover:-translate-y-2 hover:border-accent hover:ring-1 hover:ring-accent/40 block`}
          >
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/15 blur-2xl pointer-events-none" />
            <div className="absolute -left-10 -bottom-10 h-36 w-36 rounded-full bg-accent-secondary/10 blur-3xl pointer-events-none" />
            <div className="relative">
              <div className={`${featuredTool.iconBg} w-14 h-14 rounded-full flex items-center justify-center mb-5 group-hover:bg-accent/20 group-hover:text-accent transition-colors`}>
                <FeaturedIcon className="w-7 h-7" />
              </div>
              <p className="text-body-sm text-accent font-medium mb-2 uppercase tracking-[0.12em]">
                Primary Tool
              </p>
              <h3 className="font-display text-3xl md:text-4xl font-semibold mb-3 group-hover:text-accent transition-colors">
                {featuredTool.title}
              </h3>
              <p className="text-body opacity-80 max-w-2xl mb-8">
                {featuredTool.description}
              </p>
              <div className="inline-flex items-center gap-2 text-body-sm font-medium text-ink group-hover:text-accent transition-colors">
                Open Tool <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>
          </Link>
        </motion.div>
      </motion.section>

      {!isAdmin && !isCheckingAdmin && (
        <motion.section variants={itemVariants}>
          <div className="rounded-2xl border border-status-upcoming/30 bg-status-upcoming-bg p-4 md:p-5 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-status-upcoming mt-0.5" />
            <p className="text-body-sm text-status-upcoming">
              Create Token, Create Presale, Locker, and Airdrop tools are temporarily restricted to the admin wallet.
            </p>
          </div>
        </motion.section>
      )}

      {isAdmin && (
        <motion.section variants={itemVariants} className="space-y-4">
          <h2 className="font-display text-display-sm text-ink">Admin Wallet Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {adminOnlyTools.map((tool) => {
              const IconComponent = tool.icon;
              return (
                <motion.div key={tool.id} variants={cardVariants}>
                  <Link
                    to={tool.href}
                    className={`${tool.bgColor} ${tool.textColor} rounded-3xl border border-border p-6 md:p-8 text-left relative overflow-hidden group transition-all duration-500 backdrop-blur-md shadow-float hover:shadow-float-hover hover:-translate-y-2 hover:border-accent hover:ring-1 hover:ring-accent/30 block`}
                  >
                    <div className="absolute top-4 right-4 text-[10px] font-semibold tracking-[0.1em] uppercase px-2 py-1 rounded-full bg-accent/15 text-accent">
                      Admin
                    </div>
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
            })}
          </div>
        </motion.section>
      )}

    </motion.div>
  );
};

export default Tools;
