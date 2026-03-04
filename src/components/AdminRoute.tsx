import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAccount, useReadContract } from 'wagmi';
import { PresaleFactory } from '@/config';
import { useChainContracts } from '@/lib/hooks/useChainContracts';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const AdminRoute: React.FC = () => {
  const { isConnected, address } = useAccount();
  const { presaleFactory } = useChainContracts();

  const shouldCheckOwner = isConnected && presaleFactory !== ZERO_ADDRESS;
  const { data: ownerOnChain, isLoading } = useReadContract({
    address: presaleFactory,
    abi: PresaleFactory,
    functionName: 'factoryOwner',
    query: {
      enabled: shouldCheckOwner,
    },
  });

  const resolvedOwner = ownerOnChain as string | undefined;
  const isOnChainOwner = Boolean(
    isConnected &&
      address &&
      resolvedOwner &&
      address.toLowerCase() === resolvedOwner.toLowerCase()
  );

  if (!isConnected) {
    return <Navigate to="/" />;
  }

  if (!shouldCheckOwner) {
    return <Navigate to="/dashboard" />;
  }

  if (isLoading) {
    return null;
  }

  if (!isOnChainOwner) {
    return <Navigate to="/dashboard" />;
  }

  return <Outlet />;
};

export default AdminRoute;
