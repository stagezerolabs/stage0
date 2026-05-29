import { useRnsContracts } from "@/lib/hooks/rns/useRnsContracts";
import { RNSRegistrar } from "@/lib/rns/abis";
import {
  RNS_DEFAULT_REGISTRATION_DURATION,
  RNS_QUERY_GC_TIME,
  RNS_QUERY_STALE_TIME,
} from "@/lib/rns/constants";
import { normalizeRnsLabel } from "@/lib/rns/utils";
import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";

type UseRnsRegistrarOptions = {
  enabled?: boolean;
  duration?: bigint;
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

export function useRnsFee(options: UseRnsRegistrarOptions = {}) {
  const { registrar } = useRnsContracts();
  const duration = options.duration ?? RNS_DEFAULT_REGISTRATION_DURATION;

  const { data, isLoading, error, refetch } = useReadContract({
    address: registrar,
    abi: RNSRegistrar,
    functionName: "feeFor",
    args: [duration],
    query: {
      enabled: options.enabled ?? true,
      staleTime: RNS_QUERY_STALE_TIME,
      gcTime: RNS_QUERY_GC_TIME,
    },
  });

  return {
    price: data ?? 0n,
    duration,
    isLoading,
    error,
    refetch,
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
        functionName: "MIN_NAME_LENGTH",
      },
      {
        address: registrar,
        abi: RNSRegistrar,
        functionName: "MAX_NAME_LENGTH",
      },
      {
        address: registrar,
        abi: RNSRegistrar,
        functionName: "MIN_DURATION",
      },
      {
        address: registrar,
        abi: RNSRegistrar,
        functionName: "registrationFee",
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
    registrationFee: (data?.[3]?.result as bigint | undefined) ?? 0n,
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
  const name = normalizeRnsLabel(label);
  const duration = options.duration ?? RNS_DEFAULT_REGISTRATION_DURATION;
  const enabled = (options.enabled ?? true) && Boolean(name);

  const contracts = useMemo(
    () => [
      {
        address: registrar,
        abi: RNSRegistrar,
        functionName: "available" as const,
        args: [name] as const,
      },
      {
        address: registrar,
        abi: RNSRegistrar,
        functionName: "feeFor" as const,
        args: [duration] as const,
      },
    ],
    [duration, name, registrar],
  );

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts,
    query: {
      enabled,
      staleTime: RNS_QUERY_STALE_TIME,
      gcTime: RNS_QUERY_GC_TIME,
    },
  });

  return {
    name,
    duration,
    available: data?.[0]?.result === true,
    price: (data?.[1]?.result as bigint | undefined) ?? 0n,
    isLoading,
    error,
    refetch,
  };
}
