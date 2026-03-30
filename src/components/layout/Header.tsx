import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useConnect, useConnectors } from 'wagmi';
import { AlertTriangle, Menu, Moon, Sun, Wallet, X } from 'lucide-react';
import { RISE_CONNECTOR_ID } from '@/config';
import { useIsAdmin } from '@/lib/utils/admin';
import type { Address } from 'viem';

type HeaderProps = {
  themeMode: 'dark' | 'light';
  onToggleTheme: () => void;
};

const Header: React.FC<HeaderProps> = ({ themeMode, onToggleTheme }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chainInfo, setChainInfo] = useState<{
    name?: string;
    iconUrl?: string;
    hasIcon?: boolean;
    unsupported?: boolean;
  } | null>(null);
  const openChainModalRef = useRef<(() => void) | null>(null);
  const openAccountModalRef = useRef<(() => void) | null>(null);
  const openConnectModalRef = useRef<(() => void) | null>(null);
  const location = useLocation();
  const { isConnected, address } = useAccount();
  const { isAdmin: isOwner } = useIsAdmin(address as Address | undefined);
  const { connect, isPending: isRiseConnectPending } = useConnect();
  const availableConnectors = useConnectors();
  const riseConnector = availableConnectors.find((connector) => connector.id === RISE_CONNECTOR_ID);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const publicNavItems = [
    { path: '/', label: 'Home' },
    { path: '/presales', label: 'Launchpad' },
  ];

  const privateNavItems = [
    { path: '/', label: 'Home' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/presales', label: 'Launchpad' },
    { path: '/tools', label: 'Tools' },
  ];

  const navItems = isConnected
    ? [
      ...privateNavItems,
      ...(isOwner ? [{ path: '/admin', label: 'Admin' }] : []),
    ]
    : publicNavItems;

  const handleMobileChainSwitch = useCallback(() => {
    setMobileMenuOpen(false);
    openChainModalRef.current?.();
  }, []);

  const handleMobileWalletAction = useCallback(() => {
    setMobileMenuOpen(false);
    if (isConnected) {
      openAccountModalRef.current?.();
      return;
    }
    openConnectModalRef.current?.();
  }, [isConnected]);

  const handleMobileThemeToggle = useCallback(() => {
    setMobileMenuOpen(false);
    onToggleTheme();
  }, [onToggleTheme]);

  const headerSurfaceClass = scrolled || themeMode === 'light'
    ? 'bg-canvas-alt/90 backdrop-blur-xl border-border'
    : 'bg-transparent';

  return (
    <header
      className={`sticky top-0 z-50 py-2 border-b border-transparent transition-colors duration-300 ${headerSurfaceClass}`}
    >
      <nav className="max-w-7xl mx-auto px-6 lg:px-8 flex justify-between items-center">
        {/* Logo */}
        <Link to="/" className="group inline-flex items-center">
          <img
            src={
              themeMode === 'dark'
                ? 'https://res.cloudinary.com/dma1c8i6n/image/upload/v1774875763/STAGE0_white_green_vilwwf.png'
                : 'https://res.cloudinary.com/dma1c8i6n/image/upload/v1774875763/STAGE0_black_orange_wiqr1i.png'
            }
            alt="STAGE0"
            className="h-[70px] w-auto"
          />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="relative px-4 py-2 text-body-sm font-medium transition-colors duration-300"
            >
              <span
                className={`relative z-10 ${location.pathname === item.path || location.pathname.startsWith(item.path + '/')
                  ? 'text-ink'
                  : 'text-ink-muted hover:text-ink'
                  }`}
              >
                {item.label}
              </span>
              <AnimatePresence>
                {(location.pathname === item.path || location.pathname.startsWith(item.path + '/')) && (
                  <motion.div
                    layoutId="nav-indicator"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 bg-canvas-alt rounded-lg"
                  />
                )}
              </AnimatePresence>
            </Link>
          ))}
        </div>

        {/* Right side: Theme + Connect + Mobile menu button */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleTheme}
            className={`hidden md:inline-flex btn-ghost p-2 ${themeMode === 'dark' ? 'hover:text-[#FF8A00]' : 'hover:text-[#04DF83]'}`}
            aria-label={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {themeMode === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              mounted,
            }) => {
              const ready = mounted;
              const connected = ready && account && chain;

              // Store chain modal opener and info for mobile menu
              openChainModalRef.current = openChainModal;
              openAccountModalRef.current = openAccountModal;
              openConnectModalRef.current = openConnectModal;
              if (connected) {
                const info = {
                  name: chain.name,
                  iconUrl: chain.iconUrl,
                  hasIcon: chain.hasIcon,
                  unsupported: chain.unsupported,
                };
                // Only update if changed to avoid infinite re-renders
                if (
                  chainInfo?.name !== info.name ||
                  chainInfo?.unsupported !== info.unsupported ||
                  chainInfo?.iconUrl !== info.iconUrl
                ) {
                  queueMicrotask(() => setChainInfo(info));
                }
              } else if (chainInfo !== null) {
                queueMicrotask(() => setChainInfo(null));
              }

              return (
                <div
                  {...(!ready && {
                    'aria-hidden': true,
                    style: {
                      opacity: 0,
                      pointerEvents: 'none' as const,
                      userSelect: 'none' as const,
                    },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <>
                          <button
                            onClick={openConnectModal}
                            className="hidden md:inline-flex btn-primary"
                          >
                            Connect
                          </button>
                          <button
                            onClick={openConnectModal}
                            className="md:hidden btn-ghost p-2"
                            aria-label="Connect wallet"
                            title="Connect wallet"
                          >
                            <Wallet className="w-4 h-4" />
                          </button>
                        </>
                      );
                    }

                    if (chain.unsupported) {
                      return (
                        <>
                          <button
                            onClick={openChainModal}
                            className="hidden md:inline-flex btn-secondary text-status-error border-status-error"
                          >
                            Wrong network
                          </button>
                          <button
                            onClick={openChainModal}
                            className="md:hidden btn-ghost p-2 text-status-error"
                            aria-label="Wrong network. Switch network"
                            title="Switch network"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                        </>
                      );
                    }

                    return (
                      <div className="flex items-center gap-2">
                        <div className="hidden md:flex items-center gap-2">
                          <button
                            onClick={openChainModal}
                            className="btn-ghost flex items-center gap-2"
                          >
                            {chain.hasIcon && chain.iconUrl && (
                              <img
                                alt={chain.name ?? 'Chain icon'}
                                src={chain.iconUrl}
                                className="w-4 h-4 rounded-full"
                              />
                            )}
                            <span className="hidden sm:inline text-body-sm">{chain.name}</span>
                          </button>

                          <button
                            onClick={openAccountModal}
                            className="btn-primary"
                          >
                            <span className="font-mono text-body-sm">
                              {account.displayName}
                            </span>
                          </button>
                        </div>

                        <button
                          onClick={openAccountModal}
                          className="md:hidden btn-ghost p-2"
                          aria-label="Open wallet menu"
                          title="Wallet"
                        >
                          <Wallet className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            }}
          </ConnectButton.Custom>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden btn-ghost p-2"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="md:hidden overflow-hidden border-b border-border bg-canvas-alt/95 backdrop-blur-xl"
          >
            <div className="max-w-7xl mx-auto px-6 py-4 space-y-1">
              <button
                onClick={handleMobileThemeToggle}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-body font-medium text-ink-muted hover:bg-canvas/40 transition-colors duration-200 ${themeMode === 'dark' ? 'hover:text-[#FF8A00]' : 'hover:text-[#04DF83]'}`}
              >
                {themeMode === 'dark' ? (
                  <>
                    <Sun className="w-5 h-5" />
                    Switch to Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="w-5 h-5" />
                    Switch to Dark Mode
                  </>
                )}
              </button>

              <button
                onClick={handleMobileWalletAction}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-body font-medium text-ink-muted hover:text-ink hover:bg-canvas/40 transition-colors duration-200"
              >
                <Wallet className="w-5 h-5" />
                {isConnected ? 'Wallet' : 'Connect Wallet'}
              </button>

              {!isConnected && riseConnector && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    connect({ connector: riseConnector });
                  }}
                  disabled={isRiseConnectPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-body font-medium text-accent-secondary border border-accent-secondary/40 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isRiseConnectPending ? 'Connecting...' : 'Connect RISE Passkey'}
                </button>
              )}

              {isConnected && chainInfo && (
                <button
                  onClick={handleMobileChainSwitch}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-body font-medium transition-colors duration-200 ${chainInfo.unsupported
                    ? 'text-status-error bg-status-error/10'
                    : 'text-ink-muted hover:text-ink hover:bg-canvas-alt/50'
                    }`}
                >
                  {chainInfo.unsupported ? (
                    'Switch Network'
                  ) : (
                    <>
                      {chainInfo.hasIcon && chainInfo.iconUrl && (
                        <img
                          alt={chainInfo.name ?? 'Chain icon'}
                          src={chainInfo.iconUrl}
                          className="w-5 h-5 rounded-full"
                        />
                      )}
                      {chainInfo.name}
                    </>
                  )}
                </button>
              )}
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`block px-4 py-3 rounded-xl text-body font-medium transition-colors duration-200 ${location.pathname === item.path
                    ? 'bg-canvas-alt text-ink'
                    : 'text-ink-muted hover:text-ink hover:bg-canvas-alt/50'
                    }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
