import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits, type Address } from 'viem';
import { toast } from 'sonner';
import { ArrowLeft, ExternalLink, RefreshCcw } from 'lucide-react';
import { LaunchpadPresaleContract } from '@/config';
import { useLaunchpadPresales, type PresaleWithStatus } from '@/lib/hooks/useLaunchpadPresales';
import { useUpdatePresaleFees } from '@/lib/hooks/useAdminActions';
import { useFeeRecipient } from '@/lib/utils/admin';

const statusColors: Record<string, string> = {
  live: 'bg-status-live/15 text-status-live',
  upcoming: 'bg-status-warning/15 text-status-warning',
  finalized: 'bg-status-info/15 text-status-info',
  cancelled: 'bg-status-error/15 text-status-error',
  ended: 'bg-ink/10 text-ink-muted',
};

function PresaleCard({ presale, isFeeRecipient }: { presale: PresaleWithStatus; isFeeRecipient: boolean }) {
  const [showFeeForm, setShowFeeForm] = useState(false);
  const [newTokenFeeBps, setNewTokenFeeBps] = useState('');
  const [newProceedsFeeBps, setNewProceedsFeeBps] = useState('');

  const { updateFees, isBusy, isSuccess, isError, error, reset } = useUpdatePresaleFees();

  const { data: tokenFeeBps } = useReadContract({
    address: presale.address as Address,
    abi: LaunchpadPresaleContract,
    functionName: 'tokenFeeBps',
  });

  const { data: proceedsFeeBps } = useReadContract({
    address: presale.address as Address,
    abi: LaunchpadPresaleContract,
    functionName: 'proceedsFeeBps',
  });

  useEffect(() => {
    if (isSuccess) {
      toast.success('Fees updated successfully.');
      setShowFeeForm(false);
      setNewTokenFeeBps('');
      setNewProceedsFeeBps('');
      reset();
    }
  }, [isSuccess, reset]);

  useEffect(() => {
    if (isError) {
      toast.error(error?.message ?? 'Failed to update fees.');
      reset();
    }
  }, [isError, error, reset]);

  const handleUpdateFees = () => {
    const tokenFee = parseInt(newTokenFeeBps, 10);
    const proceedsFee = parseInt(newProceedsFeeBps, 10);

    if (Number.isNaN(tokenFee) || tokenFee < 0 || tokenFee > 10000) {
      toast.error('Token fee must be between 0 and 10000 bps.');
      return;
    }
    if (Number.isNaN(proceedsFee) || proceedsFee < 0 || proceedsFee > 10000) {
      toast.error('Proceeds fee must be between 0 and 10000 bps.');
      return;
    }

    updateFees(presale.address as Address, tokenFee, proceedsFee);
  };

  const paymentDecimals = presale.paymentTokenDecimals ?? 18;
  const paymentSymbol = presale.paymentTokenSymbol ?? 'ETH';
  const hardCap = formatUnits(presale.hardCap ?? 0n, paymentDecimals);
  const totalRaised = formatUnits(presale.totalRaised ?? 0n, paymentDecimals);

  return (
    <div className="glass-card rounded-3xl p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h3 className="font-display text-display-sm text-ink">
              {presale.saleTokenSymbol ?? 'Token'} Presale
            </h3>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[presale.status] ?? statusColors.ended}`}>
              {presale.status}
            </span>
          </div>
          <p className="text-body-sm text-ink-muted">Owner: {presale.owner}</p>
        </div>
        <Link
          to={`/presales/${presale.address}`}
          className="btn-secondary text-sm inline-flex items-center gap-2"
        >
          View Presale <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="stat-card p-4">
          <p className="text-body-sm text-ink-muted">Hard Cap</p>
          <p className="text-body font-semibold text-ink">{hardCap} {paymentSymbol}</p>
        </div>
        <div className="stat-card p-4">
          <p className="text-body-sm text-ink-muted">Total Raised</p>
          <p className="text-body font-semibold text-ink">{totalRaised} {paymentSymbol}</p>
        </div>
        <div className="stat-card p-4">
          <p className="text-body-sm text-ink-muted">Progress</p>
          <p className="text-body font-semibold text-ink">{presale.progress}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 pt-2 border-t border-border/50">
        <div className="space-y-1">
          <p className="text-body-sm text-ink-muted">Presale Address</p>
          <code className="block text-body-sm font-mono text-ink break-all bg-ink/5 p-3 rounded-xl">
            {presale.address}
          </code>
        </div>
        <div className="space-y-2">
          <p className="text-body-sm text-ink-muted">Current Fees</p>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-ink-faint">Token Fee</p>
              <p className="text-body font-medium text-ink">
                {tokenFeeBps !== undefined ? `${Number(tokenFeeBps) / 100}%` : '...'}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-faint">Proceeds Fee</p>
              <p className="text-body font-medium text-ink">
                {proceedsFeeBps !== undefined ? `${Number(proceedsFeeBps) / 100}%` : '...'}
              </p>
            </div>
            {isFeeRecipient && (
              <button
                onClick={() => setShowFeeForm((prev) => !prev)}
                className="btn-ghost text-xs border border-border"
              >
                {showFeeForm ? 'Cancel' : 'Update Fees'}
              </button>
            )}
          </div>
        </div>
      </div>

      {showFeeForm && isFeeRecipient && (
        <div className="glass-card rounded-2xl p-4 space-y-3 border border-border">
          <p className="text-body-sm text-ink-muted">
            Update fees (basis points, 100 = 1%).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-body-sm text-ink-muted">Token Fee (bps)</label>
              <input
                type="number"
                value={newTokenFeeBps}
                onChange={(event) => setNewTokenFeeBps(event.target.value)}
                placeholder={tokenFeeBps?.toString() ?? '200'}
                className="input-field"
              />
            </div>
            <div className="space-y-1">
              <label className="text-body-sm text-ink-muted">Proceeds Fee (bps)</label>
              <input
                type="number"
                value={newProceedsFeeBps}
                onChange={(event) => setNewProceedsFeeBps(event.target.value)}
                placeholder={proceedsFeeBps?.toString() ?? '300'}
                className="input-field"
              />
            </div>
          </div>
          <button
            onClick={handleUpdateFees}
            disabled={isBusy || !newTokenFeeBps || !newProceedsFeeBps}
            className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isBusy ? 'Updating...' : 'Confirm Update'}
          </button>
        </div>
      )}
    </div>
  );
}

const AdminPresalesPage: React.FC = () => {
  const { address } = useAccount();
  const { feeRecipient } = useFeeRecipient();
  const { presales, isLoading, refetch } = useLaunchpadPresales('all', true);
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'ended'>('all');

  const isFeeRecipient = Boolean(
    address && feeRecipient && address.toLowerCase() === feeRecipient.toLowerCase()
  );

  const filteredPresales = useMemo(() => {
    if (!presales) return [];
    if (filter === 'all') return presales;
    if (filter === 'live') return presales.filter((p) => p.status === 'live');
    if (filter === 'upcoming') return presales.filter((p) => p.status === 'upcoming');
    return presales.filter((p) => ['ended', 'finalized', 'cancelled'].includes(p.status));
  }, [presales, filter]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3">
        <Link to="/admin" className="inline-flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Link>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-display text-display-lg text-ink">Admin Presales</h1>
            <p className="text-body text-ink-muted">Monitor and update presale fee settings.</p>
          </div>
          <button onClick={() => refetch()} className="btn-secondary inline-flex items-center gap-2">
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['all', 'live', 'upcoming', 'ended'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status as typeof filter)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              filter === status
                ? 'bg-accent text-accent-foreground'
                : 'bg-ink/5 text-ink-muted hover:text-ink'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <p className="text-body-sm text-ink-muted">Loading presales...</p>
        </div>
      ) : filteredPresales.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center">
          <p className="text-body text-ink-muted">No presales found for this filter.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredPresales.map((presale) => (
            <PresaleCard key={presale.address} presale={presale} isFeeRecipient={isFeeRecipient} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPresalesPage;
