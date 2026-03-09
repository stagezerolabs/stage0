import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import CircularText from '../animated/CircularText';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    { label: 'Documentation', href: '#' },
    { label: 'Terms', href: '#' },
    { label: 'Privacy', href: '#' },
  ];

  const socialLinks = [
    {
      label: 'X',
      href: 'https://x.com/',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      label: 'Telegram',
      href: 'https://t.me/',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21.9 4.1a1.4 1.4 0 0 0-1.55-.27L2.9 11.3a1.4 1.4 0 0 0 .12 2.6l4.1 1.6 1.9 5.2a1.4 1.4 0 0 0 2.6.2l2.4-3.5 4.5 3.3a1.4 1.4 0 0 0 2.2-.8l3-13.4a1.4 1.4 0 0 0-.8-1.5ZM9.4 14.2l7.9-6.9-6.6 8.2-.3 3.4-1.6-4.1-3.6-1.3 12.7-5.1-8.5 6.1Z" />
        </svg>
      ),
    },
  ];

  return (
    <footer className="relative mt-auto border-t border-border/30 bg-void/40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          {/* Logo & Copyright */}
          <div className="flex flex-col items-center md:items-start gap-4">
            <Link to="/" className="inline-flex items-center">
              <CircularText
                text="STAGE*ZERO*"
                onHover="speedUp"
                spinDuration={20}
                className="scale-50 -ml-12 -mr-8"
              />
            </Link>
            <p className="text-body-sm text-ink-faint">
              {currentYear} StageZero Labs. All rights reserved.
            </p>
          </div>

          {/* Links */}
          <div className="flex items-center gap-8">
            {footerLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-body-sm text-ink-muted hover:text-ink transition-colors duration-300 link-underline"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Social */}
          <div className="flex items-center gap-4">
            {socialLinks.map((social) => (
              <motion.a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-canvas-alt text-ink-muted hover:bg-ink hover:text-canvas hover:shadow-glow-orange transition-all duration-300"
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
