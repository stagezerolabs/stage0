import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Lock, Sliders, Send, Image, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

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
    title: 'Create a Presale',
    description: 'Launch a presale for your token to raise funds from the community.',
    icon: Sliders,
    href: '/create/presale',
    bgColor: 'bg-canvas-alt',
    textColor: 'text-ink',
    iconBg: 'bg-ink/10',
  },
  {
    id: 'tokenLocker',
    title: 'Token Locker',
    description: 'Lock token liquidity to build trust with your community.',
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
  {
    id: 'nft',
    title: 'Create an NFT',
    description: 'Deploy and manage NFT collections onchain.',
    icon: Image,
    href: '/create/nft',
    bgColor: 'bg-canvas-alt',
    textColor: 'text-ink',
    iconBg: 'bg-ink/10',
  },
];

const Tools: React.FC = () => {
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
          Tools to launch tokens, create presales, deploy NFT collections, lock liquidity, and distribute assets.
        </p>
      </motion.section>

      {/* Tools Grid */}
      <motion.section variants={itemVariants} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tools.map((tool) => {
            const IconComponent = tool.icon;
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
          })}
        </div>
      </motion.section>


    </motion.div>
  );
};

export default Tools;
