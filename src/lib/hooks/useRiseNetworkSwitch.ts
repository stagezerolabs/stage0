import { useCallback, useState } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { riseMainnet } from '@/config';

type Eip1193Provider = {
  request: (input: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function errorCode(error: unknown) {
  if (!error || typeof error !== 'object') return undefined;
  if ('code' in error) return Number(error.code);
  if ('cause' in error && error.cause && typeof error.cause === 'object' && 'code' in error.cause) {
    return Number(error.cause.code);
  }
  return undefined;
}

function shouldTryAddingChain(error: unknown) {
  const code = errorCode(error);
  if (code === 4902) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('unrecognized chain') || message.includes('unknown chain') || message.includes('not added');
}

function isUserRejection(error: unknown) {
  return errorCode(error) === 4001;
}

export function useRiseNetworkSwitch() {
  const { connector } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const switchToRise = useCallback(async () => {
    setIsSwitching(true);
    setError(null);
    try {
      try {
        await switchChainAsync({ chainId: riseMainnet.id });
        return;
      } catch (switchError) {
        if (isUserRejection(switchError)) throw switchError;
      }

      const provider = await connector?.getProvider() as Eip1193Provider | undefined;
      if (!provider?.request) throw new Error('This wallet does not support programmatic network switching.');

      const chainParameter = { chainId: `0x${riseMainnet.id.toString(16)}` };
      try {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [chainParameter] });
      } catch (providerSwitchError) {
        if (!shouldTryAddingChain(providerSwitchError)) throw providerSwitchError;
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            ...chainParameter,
            chainName: riseMainnet.name,
            nativeCurrency: riseMainnet.nativeCurrency,
            rpcUrls: [...riseMainnet.rpcUrls.default.http],
            blockExplorerUrls: [riseMainnet.blockExplorers.default.url],
          }],
        });
        await provider.request({ method: 'wallet_switchEthereumChain', params: [chainParameter] });
      }
    } catch (nextError) {
      const normalized = nextError instanceof Error ? nextError : new Error(String(nextError));
      setError(normalized);
      throw normalized;
    } finally {
      setIsSwitching(false);
    }
  }, [connector, switchChainAsync]);

  return { switchToRise, isSwitching, error };
}
