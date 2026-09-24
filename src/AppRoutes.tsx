import { lazy, Suspense } from 'react';
import { Outlet, Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import MainnetGuard from './components/MainnetGuard';
import CreatorAccessGate from './components/creator/CreatorAccessGate';
import LazyLoadBoundary from './components/ui/LazyLoadBoundary';

// Pages
import HomePage from './pages/HomePage';

// Keep the landing page in the entry bundle; load each other page when visited.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PresalesPage = lazy(() => import('./pages/PresalesPage'));
const PresaleDetailPage = lazy(() => import('./pages/PresaleDetailPage'));
const ManagePresalePage = lazy(() => import('./pages/ManagePresalePage'));
const CreateTokenPage = lazy(() => import('./pages/CreateTokenPage'));
const CreatePresalePage = lazy(() => import('./pages/CreatePresalePage'));
const CreateNFTPage = lazy(() => import('./pages/CreateNFTPage'));
const ManageNFTPage = lazy(() => import('./pages/ManageNFTPage'));
const NFTDetailPage = lazy(() => import('./pages/NFTDetailPage'));
const TokenLockerPage = lazy(() => import('./pages/TokenLockerPage'));
const LockDetailPage = lazy(() => import('./pages/LockDetailPage'));
const AirdropPage = lazy(() => import('./pages/AirdropPage'));
const Tools = lazy(() => import('./pages/Tools'));
const ProjectPage = lazy(() => import('./pages/ProjectPage'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminPresalesPage = lazy(() => import('./pages/admin/AdminPresalesPage'));
const TokensPage = lazy(() => import('./pages/TokensPage'));
const MyNFTsPage = lazy(() => import('./pages/MyNFTsPage'));
const MyNFTCollectionPage = lazy(() => import('./pages/MyNFTCollectionPage'));
const DomainsPage = lazy(() => import('./pages/DomainsPage'));
const DomainsMarketplacePage = lazy(() => import('./pages/DomainsMarketplacePage'));
const NFTMarketplacePage = lazy(() => import('./pages/NFTMarketplacePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

type AppRoutesProps = {
  themeMode: 'dark' | 'light';
  onToggleTheme: () => void;
};

const AppRoutes = ({ themeMode, onToggleTheme }: AppRoutesProps) => {
  return (
    <Layout themeMode={themeMode} onToggleTheme={onToggleTheme}>
      <LazyLoadBoundary fallback={<div className="min-h-[40vh]" role="alert">Page failed to load. <button type="button" onClick={() => window.location.reload()} className="underline">Reload page</button></div>}>
      <Suspense fallback={<div className="min-h-[40vh]" role="status">Loading page…</div>}>
      <Routes>
        <Route path="/nft-marketplace" element={<NFTMarketplacePage />} />
        <Route element={<MainnetGuard><Outlet /></MainnetGuard>}>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/presales" element={<PresalesPage />} />
          <Route path="/presales/:address" element={<PresaleDetailPage />} />
          <Route path="/nfts/:address" element={<NFTDetailPage />} />
          <Route path="/domains" element={<DomainsPage />} />
          <Route path="/domains/marketplace" element={<DomainsMarketplacePage />} />

          {/* Private routes */}
          <Route element={<PrivateRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/presales/manage/:address" element={<ManagePresalePage />} />
            <Route
              path="/create/nft"
              element={<CreatorAccessGate type="nft"><CreateNFTPage /></CreatorAccessGate>}
            />
            <Route
              path="/create/presale"
              element={<CreatorAccessGate type="presale"><CreatePresalePage /></CreatorAccessGate>}
            />
            <Route path="/nfts/manage/:address" element={<ManageNFTPage />} />
            <Route path="/locks/:id" element={<LockDetailPage />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/project/:address" element={<ProjectPage />} />
            <Route path="/tokens" element={<TokensPage />} />
            <Route path="/my-nfts" element={<MyNFTsPage />} />
            <Route path="/my-nfts/:collectionAddress" element={<MyNFTCollectionPage />} />
            {/* Admin-only tool access */}
            <Route element={<AdminRoute />}>
              <Route path="/create/token" element={<CreateTokenPage />} />
              <Route path="/tools/token-locker" element={<TokenLockerPage />} />
              <Route path="/tools/airdrop" element={<AirdropPage />} />
            </Route>
          </Route>

          {/* Admin routes */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/presales" element={<AdminPresalesPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
      </LazyLoadBoundary>
    </Layout>
  );
};

export default AppRoutes;
