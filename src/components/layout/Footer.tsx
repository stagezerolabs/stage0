import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Discord, NewTwitter } from '@/components/ui/icons';

type FooterProps = {
  themeMode: 'dark' | 'light';
};

const Footer: React.FC<FooterProps> = ({ themeMode }) => {
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    { label: 'Documentation', href: 'https://stagezerolabs.gitbook.io/stagezero-docs/' },
    { label: 'Terms', href: 'https://stagezerolabs.gitbook.io/stagezero-docs/platform/terms-of-service' },
    { label: 'Privacy', href: 'https://stagezerolabs.gitbook.io/stagezero-docs/platform/privacy-policy' },
  ];

  const socialLinks = [
    {
      label: 'X',
      href: 'https://x.com/stage0_',
      icon: <NewTwitter className="w-4 h-4" />,
    },
    {
      label: 'Discord',
      href: 'https://discord.gg/jkPT89fA8d',
      icon: <Discord className="w-4 h-4" />,
    },
  ];

  return (
    <footer className="relative mt-auto border-t border-border/30 bg-canvas/40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-5 sm:gap-8">
          {/* Logo & Copyright */}
          <div className="flex flex-col items-center md:items-start gap-2 sm:gap-4">
            <Link to="/" className="footer-wordmark" aria-label="Stage0 home">
              <img
                src={
                  themeMode === 'dark'
                    ? 'https://res.cloudinary.com/dma1c8i6n/image/upload/v1774875763/STAGE0_white_green_vilwwf.png'
                    : 'https://res.cloudinary.com/dma1c8i6n/image/upload/v1774875763/STAGE0_black_orange_wiqr1i.png'
                }
                alt="STAGE0"
                className="h-full w-full object-contain"
              />
            </Link>
            <p className="text-[11px] sm:text-body-sm text-ink-faint text-center md:text-left">
              {currentYear} Stage0 Labs. All rights reserved.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:gap-8">
            {footerLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-[12px] sm:text-body-sm text-ink-muted hover:text-ink transition-colors duration-300 link-underline"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Social */}
          <div className="flex items-center gap-3 sm:gap-4">
            {socialLinks.map((social) => (
              <motion.a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-canvas-alt text-ink-muted hover:bg-ink hover:text-canvas hover:shadow-glow-orange transition-all duration-300"
                aria-label={social.label}
              >
                {social.icon}
              </motion.a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
