import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  useAccount,
  useChainId,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { parseUnits, type Address } from 'viem';
import { AirdropMultiSender, erc20Abi, getContractAddresses } from '@/config';
import {
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  Users,
  Coins,
  FileText,
  Trash2,
} from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 40, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 1,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

interface Recipient {
  address: string;
  amount: string;
}

const AirdropPage: React.FC = () => {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  const [isNativeToken, setIsNativeToken] = useState(false);
  const [tokenAddress, setTokenAddress] = useState('');
  const [recipientsText, setRecipientsText] = useState('');
  const [decimals] = useState(18);

  const parsedRecipients = useMemo((): Recipient[] => {
    if (!recipientsText.trim()) return [];
    return recipientsText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const parts = line.split(',').map((p) => p.trim());
        return {
          address: parts[0] || '',
          amount: parts[1] || '0',
        };
      })
      .filter((r) => r.address.startsWith('0x') && r.address.length === 42);
  }, [recipientsText]);

  const totalAmount = useMemo(() => {
    try {
      return parsedRecipients.reduce((sum, r) => {
        return sum + parseUnits(r.amount, decimals);
      }, 0n);
    } catch {
      return 0n;
    }
  }, [parsedRecipients, decimals]);

  // Approval
  const {
    data: approveHash,
    writeContract: approveWrite,
    isPending: isApprovePending,
    reset: resetApprove,
  } = useWriteContract();

  const {
    isLoading: isApproveConfirming,
    isSuccess: isApproveSuccess,
  } = useWaitForTransactionReceipt({ hash: approveHash });

  // Send
  const {
    data: sendHash,
    writeContract: sendWrite,
    isPending: isSendPending,
    error: sendError,
    reset: resetSend,
  } = useWriteContract();

  const {
    isLoading: isSendConfirming,
    isSuccess: isSendSuccess,
  } = useWaitForTransactionReceipt({ hash: sendHash });

  const handleApprove = () => {
    if (!tokenAddress || totalAmount === 0n) return;
    approveWrite({
      abi: erc20Abi,
      address: tokenAddress as Address,
      functionName: 'approve',
      args: [contracts.airdropMultisender, totalAmount],
    });
  };

  const handleSend = () => {
    if (parsedRecipients.length === 0) return;

    const addresses = parsedRecipients.map((r) => r.address as Address);
    const amounts = parsedRecipients.map((r) => parseUnits(r.amount, decimals));

    if (isNativeToken) {
      sendWrite({
        abi: AirdropMultiSender,
        address: contracts.airdropMultisender,
        functionName: 'multiSendETH',
        args: [addresses, amounts],
        value: totalAmount,
      });
    } else {
      if (!tokenAddress) return;
      sendWrite({
        abi: AirdropMultiSender,
        address: contracts.airdropMultisender,
        functionName: 'multiSendToken',
        args: [tokenAddress as Address, addresses, amounts],
      });
    }
  };

  const handleReset = () => {
    resetApprove();
    resetSend();
    setRecipientsText('');
    setTokenAddress('');
  };

  if (isSendSuccess) {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-3xl mx-auto space-y-8"
      >
        <motion.div
          variants={itemVariants}
          className="glass-card rounded-3xl p-8 text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-full bg-status-live-bg text-status-live mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-display-md text-ink">Airdrop Sent!</h2>
            <p className="text-body text-ink-muted">
              Successfully sent tokens to {parsedRecipients.length} recipient
              {parsedRecipients.length !== 1 ? 's' : ''}.
            </p>
          </div>
          <button onClick={handleReset} className="btn-primary">
            Send Another Airdrop
          </button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-3xl mx-auto space-y-8"
    >
      {/* Header */}
      <motion.section variants={itemVariants} className="space-y-2">
        <h1 className="font-display text-display-lg text-ink">Airdrop / Multi-Send</h1>
        <p className="text-body-lg text-ink-muted">
          Send tokens to multiple addresses in a single transaction.
        </p>
      </motion.section>

      <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-6">
        {/* Token Type Toggle */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-ink/[0.02]">
          <div className="flex items-center gap-3">
            <Coins className="w-5 h-5 text-ink-muted" />
            <div>
              <p className="text-body font-medium text-ink">
                {isNativeToken ? 'Native Token' : 'ERC20 Token'}
              </p>
              <p className="text-body-sm text-ink-muted">
                {isNativeToken
                  ? 'Send native chain token to multiple addresses.'
                  : 'Send an ERC20 token to multiple addresses.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsNativeToken(!isNativeToken)}
            className="text-accent"
          >
            {isNativeToken ? (
              <ToggleRight className="w-8 h-8" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-ink-muted" />
            )}
          </button>
        </div>

        {/* Token Address (ERC20 only) */}
        {!isNativeToken && (
          <div className="space-y-1.5">
            <label className="text-body-sm text-ink-muted font-medium">Token Address</label>
            <input
              type="text"
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              placeholder="0x..."
              className="input-field w-full font-mono text-sm"
            />
          </div>
        )}

        {/* Recipients */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-body-sm text-ink-muted font-medium">
              Recipients (one per line: address,amount)
            </label>
            {recipientsText && (
              <button
                onClick={() => setRecipientsText('')}
                className="text-body-sm text-ink-faint hover:text-status-error inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
          <textarea
            value={recipientsText}
            onChange={(e) => setRecipientsText(e.target.value)}
            placeholder={`0x1234...abcd,100\n0x5678...efgh,200\n0x9abc...ijkl,300`}
            rows={8}
            className="input-field w-full font-mono text-sm resize-y"
          />
        </div>

        {/* Preview */}
        {parsedRecipients.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-ink-muted" />
              <h3 className="text-body font-medium text-ink">
                Preview ({parsedRecipients.length} recipients)
              </h3>
            </div>
            <div className="max-h-60 overflow-y-auto rounded-2xl border border-ink/5">
              <table className="w-full text-sm">
                <thead className="bg-ink/[0.03] sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 text-ink-muted font-medium">#</th>
                    <th className="text-left px-4 py-2 text-ink-muted font-medium">Address</th>
                    <th className="text-right px-4 py-2 text-ink-muted font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRecipients.map((r, i) => (
                    <tr key={i} className="border-t border-ink/5">
                      <td className="px-4 py-2 text-ink-faint">{i + 1}</td>
                      <td className="px-4 py-2 font-mono text-ink truncate max-w-[200px]">
                        {r.address.slice(0, 6)}...{r.address.slice(-4)}
                      </td>
                      <td className="px-4 py-2 text-right text-ink font-medium">{r.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-accent/5">
              <span className="text-body-sm text-ink-muted flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                {parsedRecipients.length} recipients
              </span>
              <span className="text-body-sm font-medium text-accent">
                Total: {totalAmount > 0n ? (Number(totalAmount) / 10 ** decimals).toLocaleString() : '0'} tokens
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {sendError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-status-error-bg text-status-error text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>{sendError.message?.slice(0, 200) || 'Transaction failed'}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {!isNativeToken && (
            <button
              onClick={handleApprove}
              disabled={
                isApprovePending ||
                isApproveConfirming ||
                !tokenAddress ||
                parsedRecipients.length === 0
              }
              className="btn-secondary flex-1"
            >
              {isApprovePending || isApproveConfirming ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Approving...
                </span>
              ) : isApproveSuccess ? (
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Approved
                </span>
              ) : (
                'Approve'
              )}
            </button>
          )}
          <button
            onClick={handleSend}
            disabled={
              isSendPending ||
              isSendConfirming ||
              !isConnected ||
              parsedRecipients.length === 0 ||
              (!isNativeToken && !tokenAddress)
            }
            className="btn-primary flex-1"
          >
            {isSendPending || isSendConfirming ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {isSendConfirming ? 'Confirming...' : 'Sending...'}
              </span>
            ) : !isConnected ? (
              'Connect Wallet First'
            ) : (
              <span className="inline-flex items-center gap-2">
                <Send className="w-4 h-4" />
                Send Airdrop
              </span>
            )}
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
};

export default AirdropPage;
