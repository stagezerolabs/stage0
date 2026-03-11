import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { decodeEventLog, parseUnits, type Address } from 'viem';
import { TokenFactory, getContractAddresses } from '@/config';
import {
  Coins,
  Flame,
  Printer,
  Percent,
  Ban,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBlockchainStore } from '@/lib/store/blockchain-store';

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

type TokenType = 'plain' | 'mintable' | 'burnable' | 'taxable' | 'nonMintable';

const tokenTypes: {
  type: TokenType;
  label: string;
  description: string;
  icon: React.FC<{ className?: string }>;
  functionName: string;
}[] = [
  {
    type: 'plain',
    label: 'Plain',
    description: 'Standard ERC20 token with fixed supply.',
    icon: Coins,
    functionName: 'createPlainToken',
  },
  {
    type: 'mintable',
    label: 'Mintable',
    description: 'Owner can mint new tokens after creation.',
    icon: Printer,
    functionName: 'createMintableToken',
  },
  {
    type: 'burnable',
    label: 'Burnable',
    description: 'Holders can burn their tokens to reduce supply.',
    icon: Flame,
    functionName: 'createBurnableToken',
  },
  {
    type: 'taxable',
    label: 'Taxable',
    description: 'Automatic tax on transfers sent to a wallet.',
    icon: Percent,
    functionName: 'createTaxableToken',
  },
  {
    type: 'nonMintable',
    label: 'Non-Mintable',
    description: 'Fixed supply token that can never be minted.',
    icon: Ban,
    functionName: 'createNonMintableToken',
  },
];

