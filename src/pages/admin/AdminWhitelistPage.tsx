import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { isAddress, type Address } from 'viem';
import { toast } from 'sonner';
import { ArrowLeft, ShieldCheck, ShieldX, UserPlus, UserMinus } from 'lucide-react';
import { useWhitelistedCreator } from '@/lib/hooks/useWhitelistedCreator';
import { useRemoveWhitelistedCreator, useSetWhitelistedCreator } from '@/lib/hooks/useAdminActions';

const AdminWhitelistPage: React.FC = () => {
  const [checkInput, setCheckInput] = useState('');
  const [checkTarget, setCheckTarget] = useState<Address | undefined>(undefined);
  const { isWhitelisted, isLoading } = useWhitelistedCreator(checkTarget);

  const [addInput, setAddInput] = useState('');
  const [removeInput, setRemoveInput] = useState('');

  const addAction = useSetWhitelistedCreator();
  const removeAction = useRemoveWhitelistedCreator();

  useEffect(() => {
    if (addAction.isSuccess) {
      toast.success('Creator added to whitelist.');
      setAddInput('');
      addAction.reset();
    }
    if (addAction.isError) {
      toast.error(addAction.error?.message ?? 'Failed to add creator.');
      addAction.reset();
    }
  }, [addAction.isSuccess, addAction.isError, addAction.error, addAction.reset]);

  useEffect(() => {
    if (removeAction.isSuccess) {
      toast.success('Creator removed from whitelist.');
      setRemoveInput('');
      removeAction.reset();
    }
    if (removeAction.isError) {
      toast.error(removeAction.error?.message ?? 'Failed to remove creator.');
      removeAction.reset();
    }
  }, [removeAction.isSuccess, removeAction.isError, removeAction.error, removeAction.reset]);

  const handleCheck = () => {
    if (!checkInput || !isAddress(checkInput)) {
      toast.error('Enter a valid address to check.');
      return;
    }
    setCheckTarget(checkInput as Address);
  };

  const handleAdd = () => {
    if (!addInput || !isAddress(addInput)) {
      toast.error('Enter a valid address to add.');
      return;
    }
    addAction.addWhitelistedCreator(addInput as Address);
  };

  const handleRemove = () => {
    if (!removeInput || !isAddress(removeInput)) {
      toast.error('Enter a valid address to remove.');
      return;
    }
    removeAction.removeWhitelistedCreator(removeInput as Address);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3">
        <Link to="/admin" className="inline-flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Link>
        <div>
          <h1 className="font-display text-display-lg text-ink">Whitelist Creators</h1>
          <p className="text-body text-ink-muted">
            Control who can create launches directly from Stage0.
          </p>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6 space-y-4">
        <h2 className="font-display text-display-sm text-ink">Check Status</h2>
        <p className="text-body-sm text-ink-muted">
          Enter a wallet to verify if it is whitelisted.
        </p>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            value={checkInput}
            onChange={(event) => setCheckInput(event.target.value)}
            placeholder="0x..."
            className="input-field font-mono flex-1"
          />
          <button onClick={handleCheck} className="btn-secondary">Check</button>
        </div>

        {checkTarget && (
          <div className={`flex items-center gap-3 rounded-2xl p-4 ${
            isWhitelisted ? 'bg-status-live/15 text-status-live' : 'bg-status-error/10 text-status-error'
          }`}>
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : isWhitelisted ? (
              <ShieldCheck className="w-4 h-4" />
            ) : (
              <ShieldX className="w-4 h-4" />
            )}
            <div>
              <p className="text-body-sm font-medium">
                {isLoading ? 'Checking...' : isWhitelisted ? 'Whitelisted' : 'Not whitelisted'}
              </p>
              <p className="text-xs font-mono break-all">{checkTarget}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-accent" />
            <h2 className="font-display text-display-sm text-ink">Add Creator</h2>
          </div>
          <p className="text-body-sm text-ink-muted">
            Whitelisted creators can create launches without an approval step.
          </p>
          <input
            value={addInput}
            onChange={(event) => setAddInput(event.target.value)}
            placeholder="0x..."
            className="input-field font-mono"
          />
          <button
            onClick={handleAdd}
            disabled={addAction.isBusy || !addInput}
            className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {addAction.isBusy ? 'Adding...' : 'Add to Whitelist'}
          </button>
        </div>

        <div className="glass-card rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <UserMinus className="w-5 h-5 text-status-error" />
            <h2 className="font-display text-display-sm text-ink">Remove Creator</h2>
          </div>
          <p className="text-body-sm text-ink-muted">
            Removing a creator prevents them from launching new projects.
          </p>
          <input
            value={removeInput}
            onChange={(event) => setRemoveInput(event.target.value)}
            placeholder="0x..."
            className="input-field font-mono"
          />
          <button
            onClick={handleRemove}
            disabled={removeAction.isBusy || !removeInput}
            className="btn-secondary w-full disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {removeAction.isBusy ? 'Removing...' : 'Remove from Whitelist'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminWhitelistPage;
