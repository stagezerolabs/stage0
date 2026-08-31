import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAccount, useChainId } from 'wagmi';
import type { Address } from 'viem';
import { AlertTriangle, RefreshCcw } from '@/components/ui/icons';
import { LoadingState } from '@/components/ui/spinner';
import { fetchCreatorAccess, type CreatorApplicationType } from '@/lib/api/creator-applications';
import { useIsAdmin } from '@/lib/utils/admin';
import CreatorApplicationForm from './CreatorApplicationForm';

type CreatorAccessGateProps = {
  type: CreatorApplicationType;
  children: ReactNode;
};

export default function CreatorAccessGate({ type, children }: CreatorAccessGateProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const queryClient = useQueryClient();
  const { isAdmin, isLoading: isLoadingAdmin } = useIsAdmin(
    address as Address | undefined,
    type === 'nft' ? 'nft' : 'presale',
  );
  const accessQuery = useQuery({
    queryKey: ['creator-access', chainId, address?.toLowerCase()],
    queryFn: () => fetchCreatorAccess(address as Address, chainId),
    enabled: Boolean(address) && !isLoadingAdmin && !isAdmin,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  if (isLoadingAdmin || (!isAdmin && accessQuery.isLoading)) {
    return <LoadingState label="Checking creator access" compact />;
  }

  if (isAdmin || accessQuery.data?.[type].approved) return children;

  if (accessQuery.isError) {
    return (
      <section className="mx-auto max-w-xl rounded-3xl border border-status-error/30 bg-canvas-alt p-7 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-status-error" />
        <h1 className="mt-4 font-display text-2xl text-ink">Creator access is temporarily unavailable</h1>
        <p className="mt-2 text-sm text-ink-muted">We could not securely check your approval status. Your builder remains locked until the API responds.</p>
        <button type="button" className="btn-secondary mt-5 inline-flex items-center gap-2" onClick={() => accessQuery.refetch()}><RefreshCcw className="h-4 w-4" /> Try again</button>
      </section>
    );
  }

  return (
    <CreatorApplicationForm
      type={type}
      existingApplication={accessQuery.data?.[type].application}
      onSubmitted={() => queryClient.invalidateQueries({ queryKey: ['creator-access', chainId, address?.toLowerCase()] })}
    />
  );
}
