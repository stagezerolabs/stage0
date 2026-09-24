import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import LazyLoadBoundary from '../ui/LazyLoadBoundary';
const AICopilot = lazy(() => import('../AICopilot'));

type LayoutProps = {
  children: React.ReactNode;
  themeMode: 'dark' | 'light';
  onToggleTheme: () => void;
};

const Layout: React.FC<LayoutProps> = ({ children, themeMode, onToggleTheme }) => {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const showAtmosphere = themeMode === 'dark';
  const [showCopilot, setShowCopilot] = useState(false);

  useEffect(() => {
    // The chat widget is useful, but its code can wait until the page has painted.
    const timeout = window.setTimeout(() => setShowCopilot(true), 2500);
    const idle = window.requestIdleCallback?.(() => setShowCopilot(true));

    return () => {
      window.clearTimeout(timeout);
      if (idle !== undefined) window.cancelIdleCallback(idle);
    };
  }, []);

  return (
    <div className="relative flex flex-col min-h-screen bg-canvas" style={{ overflowX: 'clip' }}>
      {/* Atmospheric sky layer */}
      {showAtmosphere && <div className="sky-layer" style={{ zIndex: 0 }} />}

      {/* Subtle gradient accent at top */}
      <div
        className="fixed left-0 right-0 pointer-events-none opacity-50"
        style={{
          background: 'var(--layout-top-glow)',
          top: themeMode === 'dark' ? 72 : 0,
          height: themeMode === 'dark' ? 448 : 520,
          zIndex: 1,
        }}
      />

      {/* Light streaks */}
      {showAtmosphere && <div className="light-streak" style={{ top: '35vh', zIndex: 1 }} />}
      {showAtmosphere && <div className="light-streak--2" style={{ top: '65vh', zIndex: 1 }} />}

      <Header themeMode={themeMode} onToggleTheme={onToggleTheme} />

      <main className="relative flex-grow" style={{ zIndex: 10 }}>
        {isHomePage ? (
          <div className="w-full px-0">{children}</div>
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
            {children}
          </div>
        )}
      </main>

      <Footer themeMode={themeMode} />

      {showCopilot && (
        <LazyLoadBoundary fallback={null}>
          <Suspense fallback={null}>
            <AICopilot />
          </Suspense>
        </LazyLoadBoundary>
      )}
    </div>
  );
};

export default Layout;
