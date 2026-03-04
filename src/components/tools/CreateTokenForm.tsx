import React from 'react';

const CreateTokenForm: React.FC = () => {
  return (
    <form className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Token Name */}
        <div className="form-group">
          <label htmlFor="tokenName" className="form-label">
            Token Name
          </label>
          <input
            type="text"
            name="tokenName"
            id="tokenName"
            className="form-input"
            placeholder="e.g. My Awesome Token"
          />
        </div>

        {/* Token Symbol */}
        <div className="form-group">
          <label htmlFor="tokenSymbol" className="form-label">
            Token Symbol
          </label>
          <input
            type="text"
            name="tokenSymbol"
            id="tokenSymbol"
            className="form-input"
            placeholder="e.g. MAT"
          />
        </div>

        {/* Token Decimals */}
        <div className="form-group">
          <label htmlFor="tokenDecimals" className="form-label">
            Token Decimals
          </label>
          <input
            type="number"
            name="tokenDecimals"
            id="tokenDecimals"
            className="form-input"
            placeholder="e.g. 18"
          />
        </div>

        {/* Total Supply */}
        <div className="form-group">
          <label htmlFor="tokenTotalSupply" className="form-label">
            Total Supply
          </label>
          <input
            type="number"
            name="tokenTotalSupply"
            id="tokenTotalSupply"
            className="form-input"
            placeholder="e.g. 1,000,000"
          />
        </div>
      </div>

      <div className="flex justify-end pt-6 border-t border-border">
        <button type="submit" className="btn-primary">
          Create Token
        </button>
      </div>
    </form>
  );
};

export default CreateTokenForm;
