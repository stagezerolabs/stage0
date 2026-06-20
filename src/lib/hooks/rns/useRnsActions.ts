import { useRnsContracts } from "@/lib/hooks/rns/useRnsContracts";
import { useRnsNode } from "@/lib/hooks/rns/useRnsNode";
import { RNSMarketplaceEscrow, RNSRegistrar, RNSRegistry, RNSResolver } from "@/lib/rns/abis";
import { RNS_DEFAULT_REGISTRATION_DURATION } from "@/lib/rns/constants";
import type {
  RnsCreateMarketplaceAuctionParams,
  RnsCreateMarketplaceListingParams,
  RnsBuyMarketplaceListingParams,
  RnsBidMarketplaceAuctionParams,
  RnsRegisterParams,
  RnsReleaseParams,
  RnsRenewParams,
  RnsSettleMarketplaceAuctionParams,
  RnsSetAddrParams,
  RnsSetResolverParams,
} from "@/lib/rns/types";
import { normalizeRnsLabel } from "@/lib/rns/utils";
import { useCallback } from "react";
import { useTrackedWriteContract } from "@/lib/hooks/useTrackedWriteContract";

function useRnsWrite() {
  const { hash, writeContract, isPending, isConfirming, isSuccess, error, reset } =
    useTrackedWriteContract();

  return { hash, writeContract, isPending, isConfirming, isSuccess, error, reset };
}

export function useRnsRegister() {
  const { registrar } = useRnsContracts();
  const write = useRnsWrite();

  const register = useCallback(
    (params: RnsRegisterParams) => {
      const name = normalizeRnsLabel(params.name);
      const duration = params.duration ?? RNS_DEFAULT_REGISTRATION_DURATION;

      write.writeContract({
        address: registrar,
        abi: RNSRegistrar,
        functionName: "register",
        args: [name, duration, params.resolver ?? "0x0000000000000000000000000000000000000000", params.quote, params.signature],
        value: params.value ?? params.quote.priceWei,
      });
    },
    [registrar, write],
  );

  return { ...write, register };
}

export function useRnsRenew() {
  const { registrar } = useRnsContracts();
  const write = useRnsWrite();

  const renew = useCallback(
    (params: RnsRenewParams) => {
      const name = normalizeRnsLabel(params.name);
      const duration = params.duration ?? RNS_DEFAULT_REGISTRATION_DURATION;

      write.writeContract({
        address: registrar,
        abi: RNSRegistrar,
        functionName: "renew",
        args: [name, duration, params.quote, params.signature],
        value: params.value ?? params.quote.priceWei,
      });
    },
    [registrar, write],
  );

  return { ...write, renew };
}

export function useRnsRelease() {
  const { registrar } = useRnsContracts();
  const write = useRnsWrite();

  const release = useCallback(
    (params: RnsReleaseParams) => {
      const name = normalizeRnsLabel(params.name);
      write.writeContract({
        address: registrar,
        abi: RNSRegistrar,
        functionName: "release",
        args: [name],
      });
    },
    [registrar, write],
  );

  return { ...write, release };
}

export function useRnsCreateMarketplaceAuction() {
  const { marketplace } = useRnsContracts();
  const write = useRnsWrite();

  const createAuction = useCallback(
    (params: RnsCreateMarketplaceAuctionParams) => {
      const name = normalizeRnsLabel(params.name);
      write.writeContract({
        address: marketplace,
        abi: RNSMarketplaceEscrow,
        functionName: "createAuction",
        args: [
          name,
          params.reservePrice,
          BigInt(params.minIncrementBps),
          params.startTime,
          params.endTime,
        ],
      });
    },
    [marketplace, write],
  );

  return { ...write, createAuction };
}

export function useRnsCreateMarketplaceListing() {
  const { marketplace } = useRnsContracts();
  const write = useRnsWrite();

  const createListing = useCallback(
    (params: RnsCreateMarketplaceListingParams) => {
      const name = normalizeRnsLabel(params.name);
      write.writeContract({
        address: marketplace,
        abi: RNSMarketplaceEscrow,
        functionName: "createListing",
        args: [name, params.price],
      });
    },
    [marketplace, write],
  );

  return { ...write, createListing };
}

