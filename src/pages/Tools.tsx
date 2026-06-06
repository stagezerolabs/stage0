import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { DollarSign, Lock, Sliders, Send, Image as ImageIcon } from '@/components/ui/icons';
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

const tools: Array<{
  title: string;
  description: string;
  icon: React.FC<{ className?: string }>;
  href: string;
}> = [
  {
    title: 'Create an NFT',
    description: 'Deploy and manage NFT collections with whitelist and public mint support.',
    icon: ImageIcon,
    href: '/create/nft',
  },
  {
    title: 'Token Launch',
    description: 'Run presales and fair launches with flexible configurations.',
    icon: Sliders,
    href: '/create/presale',
  },
  {
    title: 'Create Token',
    description: 'Deploy a token contract with custom supply and parameters.',
    icon: DollarSign,
    href: '/create/token',
  },
  {
    title: 'Locker',
    description: 'Lock tokens or liquidity to secure assets onchain.',
    icon: Lock,
    href: '/tools/token-locker',
  },
  {
    title: 'Distribution',
    description: 'Send tokens to multiple wallets in a single transaction.',
    icon: Send,
    href: '/tools/airdrop',
  },
];

const Tools: React.FC = () => {
  const reducedMotion = useReducedMotion();
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    if (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light') {
      return 'light';
    }
    return 'dark';
  });
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shouldDisableAnimations = reducedMotion || prefersReducedMotion;

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          const newTheme = document.documentElement.dataset.theme as 'dark' | 'light';
          if (newTheme) {
            setThemeMode(newTheme);
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-16 max-w-6xl mx-auto"
    >
      {/* Header */}
      <motion.section variants={itemVariants} className="space-y-3 text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-canvas-alt/80 border border-border/70 text-xs font-semibold uppercase tracking-widest text-ink-muted">
          For Builders
        </div>
        <h1 className="font-display text-3xl md:text-5xl text-ink">Creator Suite</h1>
        <p className="text-lg text-ink-muted max-w-2xl">
          Create tokens, run fair launches, deploy NFTs, distribute and lock assets in one place.
        </p>
      </motion.section>

      {/* Bento Layout */}
      <motion.section variants={itemVariants} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6 auto-rows-[220px]">
          {tools.map((tool, idx) => {
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
            const IconComponent = tool.icon;

            return (
              <motion.div
                key={tool.href}
                className={`relative overflow-hidden rounded-3xl group border border-border/70 bg-canvas-alt min-h-[220px] transition-all duration-500 ${layoutClasses[idx]} ${offsetClasses[idx]} ${
                  themeMode === 'light' ? 'hover:border-purple-500' : 'hover:border-amber-700'
                }`}
                whileHover={shouldDisableAnimations ? {} : { scale: 0.99 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <Link to={tool.href} className="block w-full h-full relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/60 to-transparent opacity-90 transition-opacity duration-300 group-hover:opacity-100" />

                  <div
                    className={`absolute inset-x-0 bottom-0 flex flex-col justify-end ${
                      isFeatureCard ? 'p-10 md:p-12' : 'p-7 md:p-8'
                    }`}
                  >
                    <div
                      className={`w-14 h-14 rounded-2xl bg-canvas-alt text-accent flex items-center justify-center transition-all duration-300 group-hover:bg-accent group-hover:text-white shadow-[0_0_20px_rgba(255,138,0,0)] group-hover:shadow-[0_0_30px_rgba(255,138,0,0.3)] ${
                        isFeatureCard ? 'mb-7' : 'mb-5'
                      }`}
                    >
                      <IconComponent className="w-7 h-7" />
                    </div>
                    <h3
                      className={`font-display font-bold text-ink mb-2 ${
                        isFeatureCard ? 'text-3xl md:text-4xl' : 'text-2xl'
                      }`}
                    >
                      {tool.title}
                    </h3>
                    <p className="text-sm font-medium text-ink-muted/90 max-w-sm">
                      {tool.description}
                    </p>
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