const CreateTokenPage: React.FC = () => {
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  const [selectedType, setSelectedType] = useState<TokenType>('plain');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [decimals, setDecimals] = useState('18');
  const [initialSupply, setInitialSupply] = useState('');
  const [recipient, setRecipient] = useState('');
  const [taxWallet, setTaxWallet] = useState('');
  const [taxBps, setTaxBps] = useState('');
  const [createdTokenAddress, setCreatedTokenAddress] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const lastToastHash = useRef<string | null>(null);
  const lastErrorMessage = useRef<string | null>(null);
  const hasHandledSuccess = useRef(false);

  const { getUserTokens, setUserTokens } = useBlockchainStore();

  const {
    data: hash,
    writeContract,
    isPending,
    error: writeError,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    isError: isReceiptError,
    error: receiptError,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash });

  const formatTxError = (error: unknown) => {
    const message = (error as { message?: string })?.message ?? '';
    const lowered = message.toLowerCase();

    if (
      lowered.includes('user rejected') ||
      lowered.includes('user denied') ||
      lowered.includes('rejected the request') ||
      lowered.includes('denied')
    ) {
      return 'Transaction cancelled by user.';
    }

    if (lowered.includes('insufficient funds')) {
      return 'Insufficient funds to pay for gas.';
    }

    if (lowered.includes('nonce')) {
      return 'Nonce error. Please try again.';
    }

    return message.length > 0 ? message : 'Transaction failed.';
  };

  // Extract created token address from receipt logs
  useEffect(() => {
    if (!isSuccess || !receipt?.logs) return;

    const extractTopicAddress = (topic?: string) => {
      if (!topic || topic.length !== 66) return null;
      return `0x${topic.slice(26)}` as Address;
    };

    let tokenAddress: string | null = null;
    for (const log of receipt.logs) {
      if (log.address?.toLowerCase() !== contracts.tokenFactory.toLowerCase()) continue;

      try {
        const decoded = decodeEventLog({
          abi: TokenFactory,
          data: log.data,
          topics: log.topics,
        });

        if (decoded.eventName === 'TokenCreated') {
          const args = decoded.args as { token?: Address };
          if (args?.token) {
            tokenAddress = args.token;
            break;
          }
        }
      } catch {
        // Fallback to topic positions (handles ABI variance)
        if (log.topics?.length >= 3) {
          tokenAddress = extractTopicAddress(log.topics[2]);
        } else if (log.topics?.length >= 2) {
          tokenAddress = extractTopicAddress(log.topics[1]);
        }
        if (tokenAddress) break;
      }
    }

    if (tokenAddress) {
      setCreatedTokenAddress(tokenAddress);
    }
  }, [isSuccess, receipt, contracts.tokenFactory]);

  // Default recipient to connected wallet
  useEffect(() => {
    if (userAddress && !recipient) {
      setRecipient(userAddress);
    }
  }, [userAddress, recipient]);

  useEffect(() => {
    if (hash && lastToastHash.current !== hash) {
      toast.message('Transaction submitted. Waiting for confirmation...');
      lastToastHash.current = hash;
    }
  }, [hash]);

  useEffect(() => {
    if (!isSuccess || hasHandledSuccess.current) return;

    toast.success('Token created successfully.');
    setShowSuccessModal(true);

    if (userAddress) {
      const existing = getUserTokens(userAddress) ?? [];
      if (createdTokenAddress && !existing.some((addr) => addr.toLowerCase() === createdTokenAddress.toLowerCase())) {
        setUserTokens(userAddress, [createdTokenAddress as Address, ...existing]);
      }
    }

    hasHandledSuccess.current = true;
  }, [isSuccess, createdTokenAddress, userAddress, getUserTokens, setUserTokens]);

  useEffect(() => {
    if (writeError) {
      const message = formatTxError(writeError);
      if (lastErrorMessage.current !== message) {
        toast.error(message);
        lastErrorMessage.current = message;
      }
    }
  }, [writeError]);

  useEffect(() => {
    if (isReceiptError && receiptError) {
      const message = formatTxError(receiptError);
      if (lastErrorMessage.current !== message) {
        toast.error(message);
        lastErrorMessage.current = message;
      }
    }
  }, [isReceiptError, receiptError]);

  useEffect(() => {
    if (!isSuccess || !createdTokenAddress || !userAddress) return;
    const existing = getUserTokens(userAddress) ?? [];
    if (!existing.some((addr) => addr.toLowerCase() === createdTokenAddress.toLowerCase())) {
      setUserTokens(userAddress, [createdTokenAddress as Address, ...existing]);
    }
  }, [isSuccess, createdTokenAddress, userAddress, getUserTokens, setUserTokens]);

  const handleSubmit = () => {
    if (!name || !symbol || !initialSupply || !recipient) return;

    const dec = parseInt(decimals) || 18;
    const supply = parseUnits(initialSupply, dec);
    const recipientAddr = recipient as Address;

    const tokenTypeConfig = tokenTypes.find((t) => t.type === selectedType);
    if (!tokenTypeConfig) return;

    if (selectedType === 'taxable') {
      if (!taxWallet || !taxBps) return;
      writeContract({
        abi: TokenFactory,
        address: contracts.tokenFactory,
        functionName: 'createTaxableToken',
        args: [
          {
            name,
            symbol,
            decimals: dec,
            initialSupply: supply,
            initialRecipient: recipientAddr,
          },
          {
            taxWallet: taxWallet as Address,
            taxBps: BigInt(taxBps),
          },
        ],
      });
    } else {
      writeContract({
        abi: TokenFactory,
        address: contracts.tokenFactory,
        functionName: tokenTypeConfig.functionName as any,
        args: [
          {
            name,
            symbol,
            decimals: dec,
            initialSupply: supply,
            initialRecipient: recipientAddr,
          },
        ],
      });
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-3xl mx-auto space-y-8"
    >
      {/* Header */}
      <motion.section variants={itemVariants} className="space-y-2">
        <h1 className="font-display text-display-lg text-ink">Create Token</h1>
        <p className="text-body-lg text-ink-muted">
          Deploy your own ERC20 token on Stage0 with just a few clicks.
        </p>
      </motion.section>

      {/* Token Type Selector */}
      <motion.section variants={itemVariants} className="space-y-4">
        <label className="text-body font-medium text-ink">Token Type</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tokenTypes.map((tt) => (
            <button
              key={tt.type}
              onClick={() => setSelectedType(tt.type)}
              className={`text-left p-4 rounded-2xl border-2 transition-all ${
                selectedType === tt.type
                  ? 'border-accent bg-accent/5 shadow-sm'
                  : 'border-transparent bg-ink/[0.03] hover:bg-ink/[0.06]'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    selectedType === tt.type
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-ink/5 text-ink-muted'
                  }`}
                >
                  <tt.icon className="w-4 h-4" />
                </div>
                <span className="font-medium text-ink">{tt.label}</span>
              </div>
              <p className="text-body-sm text-ink-muted">{tt.description}</p>
            </button>
          ))}
        </div>
      </motion.section>

      {/* Form */}
      <motion.section variants={itemVariants} className="glass-card rounded-3xl p-6 space-y-5">
        <h2 className="font-display text-display-sm text-ink">Token Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-body-sm text-ink-muted font-medium">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Token"
              className="input-field w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-body-sm text-ink-muted font-medium">Symbol</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="MTK"
              className="input-field w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-body-sm text-ink-muted font-medium">Decimals</label>
            <input
              type="number"
              value={decimals}
              onChange={(e) => setDecimals(e.target.value)}
              placeholder="18"
              className="input-field w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-body-sm text-ink-muted font-medium">Initial Supply</label>
            <input
              type="text"
              value={initialSupply}
              onChange={(e) => setInitialSupply(e.target.value)}
              placeholder="1000000"
              className="input-field w-full"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-body-sm text-ink-muted font-medium">Recipient Address</label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="input-field w-full font-mono text-sm"
          />
          <p className="text-xs text-ink-faint">Defaults to your connected wallet.</p>
        </div>

        {/* Taxable Fields */}
        {selectedType === 'taxable' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-ink/5">
            <div className="space-y-1.5">
              <label className="text-body-sm text-ink-muted font-medium">Tax Wallet</label>
              <input
                type="text"
                value={taxWallet}
                onChange={(e) => setTaxWallet(e.target.value)}
                placeholder="0x..."
                className="input-field w-full font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-body-sm text-ink-muted font-medium">
                Tax (BPS, e.g. 100 = 1%)
              </label>
              <input
                type="number"
                value={taxBps}
                onChange={(e) => setTaxBps(e.target.value)}
                placeholder="100"
                className="input-field w-full"
              />
            </div>
          </div>
        )}

      {/* Error */}
      {writeError && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-status-error-bg text-status-error text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{formatTxError(writeError)}</p>
        </div>
      )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={
            isPending ||
            isConfirming ||
            !isConnected ||
            !name ||
            !symbol ||
            !initialSupply ||
            !recipient
          }
          className="btn-primary w-full"
        >
          {isPending || isConfirming ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {isConfirming ? 'Confirming...' : 'Creating Token...'}
            </span>
          ) : !isConnected ? (
            'Connect Wallet First'
          ) : (
            'Create Token'
          )}
        </button>
      </motion.section>

      {/* Success Modal */}
      {showSuccessModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setShowSuccessModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl glass-card rounded-3xl p-8 text-center space-y-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-full bg-status-live-bg text-status-live mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="font-display text-display-md text-ink">Token Created</h2>
              <p className="text-body text-ink-muted">
                Your token has been deployed successfully. Next steps are ready below.
              </p>
            </div>
            {createdTokenAddress && (
              <div className="bg-ink/[0.08] rounded-2xl p-4 space-y-2">
                <p className="text-body-sm text-ink-muted">Token Address</p>
                <code className="text-body font-mono text-ink break-all block">
                  {createdTokenAddress}
                </code>
              </div>
            )}
            <Link to="/dashboard" className="btn-primary w-full">
              Go to Dashboard
            </Link>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default CreateTokenPage;