export function useRnsBuyMarketplaceListing() {
  const { marketplace } = useRnsContracts();
  const write = useRnsWrite();

  const buyListing = useCallback(
    (params: RnsBuyMarketplaceListingParams) => {
      write.writeContract({
        address: marketplace,
        abi: RNSMarketplaceEscrow,
        functionName: "buy",
        args: [params.listingId],
        value: params.price,
      });
    },
    [marketplace, write],
  );

  return { ...write, buyListing };
}

export function useRnsBidMarketplaceAuction() {
  const { marketplace } = useRnsContracts();
  const write = useRnsWrite();

  const bidAuction = useCallback(
    (params: RnsBidMarketplaceAuctionParams) => {
      write.writeContract({
        address: marketplace,
        abi: RNSMarketplaceEscrow,
        functionName: "bid",
        args: [params.auctionId],
        value: params.amount,
      });
    },
    [marketplace, write],
  );

  return { ...write, bidAuction };
}

export function useRnsSettleMarketplaceAuction() {
  const { marketplace } = useRnsContracts();
  const write = useRnsWrite();

  const settleAuction = useCallback(
    (params: RnsSettleMarketplaceAuctionParams) => {
      write.writeContract({
        address: marketplace,
        abi: RNSMarketplaceEscrow,
        functionName: "settleAuction",
        args: [params.auctionId],
      });
    },
    [marketplace, write],
  );

  return { ...write, settleAuction };
}

export function useRnsWithdrawMarketplaceReturns() {
  const { marketplace } = useRnsContracts();
  const write = useRnsWrite();

  const withdrawMarketplaceReturns = useCallback(() => {
    write.writeContract({
      address: marketplace,
      abi: RNSMarketplaceEscrow,
      functionName: "withdraw",
      args: [],
    });
  }, [marketplace, write]);

  return { ...write, withdrawMarketplaceReturns };
}

export function useRnsSetResolver(label: string) {
  const { registry } = useRnsContracts();
  const { node } = useRnsNode(label);
  const write = useRnsWrite();

  const setResolver = useCallback(
    (params: Omit<RnsSetResolverParams, "name">) => {
      if (!node) return;
      write.writeContract({
        address: registry,
        abi: RNSRegistry,
        functionName: "setResolver",
        args: [node, params.resolver],
      });
    },
    [node, registry, write],
  );

  return { ...write, setResolver, node };
}

export function useRnsSetAddr(label: string, resolverAddress?: `0x${string}`) {
  const { resolver: defaultResolver } = useRnsContracts();
  const { node } = useRnsNode(label);
  const write = useRnsWrite();

  const setAddr = useCallback(
    (params: Omit<RnsSetAddrParams, "name">) => {
      if (!node) return;
      const resolver = resolverAddress ?? defaultResolver;
      write.writeContract({
        address: resolver,
        abi: RNSResolver,
        functionName: "setAddr",
        args: [node, params.addr],
      });
    },
    [defaultResolver, node, resolverAddress, write],
  );

  return { ...write, setAddr, node };
}

export function useRnsSetText(label: string, resolverAddress?: `0x${string}`) {
  const { resolver: defaultResolver } = useRnsContracts();
  const { node } = useRnsNode(label);
  const write = useRnsWrite();

  const setText = useCallback(
    (key: string, value: string) => {
      if (!node) return;
      const resolver = resolverAddress ?? defaultResolver;
      write.writeContract({
        address: resolver,
        abi: RNSResolver,
        functionName: "setText",
        args: [node, key, value],
      });
    },
    [defaultResolver, node, resolverAddress, write],
  );

  return { ...write, setText, node };
}

export function useRnsRegistrySetOwner(label: string) {
  const { registry } = useRnsContracts();
  const { node } = useRnsNode(label);
  const write = useRnsWrite();

  const setOwner = useCallback(
    (owner: `0x${string}`) => {
      if (!node) return;
      write.writeContract({
        address: registry,
        abi: RNSRegistry,
        functionName: "setOwner",
        args: [node, owner],
      });
    },
    [node, registry, write],
  );

  return { ...write, setOwner, node };
}
