import { Navigate, Route, Routes } from 'react-router-dom';
import { useAccount } from 'wagmi';
import Layout from './components/layout/Layout';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';

// Pages
import HomePage from './pages/HomePage';
import Dashboard from './pages/Dashboard';
import PresalesPage from './pages/PresalesPage';
import PresaleDetailPage from './pages/PresaleDetailPage';
import ManagePresalePage from './pages/ManagePresalePage';
import CreateTokenPage from './pages/CreateTokenPage';
import CreatePresalePage from './pages/CreatePresalePage';
import CreateNFTPage from './pages/CreateNFTPage';
import ManageNFTPage from './pages/ManageNFTPage';
import NFTDetailPage from './pages/NFTDetailPage';
import TokenLockerPage from './pages/TokenLockerPage';
import LockDetailPage from './pages/LockDetailPage';
import AirdropPage from './pages/AirdropPage';
import Staking from './pages/Staking';
import Tools from './pages/Tools';
import ProjectPage from './pages/ProjectPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminPresalesPage from './pages/admin/AdminPresalesPage';
import AdminWhitelistPage from './pages/admin/AdminWhitelistPage';
import TokensPage from './pages/TokensPage';

type AppRoutesProps = {
  themeMode: 'dark' | 'light';
  onToggleTheme: () => void;
};

const HomeOrDashboard = () => {
  const { isConnected } = useAccount();
  return isConnected ? <Navigate to="/dashboard" replace /> : <HomePage />;
};

const AppRoutes = ({ themeMode, onToggleTheme }: AppRoutesProps) => {
  return (
    <Layout themeMode={themeMode} onToggleTheme={onToggleTheme}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomeOrDashboard />} />
        <Route path="/presales" element={<PresalesPage />} />
        <Route path="/presales/:address" element={<PresaleDetailPage />} />
        <Route path="/nfts/:address" element={<NFTDetailPage />} />

        {/* Private routes */}
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/presales/manage/:address" element={<ManagePresalePage />} />
          <Route path="/create/token" element={<CreateTokenPage />} />
          <Route path="/create/presale" element={<CreatePresalePage />} />
          <Route path="/create/nft" element={<CreateNFTPage />} />
          <Route path="/nfts/manage/:address" element={<ManageNFTPage />} />
          <Route path="/tools/token-locker" element={<TokenLockerPage />} />
          <Route path="/locks/:id" element={<LockDetailPage />} />
          <Route path="/tools/airdrop" element={<AirdropPage />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/staking" element={<Staking />} />
          <Route path="/project/:address" element={<ProjectPage />} />
          <Route path="/tokens" element={<TokensPage />} />
        </Route>

        {/* Admin routes */}
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/presales" element={<AdminPresalesPage />} />
          <Route path="/admin/whitelist" element={<AdminWhitelistPage />} />
        </Route>
      </Routes>
    </Layout>
  );
};

export default AppRoutes;
