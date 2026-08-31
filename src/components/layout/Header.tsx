import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useConnect, useConnectors } from 'wagmi';
import { AlertTriangle, ChevronDown, Menu, Moon, Sun, Wallet, X } from '@/components/ui/icons';
import { InlineLoading } from '@/components/ui/spinner';
import { RISE_CONNECTOR_ID, riseMainnet } from '@/config';
import { useIsAdmin } from '@/lib/utils/admin';
import { useUserDomain } from '@/lib/hooks/useUserDomain';
import type { Address } from 'viem';

type HeaderProps = {
  themeMode: 'dark' | 'light';
  onToggleTheme: () => void;
};

const Header: React.FC<HeaderProps> = ({ themeMode, onToggleTheme }) => {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpenForPath, setMobileMenuOpenForPath] = useState<string | null>(null);
  const isMobileMenuOpen = mobileMenuOpenForPath === location.pathname;
  const [namesDrawerOpenForPath, setNamesDrawerOpenForPath] = useState<string | null>(null);
  const namesDrawerOpen = namesDrawerOpenForPath === location.pathname;
  const [chainInfo, setChainInfo] = useState<{
    name?: string;
    iconUrl?: string;
    hasIcon?: boolean;
    unsupported?: boolean;
  } | null>(null);
  const openChainModalRef = useRef<(() => void) | null>(null);
  const openAccountModalRef = useRef<(() => void) | null>(null);
  const openConnectModalRef = useRef<(() => void) | null>(null);
  const namesNavRef = useRef<HTMLDivElement>(null);
  const { isConnected, address } = useAccount();
  const { isAdmin: isOwner } = useIsAdmin(address as Address | undefined);
  const { displayName: rnsDomain } = useUserDomain(address);
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

  useEffect(() => {
    if (!namesDrawerOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (!namesNavRef.current?.contains(event.target as Node)) {
        setNamesDrawerOpenForPath(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNamesDrawerOpenForPath(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [namesDrawerOpen]);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpenForPath(null);
  }, []);

  const closeNamesDrawer = useCallback(() => {
    setNamesDrawerOpenForPath(null);
  }, []);

  const toggleNamesDrawer = useCallback(() => {
    setNamesDrawerOpenForPath((openPath) =>
      openPath === location.pathname ? null : location.pathname,
    );
  }, [location.pathname]);

  const publicNavItems = [
    { path: '/presales', label: 'Launchpad' },
  ];

  const namesNavLinks = [
    { path: '/domains', label: 'My names', description: 'Search, register, and manage' },
    { path: '/domains/marketplace', label: 'Marketplace', description: 'Browse domain names' },
  ];

  const privateNavItems = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/presales', label: 'Launchpad' },
    { path: '/my-nfts', label: 'My NFTs' },
    { path: '/domains', label: 'Names' },
    { path: '/tools', label: 'Tools' },
  ];

  const navItems = isConnected
    ? [
      ...privateNavItems,
      ...(isOwner ? [{ path: '/admin', label: 'Admin' }] : []),
    ]
    : publicNavItems;

  const handleMobileChainSwitch = useCallback(() => {
    closeMobileMenu();
    openChainModalRef.current?.();
  }, [closeMobileMenu]);

  const handleMobileWalletAction = useCallback(() => {
    closeMobileMenu();
    if (isConnected) {
      openAccountModalRef.current?.();
      return;
    }
    openConnectModalRef.current?.();
  }, [closeMobileMenu, isConnected]);

  const handleMobileThemeToggle = useCallback(() => {
    closeMobileMenu();
    onToggleTheme();
  }, [closeMobileMenu, onToggleTheme]);

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
          <span className="block h-10 md:h-12 aspect-[466/165]">
            <img
              src={
                themeMode === 'dark'
                  ? 'https://res.cloudinary.com/dma1c8i6n/image/upload/v1774875763/STAGE0_white_green_vilwwf.png'
                  : 'https://res.cloudinary.com/dma1c8i6n/image/upload/v1774875763/STAGE0_black_orange_wiqr1i.png'
              }
              alt="STAGE0"
              className="h-full w-full object-contain"
            />
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            const isNamesItem = item.path === '/domains';

            if (isNamesItem) {
              return (
                <div key={item.path} ref={namesNavRef} className="relative">
                  <button
                    type="button"
                    onClick={toggleNamesDrawer}
                    aria-expanded={namesDrawerOpen}
                    aria-haspopup="menu"
                    className="relative inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium tracking-tight transition-colors duration-300"
                  >
                    <span className={`relative z-10 ${isActive ? 'text-ink' : 'text-ink-muted hover:text-ink'}`}>
                      {item.label}
                    </span>
                    <ChevronDown className={`relative z-10 h-3.5 w-3.5 transition-transform ${namesDrawerOpen ? 'rotate-180 text-ink' : 'text-ink-muted'}`} />
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          layoutId="nav-indicator"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                          className="absolute inset-0 bg-ink/[0.07] rounded-full border border-border/40"
                        />
                      )}
                    </AnimatePresence>
                  </button>

                  <AnimatePresence>
                    {namesDrawerOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute left-1/2 top-[calc(100%+10px)] z-50 w-60 -translate-x-1/2 rounded-2xl border border-border bg-canvas-alt/95 p-2 shadow-float backdrop-blur-xl"
                        role="menu"
                      >
                        {namesNavLinks.map((link) => {
                          const linkActive = location.pathname === link.path;
                          return (
                            <Link
                              key={link.path}
                              to={link.path}
                              onClick={closeNamesDrawer}
                              className={`block rounded-xl px-3.5 py-3 transition-colors ${linkActive
                                ? 'bg-accent/10 text-ink'
                                : 'text-ink-muted hover:bg-canvas/60 hover:text-ink'
                                }`}
                              role="menuitem"
                            >
                              <span className="block text-[13px] font-semibold">{link.label}</span>
                              <span className="mt-0.5 block text-[11px] text-ink-faint">{link.description}</span>
                            </Link>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative px-3.5 py-2 text-[13px] font-medium tracking-tight transition-colors duration-300"
              >
                <span
                  className={`relative z-10 ${isActive ? 'text-ink' : 'text-ink-muted hover:text-ink'}`}
                >
                  {item.label}
                </span>
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0 bg-ink/[0.07] rounded-full border border-border/40"
                    />
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </div>

        {/* Right side: Theme + Connect + Mobile menu button */}
        <div className="flex items-center gap-3">
          {!isConnected && (
            <div
              className="hidden lg:inline-flex items-center gap-2 rounded-full border border-border bg-canvas-alt/70 px-3 py-2 text-[12px] font-semibold text-ink-muted"
              aria-label="Default network: RISE Mainnet"
              title={`Default network · Chain ${riseMainnet.id}`}
            >
              <img src="/rise-network.svg" alt="" className="h-4 w-4 rounded-full" />
              <span>RISE Mainnet</span>
            </div>
          )}

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
                            <img
                              alt={chain.name ?? 'Chain icon'}
                              src={chain.iconUrl ?? '/rise-network.svg'}
                              className="w-4 h-4 rounded-full"
                            />
                            <span className="hidden sm:inline text-body-sm">{chain.name}</span>
                          </button>

                          <button
                            onClick={openAccountModal}
                            className="btn-primary"
                          >
                            <span className="font-mono text-body-sm">
                              {rnsDomain ?? account.displayName}
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
            onClick={() =>
              setMobileMenuOpenForPath((current) =>
                current === location.pathname ? null : location.pathname,
              )
            }
            className="md:hidden btn-ghost p-2"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isMobileMenuOpen && (
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
                    closeMobileMenu();
                    connect({ connector: riseConnector });
                  }}
                  disabled={isRiseConnectPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-body font-medium text-accent-secondary border border-accent-secondary/40 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isRiseConnectPending ? <InlineLoading label="Connecting..." /> : 'Connect RISE Passkey'}
                </button>
              )}

              {!isConnected && (
                <div
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-canvas-alt/50 px-4 py-3 text-body font-medium text-ink-muted"
                  aria-label="Default network: RISE Mainnet"
                >
                  <img src="/rise-network.svg" alt="" className="h-5 w-5 rounded-full" />
                  <span className="flex flex-col items-start">
                    <span className="text-ink">RISE Mainnet</span>
                    <span className="text-[10px] font-normal text-ink-faint">Default network · Chain {riseMainnet.id}</span>
                  </span>
                </div>
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
                      <img
                        alt={chainInfo.name ?? 'Chain icon'}
                        src={chainInfo.iconUrl ?? '/rise-network.svg'}
                        className="w-5 h-5 rounded-full"
                      />
                      {chainInfo.name}
                    </>
                  )}
                </button>
              )}
              {navItems.map((item) => {
                const isActive =
                  item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                const isNamesItem = item.path === '/domains';

                if (isNamesItem) {
                  return (
                    <div key={item.path} className="rounded-xl">
                      <button
                        type="button"
                        onClick={toggleNamesDrawer}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-body font-medium transition-colors duration-200 ${isActive
                          ? 'bg-canvas-alt text-ink'
                          : 'text-ink-muted hover:text-ink hover:bg-canvas-alt/50'
                          }`}
                        aria-expanded={namesDrawerOpen}
                      >
                        <span>{item.label}</span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${namesDrawerOpen ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {namesDrawerOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden pl-3"
                          >
                            <div className="mt-1 space-y-1 border-l border-border/70 pl-3">
                              {namesNavLinks.map((link) => (
                                <Link
                                  key={link.path}
                                  to={link.path}
                                  onClick={closeMobileMenu}
                                  className={`block rounded-xl px-4 py-2.5 text-body-sm font-medium transition-colors ${location.pathname === link.path
                                    ? 'bg-canvas-alt text-ink'
                                    : 'text-ink-muted hover:bg-canvas-alt/50 hover:text-ink'
                                    }`}
                                >
                                  {link.label}
                                </Link>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`block px-4 py-3 rounded-xl text-body font-medium transition-colors duration-200 ${isActive
                      ? 'bg-canvas-alt text-ink'
                      : 'text-ink-muted hover:text-ink hover:bg-canvas-alt/50'
                      }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
