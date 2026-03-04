import React from 'react';

const CreateTokenPresaleForm: React.FC = () => {
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

        {/* Presale Rate */}
        <div className="form-group">
          <label htmlFor="presaleRate" className="form-label">
            Presale Rate
          </label>
          <input
            type="number"
            name="presaleRate"
            id="presaleRate"
            className="form-input"
            placeholder="e.g. 1000"
          />
        </div>

        {/* Soft Cap */}
        <div className="form-group">
          <label htmlFor="softCap" className="form-label">
            Soft Cap (ETH)
          </label>
          <input
            type="number"
            name="softCap"
            id="softCap"
            className="form-input"
            placeholder="e.g. 10"
          />
        </div>

        {/* Hard Cap */}
        <div className="form-group">
          <label htmlFor="hardCap" className="form-label">
            Hard Cap (ETH)
          </label>
          <input
            type="number"
            name="hardCap"
            id="hardCap"
            className="form-input"
            placeholder="e.g. 50"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="startDate" className="form-label">
            Start Date
          </label>
          <input
            type="datetime-local"
            name="startDate"
            id="startDate"
            className="form-input"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="endDate" className="form-label">
            End Date
          </label>
          <input
            type="datetime-local"
            name="endDate"
            id="endDate"
            className="form-input"
          />
        </div>
      </div>

      <div className="flex justify-end pt-6 border-t border-border">
        <button type="submit" className="btn-primary">
          Create Presale
        </button>
      </div>
    </form>
  );
};

export default CreateTokenPresaleForm;

