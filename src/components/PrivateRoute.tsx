import React from 'react';
import { useAccount } from 'wagmi';
import { Navigate, Outlet } from 'react-router-dom';

const PrivateRoute: React.FC = () => {
  const { isConnected } = useAccount();

  return isConnected ? <Outlet /> : <Navigate to="/" />;
};

export default PrivateRoute;
