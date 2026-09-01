import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatEther } from 'viem';
import { riseMainnet } from '@/config';
import { fetchRnsNameResolution, fetchRnsPricing } from '@/lib/api/rns';
import {
  useRnsNameStatus,
  useRnsRegister,
  useRnsRegistrationQuote,
} from '@/lib/hooks/rns';
import { saveRecentRegistration } from '@/lib/rns/recent-registration';
import { RNS_DEFAULT_REGISTRATION_DURATION } from '@/lib/rns/constants';
import { normalizeRnsLabel, rnsNamehash } from '@/lib/rns/utils';
import { getFriendlyTxErrorMessage } from '@/lib/utils/tx-errors';
import type { SennaActionDraft, SignerState } from '../types';

const REGISTRATION_PERIODS = [
  { years: 1, label: 'Starter' },
  { years: 2, label: 'Steady' },
  { years: 3, label: 'Builder' },
  { years: 5, label: 'Diamond hand' },
] as const;

const WEI_PER_ETH = 1_000_000_000_000_000_000n;
const MICROS_PER_USD = 1_000_000n;

function formatEthPrice(value: bigint) {
  const numeric = Number(formatEther(value));
  if (!Number.isFinite(numeric) || numeric === 0) return '0 ETH';
  if (numeric >= 1) return `${numeric.toFixed(2)} ETH`;
  if (numeric >= 0.01) return `${numeric.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')} ETH`;
  return `${numeric.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')} ETH`;
}

