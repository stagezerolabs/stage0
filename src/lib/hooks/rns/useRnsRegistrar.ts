import { useRnsContracts } from "@/lib/hooks/rns/useRnsContracts";
import { RNSRegistrar } from "@/lib/rns/abis";
import { fetchRnsPriceQuote } from "@/lib/api/rns";
import {
  RNS_DEFAULT_REGISTRATION_DURATION,
  RNS_LABEL_POLICY_FIXED_PREMIUM,
  RNS_LABEL_POLICY_OPEN,
  RNS_QUERY_GC_TIME,
  RNS_QUERY_STALE_TIME,
} from "@/lib/rns/constants";
import { normalizeRnsLabel } from "@/lib/rns/utils";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useChainId, useReadContract, useReadContracts } from "wagmi";

type UseRnsRegistrarOptions = {
  enabled?: boolean;
  duration?: bigint;
  action?: "register" | "renew" | "fixed_premium_register";
};

export function useRnsAvailable(label: string, options: UseRnsRegistrarOptions = {}) {
  const { registrar } = useRnsContracts();
  const name = normalizeRnsLabel(label);
  const enabled = (options.enabled ?? true) && Boolean(name);

  const { data, isLoading, error, refetch } = useReadContract({
    address: registrar,
    abi: RNSRegistrar,
    functionName: "available",
    args: [name],
    query: {
      enabled,
      staleTime: RNS_QUERY_STALE_TIME,
      gcTime: RNS_QUERY_GC_TIME,
    },
  });

  return {
    available: data === true,
    isLoading,
    error,
    refetch,
  };
}

export function useRnsEffectivePolicy(label: string, options: UseRnsRegistrarOptions = {}) {
  const { registrar } = useRnsContracts();
  const name = normalizeRnsLabel(label);
  const enabled = (options.enabled ?? true) && Boolean(name);

  const { data, isLoading, error, refetch } = useReadContract({
    address: registrar,
    abi: RNSRegistrar,
    functionName: "effectivePolicy",
    args: [name],
    query: {
      enabled,
      staleTime: RNS_QUERY_STALE_TIME,
      gcTime: RNS_QUERY_GC_TIME,
    },
  });
  const policy = data === undefined ? undefined : Number(data);

  return {
    policy,
    isReserved: policy !== undefined && policy !== RNS_LABEL_POLICY_OPEN,
    isLoading,
    error,
    refetch,
  };
}

export function useRnsFee(options: UseRnsRegistrarOptions = {}) {
  const duration = options.duration ?? RNS_DEFAULT_REGISTRATION_DURATION;

  return {
    price: 0n,
    duration,
    isLoading: false,
    error: null,
    refetch: async () => ({ data: 0n }),
  };
}

/** @deprecated Use `useRnsFee` */
export function useRnsRentPrice(_label: string, options: UseRnsRegistrarOptions = {}) {
  return useRnsFee(options);
}

export function useRnsExpiry(label: string, options: UseRnsRegistrarOptions = {}) {
  const { registrar } = useRnsContracts();
  const name = normalizeRnsLabel(label);
  const enabled = (options.enabled ?? true) && Boolean(name);

  const { data, isLoading, error, refetch } = useReadContract({
    address: registrar,
    abi: RNSRegistrar,
    functionName: "expiryOf",
    args: [name],
    query: {
      enabled,
      staleTime: RNS_QUERY_STALE_TIME,
      gcTime: RNS_QUERY_GC_TIME,
    },
  });

  return {
    expiry: data ?? 0n,
    isLoading,
    error,
    refetch,
  };
}

export function useRnsRegistrarConfig() {
  const { registrar } = useRnsContracts();

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      {
        address: registrar,
        abi: RNSRegistrar,
        functionName: "PUBLIC_MIN_NAME_LENGTH",
      },
      {
        address: registrar,
        abi: RNSRegistrar,
        functionName: "MAX_NAME_LENGTH",
      },
      {
        address: registrar,
        abi: RNSRegistrar,
        functionName: "YEAR",
      },
      {
        address: registrar,
        abi: RNSRegistrar,
        functionName: "priceSigner",
      },
    ],
    query: {
      staleTime: RNS_QUERY_STALE_TIME,
      gcTime: RNS_QUERY_GC_TIME,
    },
  });

  return {
    minNameLength: (data?.[0]?.result as bigint | undefined) ?? 3n,
    maxNameLength: (data?.[1]?.result as bigint | undefined) ?? 32n,
    minDuration: (data?.[2]?.result as bigint | undefined) ?? 0n,
    registrationFee: 0n,
    priceSigner: data?.[3]?.result as `0x${string}` | undefined,
    isLoading,
    error,
    refetch,
  };
}

/** Availability + registration fee for mint UI. */
export function useRnsRegistrationQuote(
  label: string,
  options: UseRnsRegistrarOptions = {},
) {
  const { registrar } = useRnsContracts();
  const { address } = useAccount();
  const chainId = useChainId();
  const name = normalizeRnsLabel(label);
  const duration = options.duration ?? RNS_DEFAULT_REGISTRATION_DURATION;
  const action = options.action ?? "register";
  const enabled = (options.enabled ?? true) && Boolean(name);

  const {
    data: available,
    isLoading: isAvailabilityLoading,
    error: availabilityError,
    refetch: refetchAvailability,
  } = useReadContract({
    address: registrar,
    abi: RNSRegistrar,
    functionName: "available",
    args: [name],
    query: {
      enabled,
      staleTime: RNS_QUERY_STALE_TIME,
      gcTime: RNS_QUERY_GC_TIME,
    },
  });
  const {
    data: policy,
    isLoading: isPolicyLoading,
    error: policyError,
    refetch: refetchPolicy,
  } = useReadContract({
    address: registrar,
    abi: RNSRegistrar,
    functionName: "effectivePolicy",
    args: [name],
    query: {
      enabled: enabled && action !== "renew",
      staleTime: RNS_QUERY_STALE_TIME,
      gcTime: RNS_QUERY_GC_TIME,
    },
  });
  const policyAllowsAction =
    action === "renew" ||
    (action === "register" && Number(policy) === RNS_LABEL_POLICY_OPEN) ||
    (action === "fixed_premium_register" && Number(policy) === RNS_LABEL_POLICY_FIXED_PREMIUM);

  const quote = useQuery({
    queryKey: ["rns", "quote", action, chainId, address, name, duration.toString()],
    queryFn: () =>
      fetchRnsPriceQuote({
        action,
        name,
        beneficiary: address!,
        chainId,
        duration,
      }),
    enabled:
      enabled &&
      Boolean(address) &&
      policyAllowsAction &&
      (action === "renew" || available === true),
    staleTime: 45_000,
    gcTime: RNS_QUERY_GC_TIME,
  });

  return {
    name,
    duration,
    available: available === true && (action === "renew" || policyAllowsAction),
    policy: policy === undefined ? undefined : Number(policy),
    isReserved:
      action !== "renew" && policy !== undefined && Number(policy) !== RNS_LABEL_POLICY_OPEN,
    price: quote.data?.price ?? 0n,
    signedQuote: quote.data?.signedQuote,
    signature: quote.data?.signature,
    display: quote.data?.display,
    isLoading: isAvailabilityLoading || (action !== "renew" && isPolicyLoading) || quote.isLoading,
    error: availabilityError ?? policyError ?? quote.error,
    refetch: async () => {
      await Promise.all([refetchAvailability(), refetchPolicy(), quote.refetch()]);
    },
  };
}
