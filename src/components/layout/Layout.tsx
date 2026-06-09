import React from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import AICopilot from '../AICopilot';

type LayoutProps = {
  children: React.ReactNode;
  themeMode: 'dark' | 'light';
  onToggleTheme: () => void;
};

const Layout: React.FC<LayoutProps> = ({ children, themeMode, onToggleTheme }) => {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const showAtmosphere = themeMode === 'dark';

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

      {/* Geometric monoliths */}
      {showAtmosphere && (
        <div
          className="geo-monolith"
          style={{
            width: '300px',
            height: '400px',
            top: '15%',
            left: '8%',
            animation: 'geoRotate 120s linear infinite',
            opacity: 0.03,
            zIndex: 1,
          }}
        />
      )}
      {showAtmosphere && (
        <div
          className="geo-monolith"
          style={{
            width: '200px',
            height: '350px',
            top: '40%',
            right: '6%',
            animation: 'geoRotate 180s linear infinite reverse',
            opacity: 0.05,
            zIndex: 1,
          }}
        />
      )}

      {/* Subtle noise texture overlay */}
      <div className="noise-overlay" />

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

      <AICopilot />
    </div>
  );
};

export default Layout;