function formatUsdPrice(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return `$${numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function useBuyNameSigner(draft: SennaActionDraft): SignerState {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();
  const queryClient = useQueryClient();
  const onWrongChain = chainId !== riseMainnet.id;
  const [durationYears, setDurationYears] = useState<number | null>(null);

  const requestedName = normalizeRnsLabel(draft.prefill.name || '');
  const registrationDuration = BigInt(durationYears ?? 1) * RNS_DEFAULT_REGISTRATION_DURATION;

  useEffect(() => {
    setDurationYears(null);
  }, [requestedName]);

  const { available, isReserved: reserved, isLoading: statusLoading } = useRnsNameStatus(requestedName, {
    enabled: Boolean(requestedName),
  });

  const {
    price: registerPrice = 0n,
    signedQuote,
    signature,
    display,
    isLoading: quoteLoading,
    error: quoteError,
  } = useRnsRegistrationQuote(requestedName, {
    duration: registrationDuration,
    enabled: Boolean(requestedName) && available && !reserved && durationYears !== null,
  });

  const pricingQuery = useQuery({
    queryKey: ['rns', 'pricing', 'senna-name-card', riseMainnet.id, requestedName],
    queryFn: () => fetchRnsPricing({ chainId: riseMainnet.id }),
    enabled: Boolean(requestedName) && available && !reserved,
    staleTime: 60_000,
  });

  const durationOptions = useMemo(() => {
    const pricing = pricingQuery.data;
    const tier = pricing?.tiers.find((item) => requestedName.length >= item.minLength && requestedName.length <= item.maxLength);
    return REGISTRATION_PERIODS.map((period) => {
      const schedule = pricing?.multiYearPolicy.schedule ?? [];
      const exact = schedule.find((item) => item.years === period.years);
      const eligible = [...schedule]
        .sort((a, b) => a.years - b.years)
        .filter((item) => period.years >= item.years);
      const fallback = eligible[eligible.length - 1];
      const priceMultiplierBps = exact?.priceMultiplierBps ?? fallback?.priceMultiplierBps ?? 10_000;
      const discountBps = exact?.discountBps ?? fallback?.discountBps ?? 0;
      if (!pricing || !tier || pricing.ethUsd <= 0) {
        return { ...period, priceEth: null, totalUsd: null, discountPercent: discountBps / 100 };
      }
      const subtotalUsdCents = BigInt(tier.usdCentsPerYear) * BigInt(period.years);
      const totalUsdCents = (subtotalUsdCents * BigInt(priceMultiplierBps)) / 10_000n;
      const ethPriceMicros = BigInt(Math.round(pricing.ethUsd * Number(MICROS_PER_USD)));
      const priceWei = ((totalUsdCents * 10_000n) * WEI_PER_ETH) / ethPriceMicros;
      return {
        ...period,
        priceEth: formatEthPrice(priceWei),
        totalUsd: formatUsdPrice(Number(totalUsdCents) / 100),
        discountPercent: discountBps / 100,
      };
    });
  }, [pricingQuery.data, requestedName]);

  const {
    register,
    hash: actionHash,
    isPending: actionPending,
    isConfirming: actionConfirming,
    isSuccess,
    error: actionError,
    reset: resetAction,
  } = useRnsRegister();

  // Bridge indexer lag: when the register tx confirms, persist a local hint so
  // DomainsPage/MyDomains can show the new name immediately, then invalidate
  // both the Senna-backed and legacy subgraph caches.
  const persistedRef = useRef(false);
  useEffect(() => {
    if (!isSuccess || persistedRef.current) return;
    if (!address || !requestedName) return;
    persistedRef.current = true;
    try {
      saveRecentRegistration(address, requestedName, rnsNamehash(requestedName));
    } catch {
      // localStorage may be unavailable in some browser modes; safe to ignore.
    }
    void fetchRnsNameResolution({ name: requestedName, chainId: riseMainnet.id }).catch(() => {
      // The normal indexer will still catch up; this only accelerates Senna's DB repair.
    });
    queryClient.invalidateQueries({ queryKey: ['rns', 'api', 'domains', 'owner'] });
    queryClient.invalidateQueries({ queryKey: ['rns', 'subgraph', 'domains', 'owner'] });
  }, [isSuccess, address, requestedName, queryClient]);

  const errorMessage =
    reserved ? 'That name is reserved.' :
    requestedName && !statusLoading && available === false ? 'That name is already taken.' :
    quoteError ? 'Could not prepare the registration price. Try again.' :
    actionError ? getFriendlyTxErrorMessage(actionError, 'Register') :
    '';

  const ready = Boolean(requestedName) && available === true && !reserved && durationYears !== null && Boolean(signedQuote && signature);

  let phase: SignerState['phase'] = 'idle';
  let primaryLabel = 'Sign & Register';
  let step: SignerState['step'] | undefined;
  let busy = false;

  if (statusLoading) {
    primaryLabel = 'Checking availability…';
    busy = true;
  } else if (reserved || available === false) {
    primaryLabel = 'Name unavailable';
  } else if (!isConnected) {
    phase = 'needs_wallet';
    primaryLabel = 'Connect Wallet';
  } else if (onWrongChain) {
    phase = 'needs_chain';
    primaryLabel = switching ? 'Switching to RISE…' : 'Switch to RISE Mainnet';
    busy = switching;
  } else if (durationYears === null) {
    primaryLabel = 'Choose a duration';
  } else if (quoteLoading) {
    primaryLabel = 'Preparing price…';
    busy = true;
  } else if (actionPending) {
    phase = 'awaiting_signature';
    primaryLabel = 'Sign register in wallet…';
    step = 'action';
    busy = true;
  } else if (actionConfirming) {
    phase = 'confirming';
    primaryLabel = `Registering ${requestedName}…`;
    step = 'action';
    busy = true;
  } else if (isSuccess) {
    phase = 'success';
    primaryLabel = `${requestedName}.rise registered`;
  } else if (errorMessage) {
    phase = 'error';
    primaryLabel = 'Try again';
  }

  const primary = () => {
    if (errorMessage) {
      resetAction();
    }
    if (!isConnected) return;
    if (onWrongChain) {
      switchChain({ chainId: riseMainnet.id });
      return;
    }
    if (!ready) return;

    if (!signedQuote || !signature) return;
    register({
      name: requestedName,
      duration: registrationDuration,
      value: registerPrice,
      quote: signedQuote,
      signature,
    });
  };

  return {
    phase,
    step,
    primaryLabel,
    errorMessage,
    approveHash: undefined,
    actionHash,
    ready,
    busy,
    primary,
    nameRegistration: {
      name: requestedName,
      availability: statusLoading ? 'checking' : reserved ? 'reserved' : available ? 'available' : 'taken',
      durationYears,
      setDurationYears,
      options: durationOptions,
      selectedPriceEth: registerPrice > 0n ? formatEthPrice(registerPrice) : null,
      selectedTotalUsd: formatUsdPrice(display?.totalUsd),
      quoteLoading,
    },
  };
}
