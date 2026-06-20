import { useMemo } from 'react';
import { useAccount, useChainId, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { decodeEventLog, parseUnits, type Address } from 'viem';
import { TokenFactory, getContractAddresses, riseTestnet } from '@/config';
import { useRnsAddressInput } from '@/lib/hooks/rns';
import { getFriendlyTxErrorMessage } from '@/lib/utils/tx-errors';
import type { SennaActionDraft, SignerState } from '../types';

type TokenType = 'plain' | 'mintable' | 'burnable' | 'taxable' | 'nonMintable';

const TYPE_TO_FN: Record<TokenType, string> = {
  plain: 'createPlainToken',
  mintable: 'createMintableToken',
  burnable: 'createBurnableToken',
  taxable: 'createTaxableToken',
  nonMintable: 'createNonMintableToken',
};

function normalizeType(raw: string | undefined): TokenType {
  const lower = (raw || '').toLowerCase();
  if (lower === 'mintable') return 'mintable';
  if (lower === 'burnable') return 'burnable';
  if (lower === 'taxable') return 'taxable';
  if (lower === 'nonmintable' || lower === 'non_mintable' || lower === 'non-mintable') return 'nonMintable';
  return 'plain';
}

export function useCreateTokenSigner(draft: SennaActionDraft): SignerState {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();
  const onWrongChain = chainId !== riseTestnet.id;
  const contracts = getContractAddresses(chainId);

  const tokenType = normalizeType(draft.prefill.tokenType);
  const decimals = Number.parseInt(draft.prefill.decimals || '18', 10);
  const recipientInput = draft.prefill.initialRecipient || address || '';
  const recipientResolution = useRnsAddressInput(recipientInput, riseTestnet.id);
  const recipient = recipientResolution.address;

  const supplyValid = useMemo(() => {
    if (!draft.prefill.initialSupply) return false;
    try {
      parseUnits(draft.prefill.initialSupply, decimals);
      return true;
    } catch {
      return false;
    }
  }, [draft.prefill.initialSupply, decimals]);

  const {
    data: hash,
    writeContract,
    isPending: writePending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: receiptLoading,
    isSuccess,
    isError: receiptIsError,
    error: receiptError,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash });

  const createdAddress = useMemo<Address | null>(() => {
    if (!isSuccess || !receipt?.logs) return null;
    for (const log of receipt.logs) {
      if (log.address?.toLowerCase() !== contracts.tokenFactory.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({ abi: TokenFactory, data: log.data, topics: log.topics });
        if (decoded.eventName === 'TokenCreated') {
          const args = decoded.args as { token?: Address };
          if (args?.token) return args.token;
        }
      } catch {
        if (log.topics?.length >= 3) {
          const candidate = `0x${log.topics[2]!.slice(26)}` as Address;
          if (candidate.length === 42) return candidate;
        }
      }
    }
    return null;
  }, [isSuccess, receipt, contracts.tokenFactory]);

  const errorMessage =
    writeError ? getFriendlyTxErrorMessage(writeError, 'Token creation') :
    receiptIsError && receiptError ? getFriendlyTxErrorMessage(receiptError, 'Token creation') :
    '';

  const primary = () => {
    if (!isConnected) return;
    if (onWrongChain) {
      switchChain({ chainId: riseTestnet.id });
      return;
    }
    if (!supplyValid) return;
    const supply = parseUnits(draft.prefill.initialSupply!, decimals);
    if (!recipient) return;

    if (tokenType === 'taxable') {
      // Senna does not collect tax-wallet/bps; fall back to creator + 100 bps.
      writeContract({
        abi: TokenFactory,
        address: contracts.tokenFactory,
        functionName: 'createTaxableToken',
        args: [
          { name: draft.prefill.name, symbol: draft.prefill.symbol, decimals, initialSupply: supply, initialRecipient: recipient },
          { taxWallet: recipient, taxBps: BigInt(100) },
        ],
      });
      return;
    }

    writeContract({
      abi: TokenFactory,
      address: contracts.tokenFactory,
      functionName: TYPE_TO_FN[tokenType] as 'createPlainToken',
      args: [{ name: draft.prefill.name, symbol: draft.prefill.symbol, decimals, initialSupply: supply, initialRecipient: recipient }],
    });
  };

  let phase: SignerState['phase'] = 'idle';
  let primaryLabel = 'Sign & Create Token';
  let busy = false;
  let ready = true;

  if (!isConnected) {
    phase = 'needs_wallet';
    primaryLabel = 'Connect Wallet';
    ready = false;
  } else if (onWrongChain) {
    phase = 'needs_chain';
    primaryLabel = switching ? 'Switching to RISE…' : 'Switch to RISE Testnet';
    busy = switching;
  } else if (writePending) {
    phase = 'awaiting_signature';
    primaryLabel = 'Sign in your wallet…';
    busy = true;
  } else if (receiptLoading) {
    phase = 'confirming';
    primaryLabel = 'Confirming on RISE…';
    busy = true;
  } else if (isSuccess) {
    phase = 'success';
    primaryLabel = 'Token created';
    busy = false;
  } else if (recipientInput && !recipient && recipientResolution.isLoading) {
    primaryLabel = 'Resolving .rise name...';
    ready = false;
  } else if (recipientInput && !recipient) {
    primaryLabel = 'Resolve recipient first';
    ready = false;
  } else if (errorMessage) {
    phase = 'error';
    primaryLabel = 'Try again';
  }

  return {
    phase,
    primaryLabel,
    errorMessage,
    actionHash: hash,
    createdAddress,
    ready,
    busy,
    primary: () => {
      if (errorMessage) resetWrite();
      primary();
    },
  };
}
