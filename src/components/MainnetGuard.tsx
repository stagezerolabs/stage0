import type { ReactNode } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { riseMainnet } from '@/config';
import { useRiseNetworkSwitch } from '@/lib/hooks/useRiseNetworkSwitch';

type MainnetGuardProps = {
  children: ReactNode;
};

export default function MainnetGuard({ children }: MainnetGuardProps) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchToRise, isSwitching, error } = useRiseNetworkSwitch();

  if (!isConnected || chainId === riseMainnet.id) {
    return children;
  }

  return (
    <section
      className="mx-auto max-w-xl rounded-3xl border border-status-upcoming/30 bg-canvas-alt/90 p-6 text-center shadow-2xl backdrop-blur sm:p-8"
      role="alert"
      aria-live="polite"
    >
      <img
        src={riseMainnet.iconUrl as string}
        alt=""
        className="mx-auto mb-4 h-12 w-12 rounded-full"
      />
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-status-upcoming">
        Unsupported network
      </p>
      <h1 className="text-2xl font-bold text-ink">Switch to RISE Mainnet</h1>
      <p className="mt-3 text-sm leading-6 text-ink-muted">
        Stage0 is configured for RISE Mainnet only. Your wallet is currently on chain {chainId};
        transactions are blocked until you switch to chain {riseMainnet.id}.
      </p>
      <button
        type="button"
        onClick={() => void switchToRise().catch(() => undefined)}
        disabled={isSwitching}
        className="mt-6 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-accent-foreground transition hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60"
      >
        {isSwitching ? 'Switching network…' : 'Switch to RISE Mainnet'}
      </button>
      {error && <p className="mt-3 text-xs text-status-error">{error.message}</p>}
    </section>
  );
}
