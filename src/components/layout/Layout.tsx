import React from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

type LayoutProps = {
  children: React.ReactNode;
  themeMode: 'dark' | 'light';
  onToggleTheme: () => void;
};

const Layout: React.FC<LayoutProps> = ({ children, themeMode, onToggleTheme }) => {
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  return (
    <div className="relative flex flex-col min-h-screen bg-canvas" style={{ overflowX: 'clip' }}>
      {/* Atmospheric sky layer */}
      <div className="sky-layer" style={{ zIndex: 0 }} />

      {/* Subtle gradient accent at top */}
      <div
        className="fixed top-0 left-0 right-0 h-[700px] pointer-events-none opacity-60"
        style={{
          background: 'var(--layout-top-glow)',
          zIndex: 1,
        }}
      />

      {/* Light streaks */}
      <div className="light-streak" style={{ top: '35vh', zIndex: 1 }} />
      <div className="light-streak--2" style={{ top: '65vh', zIndex: 1 }} />

      {/* Geometric monoliths */}
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

      {/* Subtle noise texture overlay */}
      <div className="noise-overlay" />

      <Header themeMode={themeMode} onToggleTheme={onToggleTheme} />

      <main className="relative flex-grow" style={{ zIndex: 10 }}>
        {isHomePage ? (
          <div className="w-full px-0">{children}</div>
        ) : (
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-16">
            {children}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Layout;
