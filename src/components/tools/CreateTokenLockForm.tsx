import React from 'react';

const CreateTokenLockForm: React.FC = () => {
  return (
    <form className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Token Address */}
        <div className="form-group md:col-span-2">
          <label htmlFor="tokenAddress" className="form-label">
            Token Address
          </label>
          <input
            type="text"
            name="tokenAddress"
            id="tokenAddress"
            className="form-input"
            placeholder="0x..."
          />
        </div>

        {/* Amount to Lock */}
        <div className="form-group">
          <label htmlFor="lockAmount" className="form-label">
            Amount to Lock
          </label>
          <input
            type="number"
            name="lockAmount"
            id="lockAmount"
            className="form-input"
            placeholder="e.g. 100,000"
          />
        </div>

        {/* Unlock Date */}
        <div className="form-group">
          <label htmlFor="unlockDate" className="form-label">
            Unlock Date
          </label>
          <input
            type="date"
            name="unlockDate"
            id="unlockDate"
            className="form-input"
          />
        </div>
      </div>

      <div className="flex justify-end pt-6 border-t border-border">
        <button type="submit" className="btn-primary">
          Create Lock
        </button>
      </div>
    </form>
  );
};

export default CreateTokenLockForm;

