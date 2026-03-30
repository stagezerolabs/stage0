import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './AppRoutes';

import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, useChainId } from 'wagmi';
import { config } from './config';
import { useBlockchainStore } from './lib/store/blockchain-store';
import { useLaunchpadPresaleStore } from './lib/store/launchpad-presale-store';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Toaster } from 'sonner';

const queryClient = new QueryClient();
const THEME_STORAGE_KEY = 'stage0-theme';
type ThemeMode = 'dark' | 'light';

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'dark';
  return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
};

// Clears zustand caches when the user switches chains
function ChainCacheReset() {
  const chainId = useChainId();
  const prevChainId = useRef(chainId);
  const clearBlockchain = useBlockchainStore((s) => s.clearCache);
  const clearPresale = useLaunchpadPresaleStore((s) => s.clearCache);

  useEffect(() => {
    if (prevChainId.current !== chainId) {
      clearBlockchain();
      clearPresale();
      prevChainId.current = chainId;
    }
  }, [chainId, clearBlockchain, clearPresale]);

  return null;
}

function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  const toggleTheme = useCallback(() => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const rainbowKitTheme = useMemo(
    () =>
      themeMode === 'light'
        ? lightTheme({
            accentColor: '#FF8A00',
            accentColorForeground: '#0B0E11',
            borderRadius: 'large',
          })
        : darkTheme({
            accentColor: '#04DF83',
            accentColorForeground: '#0B0E11',
            borderRadius: 'large',
          }),
    [themeMode],
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rainbowKitTheme}>
          <ChainCacheReset />
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                fontFamily: '"Space Mono", "JetBrains Mono", monospace',
              },
            }}
          />
          <Router>
            <AppRoutes themeMode={themeMode} onToggleTheme={toggleTheme} />
          </Router>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
