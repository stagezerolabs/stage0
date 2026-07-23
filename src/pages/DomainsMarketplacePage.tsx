import NamesSubnav from "@/components/rns/NamesSubnav";
import { Search, View } from "@/components/ui/icons";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { InlineLoading, LoadingState, Spinner } from "@/components/ui/spinner";
import {
  fetchRnsMarketplaceAuctions,
  fetchRnsMarketplaceListings,
  fetchRnsMarketplaceReserved,
  fetchRnsNameResolution,
  fetchRnsPrimaryAuctions,
  fetchRnsPricing,
  subscribeRnsMarketplaceNotifications,
  type RnsMarketplaceAuctionSummary,
  type RnsMarketplaceListingSummary,
  type RnsPrimaryAuctionSummary,
  type RnsPricingSummary,
  type RnsReservedNameSummary,
  type RnsReservedSaleMode,
} from "@/lib/api/rns";
import { RNSAuctionHouse, RNSMarketplaceEscrow } from "@/lib/rns/abis";
import {
  useRnsApproveForAll,
  useRnsBidPrimaryAuction,
  useRnsBidMarketplaceAuction,
  useRnsBuyMarketplaceListing,
  useRnsCancelMarketplaceAuction,
  useRnsCancelMarketplaceListing,
  useRnsContracts,
  useRnsCreateMarketplaceAuction,
  useRnsCreateMarketplaceListing,
  useRnsIsApproved,
  useRnsOwnedLabel,
  useRnsRegisterFixedPremium,
  useRnsRegistrationQuote,
  useRnsSettlePrimaryAuction,
  useRnsSettleMarketplaceAuction,
  useRnsWithdrawMarketplaceReturns,
  useRnsWithdrawMarketplaceProceeds,
  useRnsWithdrawPrimaryAuctionReturns,
} from "@/lib/hooks/rns";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatEther, parseEther, type Address, type Hex } from "viem";
import { useAccount, useReadContract } from "wagmi";

type ListingKind = "auction" | "buy-now";
type SaleMethod = "auction" | "buy-now";
type AuctionSource = "primary" | "marketplace";
type AnyAuctionSummary = RnsMarketplaceAuctionSummary | RnsPrimaryAuctionSummary;

type MarketCard =
  | {
      kind: "auction";
      source: AuctionSource;
      id: string;
      label: string;
      length: number;
      seller: string;
      status: string;
      priceWei: bigint;
      bids: number;
      startsAt: bigint;
      endsAt: bigint;
      raw: AnyAuctionSummary;
    }
  | {
      kind: "buy-now";
      id: string;
      label: string;
      length: number;
      seller: string;
      status: string;
      priceWei: bigint;
      raw: RnsMarketplaceListingSummary;
    }
  | {
      kind: "reserved";
      id: string;
      label: string;
      length: number;
      status: "upcoming";
      priceWei: bigint;
      saleMode: RnsReservedSaleMode;
      raw: RnsReservedNameSummary;
    };

type NotifyModalState =
  | {
      kind: "create-auction";
      name: string;
      node: Hex | null;
      reserveEth: string;
      days: string;
    }
  | {
      kind: "create-listing";
      name: string;
      node: Hex | null;
      priceEth: string;
    }
  | {
      kind: "bid-auction";
      source: AuctionSource;
      auction: AnyAuctionSummary;
    }
  | {
      kind: "watch-auction";
      source: AuctionSource;
      auction: AnyAuctionSummary;
    }
  | {
      kind: "watch-reserved";
      reserved: RnsReservedNameSummary;
    };

type DetailSheetState =
  | {
      kind: "auction";
      source: AuctionSource;
      auction: AnyAuctionSummary;
    }
  | {
      kind: "listing";
      listing: RnsMarketplaceListingSummary;
    }
  | {
      kind: "reserved";
      reserved: RnsReservedNameSummary;
    };

type PendingNotificationIntent = {
  chainId: number;
  scope: "marketplace_seller" | "marketplace_bidder" | "marketplace_watcher";
  email: string;
  wallet?: Address | null;
  name?: string | null;
  node?: Hex | null;
  auctionId?: bigint | null;
  listingId?: bigint | null;
};

function formatEthCompact(value: bigint) {
  const numeric = Number(formatEther(value));
  if (!Number.isFinite(numeric)) return "0";
  if (numeric >= 1) return numeric.toFixed(2);
  if (numeric >= 0.01) return numeric.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return numeric.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function formatUsd(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "USD loading";
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortSeller(value: string) {
  return value.endsWith(".rise") ? value : `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function reservedPriceWei(reserved: RnsReservedNameSummary) {
  return reserved.saleMode === "buy_now" ? reserved.fixedPriceWei : reserved.reservePriceWei;
}

function reservedListingKind(reserved: RnsReservedNameSummary): ListingKind {
  return reserved.saleMode === "buy_now" ? "buy-now" : "auction";
}

function reservedSaleLabel(reserved: RnsReservedNameSummary) {
  return reserved.saleMode === "buy_now" ? "Fixed price" : "Auction";
}

function cardSaleKind(card: MarketCard): ListingKind {
  return card.kind === "reserved" ? reservedListingKind(card.raw) : card.kind;
}

function formatTimeLeft(targetUnix: bigint, nowUnix: number) {
  const diff = Number(targetUnix) - nowUnix;
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
  if (days > 0) return `${days}d ${String(hours).padStart(2, "0")}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function auctionRuntimeStatus(auction: AnyAuctionSummary, nowUnix: number) {
  if (auction.status === "settled" || auction.status === "cancelled") return auction.status;
  if (nowUnix < Number(auction.startTime)) return "scheduled";
  if (nowUnix < Number(auction.endTime)) return "active";
  return "ended";
}

function cardStatusLabel(card: MarketCard, nowUnix: number) {
  if (card.kind === "reserved") {
    return card.saleMode === "buy_now" ? "Fixed price" : "0 bids";
  }
  if (card.kind === "buy-now") return "Instant sale";
  const status = auctionRuntimeStatus(card.raw, nowUnix);
  if (status === "scheduled") return `Starts ${formatTimeLeft(card.startsAt, nowUnix)}`;
  if (status === "ended") return card.bids === 0 ? "Ended · No bids" : "Ready to finalize";
  if (status === "settled") return "Settled";
  if (status === "cancelled") return "Cancelled";
  return `${card.bids} bid${card.bids === 1 ? "" : "s"}`;
}

function cardRank(card: MarketCard) {
  return card.kind === "reserved" ? card.raw.displayOrder : Number.MAX_SAFE_INTEGER;
}

type AuctionMarketCard = Extract<MarketCard, { kind: "auction" }>;
type ListingMarketCard = Extract<MarketCard, { kind: "buy-now" }>;
type ReservedMarketCard = Extract<MarketCard, { kind: "reserved" }>;

function auctionToMarketCard(auction: RnsMarketplaceAuctionSummary): AuctionMarketCard {
  return {
    kind: "auction",
    source: "marketplace",
    id: `auction-${auction.auctionId.toString()}`,
    label: auction.name,
    length: auction.name.length,
    seller: shortSeller(auction.seller),
    status: auction.status,
    priceWei: auction.highestBid > 0n ? auction.highestBid : auction.reservePrice,
    bids: auction.bidCount,
    startsAt: auction.startTime,
    endsAt: auction.endTime,
    raw: auction,
  };
}

function primaryAuctionToMarketCard(auction: RnsPrimaryAuctionSummary): AuctionMarketCard {
  return {
    kind: "auction",
    source: "primary",
    id: `primary-auction-${auction.auctionId.toString()}`,
    label: auction.name,
    length: auction.name.length,
    seller: "Primary market",
    status: auction.status,
    priceWei: auction.highestBid > 0n ? auction.highestBid : auction.reservePrice,
    bids: auction.bidCount,
    startsAt: auction.startTime,
    endsAt: auction.endTime,
    raw: auction,
  };
}

function isMarketplaceAuction(auction: AnyAuctionSummary): auction is RnsMarketplaceAuctionSummary {
  return "node" in auction;
}

function auctionActionKey(source: AuctionSource, auction: AnyAuctionSummary) {
  return `${source}:${auction.auctionId.toString()}`;
}

function listingActionKey(listing: RnsMarketplaceListingSummary) {
  return `listing:${listing.listingId.toString()}`;
}

function auctionSettlementLabel(
  auction: AnyAuctionSummary,
  source: AuctionSource,
  address?: Address,
) {
  const connectedAddress = address?.toLowerCase();
  const isSeller =
    source === "marketplace" &&
    isMarketplaceAuction(auction) &&
    connectedAddress === auction.seller.toLowerCase();

  if (auction.bidCount === 0) return isSeller ? "Reclaim name" : "Close auction";
  if (connectedAddress && connectedAddress === auction.highestBidder?.toLowerCase()) return "Claim name";
  return isSeller ? "Finalize sale" : "Finalize auction";
}

function auctionSettlementLoadingLabel(label: string) {
  if (label === "Claim name") return "Claiming...";
  if (label === "Reclaim name") return "Reclaiming...";
  if (label === "Close auction") return "Closing...";
  return "Finalizing...";
}

function listingToMarketCard(listing: RnsMarketplaceListingSummary): ListingMarketCard {
  return {
    kind: "buy-now",
    id: `listing-${listing.listingId.toString()}`,
    label: listing.name,
    length: listing.name.length,
    seller: shortSeller(listing.seller),
    status: listing.status,
    priceWei: listing.price,
    raw: listing,
  };
}

function reservedToMarketCard(reserved: RnsReservedNameSummary): ReservedMarketCard {
  return {
    kind: "reserved",
    id: `reserved-${reserved.chainId}-${reserved.id}`,
    label: reserved.label,
    length: reserved.label.length,
    status: "upcoming",
    priceWei: reservedPriceWei(reserved) ?? 0n,
    saleMode: reserved.saleMode,
    raw: reserved,
  };
}

async function persistNotificationIntent(intent: PendingNotificationIntent | null) {
  if (!intent?.email.trim()) return;
  try {
    await subscribeRnsMarketplaceNotifications({
      ...intent,
      email: intent.email.trim(),
    });
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}

function DomainsMarketplacePage() {
  const { address, isConnected } = useAccount();
  const { auctionHouse, chainId, marketplace } = useRnsContracts();
  const { allDomains } = useRnsOwnedLabel(address);
  const { isApproved, refetch: refetchApproval } = useRnsIsApproved(address, marketplace);

  const {
    approve,
    isPending: isApprovalPending,
    isConfirming: isApprovalConfirming,
    isSuccess: isApprovalSuccess,
    error: approvalError,
    reset: resetApproval,
  } = useRnsApproveForAll(marketplace);

  const {
    createAuction,
    isPending: isCreateAuctionPending,
    isConfirming: isCreateAuctionConfirming,
    isSuccess: isCreateAuctionSuccess,
    error: createAuctionError,
    reset: resetCreateAuction,
  } = useRnsCreateMarketplaceAuction();

  const {
    createListing,
    isPending: isCreateListingPending,
    isConfirming: isCreateListingConfirming,
    isSuccess: isCreateListingSuccess,
    error: createListingError,
    reset: resetCreateListing,
  } = useRnsCreateMarketplaceListing();

  const {
    buyListing,
    isPending: isBuyListingPending,
    isConfirming: isBuyListingConfirming,
    isSuccess: isBuyListingSuccess,
    error: buyListingError,
    reset: resetBuyListing,
  } = useRnsBuyMarketplaceListing();

  const {
    cancelListing,
    isPending: isCancelListingPending,
    isConfirming: isCancelListingConfirming,
    isSuccess: isCancelListingSuccess,
    error: cancelListingError,
    reset: resetCancelListing,
  } = useRnsCancelMarketplaceListing();

  const {
    bidAuction,
    isPending: isBidAuctionPending,
    isConfirming: isBidAuctionConfirming,
    isSuccess: isBidAuctionSuccess,
    error: bidAuctionError,
    reset: resetBidAuction,
  } = useRnsBidMarketplaceAuction();

  const {
    bidPrimaryAuction,
    isPending: isBidPrimaryPending,
    isConfirming: isBidPrimaryConfirming,
    isSuccess: isBidPrimarySuccess,
    error: bidPrimaryError,
    reset: resetBidPrimary,
  } = useRnsBidPrimaryAuction();

  const {
    settleAuction,
    isPending: isSettleAuctionPending,
    isConfirming: isSettleAuctionConfirming,
    isSuccess: isSettleAuctionSuccess,
    error: settleAuctionError,
    reset: resetSettleAuction,
  } = useRnsSettleMarketplaceAuction();

  const {
    cancelAuction,
    isPending: isCancelAuctionPending,
    isConfirming: isCancelAuctionConfirming,
    isSuccess: isCancelAuctionSuccess,
    error: cancelAuctionError,
    reset: resetCancelAuction,
  } = useRnsCancelMarketplaceAuction();

  const {
    settlePrimaryAuction,
    isPending: isSettlePrimaryPending,
    isConfirming: isSettlePrimaryConfirming,
    isSuccess: isSettlePrimarySuccess,
    error: settlePrimaryError,
    reset: resetSettlePrimary,
  } = useRnsSettlePrimaryAuction();

  const {
    registerFixedPremium,
    isPending: isFixedPremiumPending,
    isConfirming: isFixedPremiumConfirming,
    isSuccess: isFixedPremiumSuccess,
    error: fixedPremiumError,
    reset: resetFixedPremium,
  } = useRnsRegisterFixedPremium();

  const {
    withdrawMarketplaceReturns,
    isPending: isWithdrawPending,
    isConfirming: isWithdrawConfirming,
    isSuccess: isWithdrawSuccess,
    error: withdrawError,
    reset: resetWithdraw,
  } = useRnsWithdrawMarketplaceReturns();

  const {
    withdrawMarketplaceProceeds,
    isPending: isWithdrawProceedsPending,
    isConfirming: isWithdrawProceedsConfirming,
    isSuccess: isWithdrawProceedsSuccess,
    error: withdrawProceedsError,
    reset: resetWithdrawProceeds,
  } = useRnsWithdrawMarketplaceProceeds();

  const {
    withdrawPrimaryAuctionReturns,
    isPending: isWithdrawPrimaryPending,
    isConfirming: isWithdrawPrimaryConfirming,
    isSuccess: isWithdrawPrimarySuccess,
    error: withdrawPrimaryError,
    reset: resetWithdrawPrimary,
  } = useRnsWithdrawPrimaryAuctionReturns();

  const [kind, setKind] = useState<"all" | ListingKind>("all");
  const [lengthFilter, setLengthFilter] = useState<"all" | "2" | "3" | "4" | "5">("all");
  const [sort, setSort] = useState("hot");
  const [query, setQuery] = useState("");
  const [pricing, setPricing] = useState<RnsPricingSummary | null>(null);
  const [liveListings, setLiveListings] = useState<RnsMarketplaceListingSummary[]>([]);
  const [primaryAuctions, setPrimaryAuctions] = useState<RnsPrimaryAuctionSummary[]>([]);
  const [liveAuctions, setLiveAuctions] = useState<RnsMarketplaceAuctionSummary[]>([]);
  const [reservedDomains, setReservedDomains] = useState<RnsReservedNameSummary[]>([]);
  const [isLoadingMarket, setIsLoadingMarket] = useState(true);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [marketRefreshNonce, setMarketRefreshNonce] = useState(0);
  const [nowUnix, setNowUnix] = useState(() => Math.floor(Date.now() / 1000));
  const [saleMethod, setSaleMethod] = useState<SaleMethod>("auction");
  const [selectedOwnedName, setSelectedOwnedName] = useState("");
  const [reserveEth, setReserveEth] = useState("0.05");
  const [auctionDays, setAuctionDays] = useState("3");
  const [fixedPriceEth, setFixedPriceEth] = useState("0.05");
  const [notifyModal, setNotifyModal] = useState<NotifyModalState | null>(null);
  const [detailSheet, setDetailSheet] = useState<DetailSheetState | null>(null);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [bidAmountEth, setBidAmountEth] = useState("");
  const [pendingAuctionSubscription, setPendingAuctionSubscription] = useState<PendingNotificationIntent | null>(null);
  const [pendingListingSubscription, setPendingListingSubscription] = useState<PendingNotificationIntent | null>(null);
  const [pendingBidSubscription, setPendingBidSubscription] = useState<PendingNotificationIntent | null>(null);
  const [pendingMarketActionName, setPendingMarketActionName] = useState<string | null>(null);
  const [pendingBidAuctionKey, setPendingBidAuctionKey] = useState<string | null>(null);
  const [pendingSettlementAuctionKey, setPendingSettlementAuctionKey] = useState<string | null>(null);
  const [pendingListingPurchaseId, setPendingListingPurchaseId] = useState<string | null>(null);
  const [pendingCancellationKey, setPendingCancellationKey] = useState<string | null>(null);

  const ownedNames = useMemo(
    () => allDomains.filter((domain) => Boolean(domain.label) && (domain.custody ?? "wallet") === "wallet"),
    [allDomains],
  );

  const selectedOwnedDomain = useMemo(
    () => ownedNames.find((domain) => domain.label === selectedOwnedName) ?? null,
    [ownedNames, selectedOwnedName],
  );

  const ethUsd = pricing?.ethUsd ?? null;
  const reserveUsd = Number(reserveEth) > 0 && ethUsd ? Number(reserveEth) * ethUsd : null;
  const fixedPriceUsd = Number(fixedPriceEth) > 0 && ethUsd ? Number(fixedPriceEth) * ethUsd : null;
  const fixedReservedInView =
    detailSheet?.kind === "reserved" && detailSheet.reserved.saleMode === "buy_now"
      ? detailSheet.reserved
      : null;
  const fixedPremiumQuote = useRnsRegistrationQuote(fixedReservedInView?.label ?? "", {
    action: "fixed_premium_register",
    enabled: Boolean(isConnected && fixedReservedInView),
  });
  const isApprovalBusy = isApprovalPending || isApprovalConfirming;
  const isCreateAuctionBusy = isCreateAuctionPending || isCreateAuctionConfirming;
  const isCreateListingBusy = isCreateListingPending || isCreateListingConfirming;
  const isBuyListingBusy = isBuyListingPending || isBuyListingConfirming;
  const isCancelListingBusy = isCancelListingPending || isCancelListingConfirming;
  const isBidAuctionBusy = isBidAuctionPending || isBidAuctionConfirming || isBidPrimaryPending || isBidPrimaryConfirming;
  const isSettleAuctionBusy =
    isSettleAuctionPending || isSettleAuctionConfirming || isSettlePrimaryPending || isSettlePrimaryConfirming;
  const isCancelAuctionBusy = isCancelAuctionPending || isCancelAuctionConfirming;
  const isFixedPremiumBusy = isFixedPremiumPending || isFixedPremiumConfirming;
  const isWithdrawBusy = isWithdrawPending || isWithdrawConfirming;
  const isWithdrawProceedsBusy = isWithdrawProceedsPending || isWithdrawProceedsConfirming;
  const isWithdrawPrimaryBusy = isWithdrawPrimaryPending || isWithdrawPrimaryConfirming;

  const reservedMarketCards = useMemo(() => {
    const liveLabels = new Set(
      [
        ...liveAuctions
          .filter((auction) => !["cancelled", "settled"].includes(auction.status))
          .map((auction) => auction.name.toLowerCase()),
        ...primaryAuctions
          .filter((auction) => !["cancelled", "settled"].includes(auction.status))
          .map((auction) => auction.name.toLowerCase()),
        ...liveListings
          .filter((listing) => listing.status === "active")
          .map((listing) => listing.name.toLowerCase()),
      ],
    );

    return reservedDomains
      .filter((reserved) => reserved.enabled && reserved.saleMode === "buy_now" && !liveLabels.has(reserved.label.toLowerCase()))
      .sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label))
      .map(reservedToMarketCard);
  }, [liveAuctions, liveListings, primaryAuctions, reservedDomains]);

  const featuredShortCards = useMemo(() => {
    const activeAuctionCards = liveAuctions
      .filter((auction) => ["active", "scheduled"].includes(auction.status) && auction.name.length <= 4)
      .map(auctionToMarketCard);
    const activePrimaryAuctionCards = primaryAuctions
      .filter((auction) => ["active", "scheduled"].includes(auction.status) && auction.name.length <= 4)
      .map(primaryAuctionToMarketCard);
    const rankByLabel = new Map(
      reservedDomains.map((reserved) => [reserved.label.toLowerCase(), reserved.displayOrder]),
    );

    return [...reservedMarketCards.filter((card) => card.length <= 4), ...activePrimaryAuctionCards, ...activeAuctionCards]
      .sort((a, b) => {
        const aRank = rankByLabel.get(a.label.toLowerCase()) ?? cardRank(a);
        const bRank = rankByLabel.get(b.label.toLowerCase()) ?? cardRank(b);
        if (aRank !== bRank) return aRank - bRank;
        if (a.priceWei !== b.priceWei) return a.priceWei > b.priceWei ? -1 : 1;
        if (a.kind === "auction" && b.kind === "auction") {
          return Number(a.endsAt - b.endsAt);
        }
        return a.label.localeCompare(b.label);
      })
      .slice(0, 6);
  }, [liveAuctions, primaryAuctions, reservedDomains, reservedMarketCards]);

  const marketCards = useMemo(() => {
    const cards: MarketCard[] = [
      ...liveAuctions
        .filter((auction) => !["cancelled", "settled"].includes(auction.status))
        .map(auctionToMarketCard),
      ...primaryAuctions
        .filter((auction) => !["cancelled", "settled"].includes(auction.status))
        .map(primaryAuctionToMarketCard),
      ...liveListings
        .filter((listing) => listing.status === "active")
        .map(listingToMarketCard),
      ...reservedMarketCards.filter((card) => card.length > 4),
    ];

    let result = cards.filter((card) => {
      const kindMatch = kind === "all" || cardSaleKind(card) === kind;
      const lengthMatch =
        lengthFilter === "all" ||
        (lengthFilter === "5" ? card.length >= 5 : card.length === Number(lengthFilter));
      const queryMatch = !query || card.label.includes(query.toLowerCase());
      return kindMatch && lengthMatch && queryMatch;
    });

    if (sort === "price-low") {
      result = [...result].sort((a, b) => (a.priceWei < b.priceWei ? -1 : a.priceWei > b.priceWei ? 1 : 0));
    } else if (sort === "price-high") {
      result = [...result].sort((a, b) => (a.priceWei > b.priceWei ? -1 : a.priceWei < b.priceWei ? 1 : 0));
    } else if (sort === "ending") {
      result = [...result].sort((a, b) => {
        const aEnd = a.kind === "auction" ? Number(a.endsAt) : Number.MAX_SAFE_INTEGER;
        const bEnd = b.kind === "auction" ? Number(b.endsAt) : Number.MAX_SAFE_INTEGER;
        return aEnd - bEnd;
      });
    } else {
      result = [...result].sort((a, b) => {
        const aKind = cardSaleKind(a);
        const bKind = cardSaleKind(b);
        if (aKind !== bKind) return aKind === "auction" ? -1 : 1;
        if (a.kind === "auction" && b.kind === "auction") {
          if (a.status !== b.status) {
            const rank = (status: string) =>
              status === "active" ? 0 : status === "scheduled" ? 1 : status === "ended" ? 2 : 3;
            return rank(a.status) - rank(b.status);
          }
          return a.priceWei > b.priceWei ? -1 : a.priceWei < b.priceWei ? 1 : 0;
        }
        return a.priceWei > b.priceWei ? -1 : a.priceWei < b.priceWei ? 1 : 0;
      });
    }

    return result;
  }, [kind, lengthFilter, liveAuctions, liveListings, primaryAuctions, query, reservedMarketCards, sort]);

  const currentBidAuctionId =
    notifyModal?.kind === "bid-auction" ? notifyModal.auction.auctionId : undefined;
  const currentBidSource = notifyModal?.kind === "bid-auction" ? notifyModal.source : undefined;
  const { data: minimumNextBid } = useReadContract({
    address: currentBidSource === "primary" ? auctionHouse : marketplace,
    abi: currentBidSource === "primary" ? RNSAuctionHouse : RNSMarketplaceEscrow,
    functionName: "minimumNextBid",
    args: currentBidAuctionId !== undefined ? [currentBidAuctionId] : undefined,
    query: { enabled: currentBidAuctionId !== undefined },
  });
  const detailAuctionId = detailSheet?.kind === "auction" ? detailSheet.auction.auctionId : undefined;
  const detailAuctionSource = detailSheet?.kind === "auction" ? detailSheet.source : undefined;
  const { data: detailMinimumNextBid } = useReadContract({
    address: detailAuctionSource === "primary" ? auctionHouse : marketplace,
    abi: detailAuctionSource === "primary" ? RNSAuctionHouse : RNSMarketplaceEscrow,
    functionName: "minimumNextBid",
    args: detailAuctionId !== undefined ? [detailAuctionId] : undefined,
    query: { enabled: detailAuctionId !== undefined },
  });

  const { data: marketplacePendingReturns, refetch: refetchMarketplacePendingReturns } = useReadContract({
    address: marketplace,
    abi: RNSMarketplaceEscrow,
    functionName: "pendingReturns",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const { data: marketplaceClaimableProceeds, refetch: refetchMarketplaceClaimableProceeds } = useReadContract({
    address: marketplace,
    abi: RNSMarketplaceEscrow,
    functionName: "claimableProceeds",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const { data: primaryPendingReturns, refetch: refetchPrimaryPendingReturns } = useReadContract({
    address: auctionHouse,
    abi: RNSAuctionHouse,
    functionName: "pendingReturns",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowUnix(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadMarket = async (showSpinner: boolean) => {
      if (showSpinner) setIsLoadingMarket(true);
      try {
        const [nextPricing, nextListings, nextAuctions, nextPrimaryAuctions, nextReserved] = await Promise.all([
          fetchRnsPricing({ chainId }),
          fetchRnsMarketplaceListings({ chainId, limit: 100 }),
          fetchRnsMarketplaceAuctions({ chainId, limit: 100 }),
          fetchRnsPrimaryAuctions({ chainId, limit: 100 }),
          fetchRnsMarketplaceReserved({ chainId }),
        ]);

        if (cancelled) return;
        setPricing(nextPricing);
        setLiveListings(nextListings);
        setLiveAuctions(nextAuctions);
        setPrimaryAuctions(nextPrimaryAuctions);
        setReservedDomains(nextReserved);
        setMarketError(null);
      } catch (error) {
        if (cancelled) return;
        setMarketError(error instanceof Error ? error.message : "Failed to load marketplace");
      } finally {
        if (!cancelled) setIsLoadingMarket(false);
      }
    };

    void loadMarket(true);
    const interval = window.setInterval(() => {
      void loadMarket(false);
    }, 20_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [chainId, marketRefreshNonce]);

  useEffect(() => {
    if (!selectedOwnedName && ownedNames[0]?.label) {
      setSelectedOwnedName(ownedNames[0].label);
    }
  }, [ownedNames, selectedOwnedName]);

  useEffect(() => {
    if (notifyModal?.kind !== "bid-auction") return;
    if (minimumNextBid === undefined) return;
    setBidAmountEth(formatEthCompact(minimumNextBid));
  }, [minimumNextBid, notifyModal]);

  useEffect(() => {
    if (!isApprovalSuccess) return;
    toast.success("Marketplace approved for your RNS names.");
    void refetchApproval();
    resetApproval();
  }, [isApprovalSuccess, refetchApproval, resetApproval]);

  useEffect(() => {
    if (!approvalError) return;
    toast.error(approvalError.message.split("\n")[0] ?? "Marketplace approval failed.");
    resetApproval();
  }, [approvalError, resetApproval]);

  const refreshMarketAfterNameAction = (label: string | null) => {
    if (!label) {
      setMarketRefreshNonce((value) => value + 1);
      return;
    }

    void fetchRnsNameResolution({ name: label, chainId })
      .catch(() => null)
      .finally(() => {
        setMarketRefreshNonce((value) => value + 1);
      });
  };

  useEffect(() => {
    if (!isCreateAuctionSuccess) return;
    toast.success("Auction created. It should appear here as soon as Senna indexes it.");
    refreshMarketAfterNameAction(pendingMarketActionName);
    void persistNotificationIntent(pendingAuctionSubscription).catch((error) =>
      toast.error(error.message ?? "Could not save auction email updates."),
    );
    setPendingAuctionSubscription(null);
    setPendingMarketActionName(null);
    setNotifyEmail("");
    resetCreateAuction();
  }, [isCreateAuctionSuccess, pendingAuctionSubscription, pendingMarketActionName, resetCreateAuction]);

  useEffect(() => {
    if (!createAuctionError) return;
    toast.error(createAuctionError.message.split("\n")[0] ?? "Auction creation failed.");
    setPendingAuctionSubscription(null);
    setPendingMarketActionName(null);
    resetCreateAuction();
  }, [createAuctionError, resetCreateAuction]);

  useEffect(() => {
    if (!isCreateListingSuccess) return;
    toast.success("Listing created. It should appear here as soon as Senna indexes it.");
    refreshMarketAfterNameAction(pendingMarketActionName);
    void persistNotificationIntent(pendingListingSubscription).catch((error) =>
      toast.error(error.message ?? "Could not save listing email updates."),
    );
    setPendingListingSubscription(null);
    setPendingMarketActionName(null);
    setNotifyEmail("");
    resetCreateListing();
  }, [isCreateListingSuccess, pendingListingSubscription, pendingMarketActionName, resetCreateListing]);

  useEffect(() => {
    if (!createListingError) return;
    toast.error(createListingError.message.split("\n")[0] ?? "Listing creation failed.");
    setPendingListingSubscription(null);
    setPendingMarketActionName(null);
    resetCreateListing();
  }, [createListingError, resetCreateListing]);

  useEffect(() => {
    if (!isBuyListingSuccess) return;
    toast.success("Listing purchased.");
    refreshMarketAfterNameAction(pendingMarketActionName);
    setPendingMarketActionName(null);
    setPendingListingPurchaseId(null);
    resetBuyListing();
  }, [isBuyListingSuccess, pendingMarketActionName, resetBuyListing]);

  useEffect(() => {
    if (!buyListingError) return;
    toast.error(buyListingError.message.split("\n")[0] ?? "Purchase failed.");
    setPendingMarketActionName(null);
    setPendingListingPurchaseId(null);
    resetBuyListing();
  }, [buyListingError, resetBuyListing]);

  useEffect(() => {
    if (!isCancelListingSuccess) return;
    toast.success("Sale cancelled. The name is returning to your wallet.");
    refreshMarketAfterNameAction(pendingMarketActionName);
    setDetailSheet(null);
    setPendingMarketActionName(null);
    setPendingCancellationKey(null);
    resetCancelListing();
  }, [isCancelListingSuccess, pendingMarketActionName, resetCancelListing]);

  useEffect(() => {
    if (!cancelListingError) return;
    toast.error(cancelListingError.message.split("\n")[0] ?? "Could not cancel this sale.");
    setPendingMarketActionName(null);
    setPendingCancellationKey(null);
    resetCancelListing();
  }, [cancelListingError, resetCancelListing]);

  useEffect(() => {
    if (!isBidAuctionSuccess) return;
    toast.success("Bid submitted. If it lands top, the marketplace will update shortly.");
    refreshMarketAfterNameAction(null);
    void persistNotificationIntent(pendingBidSubscription).catch((error) =>
      toast.error(error.message ?? "Could not save bid email updates."),
    );
    setPendingBidSubscription(null);
    setNotifyEmail("");
    setBidAmountEth("");
    setPendingMarketActionName(null);
    setPendingBidAuctionKey(null);
    resetBidAuction();
  }, [isBidAuctionSuccess, pendingBidSubscription, resetBidAuction]);

  useEffect(() => {
    if (!isBidPrimarySuccess) return;
    toast.success("Bid submitted. If it lands top, the auction will update shortly.");
    refreshMarketAfterNameAction(null);
    void persistNotificationIntent(pendingBidSubscription).catch((error) =>
      toast.error(error.message ?? "Could not save bid email updates."),
    );
    setPendingBidSubscription(null);
    setNotifyEmail("");
    setBidAmountEth("");
    setPendingMarketActionName(null);
    setPendingBidAuctionKey(null);
    resetBidPrimary();
  }, [isBidPrimarySuccess, pendingBidSubscription, resetBidPrimary]);

  useEffect(() => {
    if (!bidAuctionError) return;
    toast.error(bidAuctionError.message.split("\n")[0] ?? "Bid failed.");
    setPendingBidSubscription(null);
    setPendingMarketActionName(null);
    setPendingBidAuctionKey(null);
    resetBidAuction();
  }, [bidAuctionError, resetBidAuction]);

  useEffect(() => {
    if (!bidPrimaryError) return;
    toast.error(bidPrimaryError.message.split("\n")[0] ?? "Bid failed.");
    setPendingBidSubscription(null);
    setPendingMarketActionName(null);
    setPendingBidAuctionKey(null);
    resetBidPrimary();
  }, [bidPrimaryError, resetBidPrimary]);

  useEffect(() => {
    if (!isSettleAuctionSuccess) return;
    toast.success("Auction settled.");
    refreshMarketAfterNameAction(pendingMarketActionName);
    void refetchMarketplaceClaimableProceeds();
    setPendingMarketActionName(null);
    setPendingSettlementAuctionKey(null);
    resetSettleAuction();
  }, [isSettleAuctionSuccess, pendingMarketActionName, refetchMarketplaceClaimableProceeds, resetSettleAuction]);

  useEffect(() => {
    if (!isSettlePrimarySuccess) return;
    toast.success("Auction settled.");
    refreshMarketAfterNameAction(pendingMarketActionName);
    setPendingMarketActionName(null);
    setPendingSettlementAuctionKey(null);
    resetSettlePrimary();
  }, [isSettlePrimarySuccess, pendingMarketActionName, resetSettlePrimary]);

  useEffect(() => {
    if (!settleAuctionError) return;
    toast.error(settleAuctionError.message.split("\n")[0] ?? "Settlement failed.");
    setPendingMarketActionName(null);
    setPendingSettlementAuctionKey(null);
    resetSettleAuction();
  }, [settleAuctionError, resetSettleAuction]);

  useEffect(() => {
    if (!settlePrimaryError) return;
    toast.error(settlePrimaryError.message.split("\n")[0] ?? "Settlement failed.");
    setPendingMarketActionName(null);
    setPendingSettlementAuctionKey(null);
    resetSettlePrimary();
  }, [settlePrimaryError, resetSettlePrimary]);

  useEffect(() => {
    if (!isCancelAuctionSuccess) return;
    toast.success("Auction cancelled. The name is returning to your wallet.");
    refreshMarketAfterNameAction(pendingMarketActionName);
    setDetailSheet(null);
    setPendingMarketActionName(null);
    setPendingCancellationKey(null);
    resetCancelAuction();
  }, [isCancelAuctionSuccess, pendingMarketActionName, resetCancelAuction]);

  useEffect(() => {
    if (!cancelAuctionError) return;
    toast.error(cancelAuctionError.message.split("\n")[0] ?? "Could not cancel this auction.");
    setPendingMarketActionName(null);
    setPendingCancellationKey(null);
    resetCancelAuction();
  }, [cancelAuctionError, resetCancelAuction]);

  useEffect(() => {
    if (!isFixedPremiumSuccess) return;
    toast.success("Name purchased. It should appear in your names after Senna indexes it.");
    refreshMarketAfterNameAction(pendingMarketActionName);
    setPendingMarketActionName(null);
    resetFixedPremium();
  }, [isFixedPremiumSuccess, pendingMarketActionName, resetFixedPremium]);

  useEffect(() => {
    if (!fixedPremiumError) return;
    toast.error(fixedPremiumError.message.split("\n")[0] ?? "Purchase failed.");
    setPendingMarketActionName(null);
    resetFixedPremium();
  }, [fixedPremiumError, resetFixedPremium]);

  useEffect(() => {
    if (!isWithdrawSuccess) return;
    toast.success("Refund withdrawn.");
    void refetchMarketplacePendingReturns();
    resetWithdraw();
  }, [isWithdrawSuccess, refetchMarketplacePendingReturns, resetWithdraw]);

  useEffect(() => {
    if (!withdrawError) return;
    toast.error(withdrawError.message.split("\n")[0] ?? "Refund withdrawal failed.");
    resetWithdraw();
  }, [withdrawError, resetWithdraw]);

  useEffect(() => {
    if (!isWithdrawProceedsSuccess) return;
    toast.success("Marketplace proceeds withdrawn.");
    void refetchMarketplaceClaimableProceeds();
    resetWithdrawProceeds();
  }, [isWithdrawProceedsSuccess, refetchMarketplaceClaimableProceeds, resetWithdrawProceeds]);

  useEffect(() => {
    if (!withdrawProceedsError) return;
    toast.error(withdrawProceedsError.message.split("\n")[0] ?? "Proceeds withdrawal failed.");
    resetWithdrawProceeds();
  }, [withdrawProceedsError, resetWithdrawProceeds]);

  useEffect(() => {
    if (!isWithdrawPrimarySuccess) return;
    toast.success("Primary auction refund withdrawn.");
    void refetchPrimaryPendingReturns();
    resetWithdrawPrimary();
  }, [isWithdrawPrimarySuccess, refetchPrimaryPendingReturns, resetWithdrawPrimary]);

  useEffect(() => {
    if (!withdrawPrimaryError) return;
    toast.error(withdrawPrimaryError.message.split("\n")[0] ?? "Primary auction refund withdrawal failed.");
    resetWithdrawPrimary();
  }, [withdrawPrimaryError, resetWithdrawPrimary]);

  const handleOpenComposeModal = () => {
    if (!selectedOwnedName || !selectedOwnedDomain) {
      toast.error("Choose a .rise name first.");
      return;
    }

    if (!isConnected) {
      toast.error("Connect your wallet to list a domain.");
      return;
    }

    if (saleMethod === "auction") {
      if (Number(reserveEth) <= 0 || Number.parseInt(auctionDays, 10) <= 0) {
        toast.error("Set a valid reserve price and duration.");
        return;
      }
      setNotifyEmail("");
      setNotifyModal({
        kind: "create-auction",
        name: selectedOwnedName,
        node: selectedOwnedDomain.node as Hex,
        reserveEth,
        days: auctionDays,
      });
      return;
    }

    if (Number(fixedPriceEth) <= 0) {
      toast.error("Set a valid fixed price.");
      return;
    }

    setNotifyEmail("");
    setNotifyModal({
      kind: "create-listing",
      name: selectedOwnedName,
      node: selectedOwnedDomain.node as Hex,
      priceEth: fixedPriceEth,
    });
  };

  const handleOpenBidModal = (auction: AnyAuctionSummary, source: AuctionSource) => {
    if (!isConnected) {
      toast.error("Connect your wallet to bid.");
      return;
    }
    setDetailSheet(null);
    setNotifyEmail("");
    setBidAmountEth("");
    setNotifyModal({ kind: "bid-auction", source, auction });
  };

  const handleOpenAuctionDetails = (auction: AnyAuctionSummary, source: AuctionSource) => {
    setDetailSheet({ kind: "auction", source, auction });
  };

  const handleOpenListingDetails = (listing: RnsMarketplaceListingSummary) => {
    setDetailSheet({ kind: "listing", listing });
  };

  const handleOpenReservedDetails = (reserved: RnsReservedNameSummary) => {
    setDetailSheet({ kind: "reserved", reserved });
  };

  const handleOpenWatchAuctionModal = (auction: AnyAuctionSummary, source: AuctionSource) => {
    setDetailSheet(null);
    setNotifyEmail("");
    setNotifyModal({ kind: "watch-auction", source, auction });
  };

  const handleOpenWatchReservedModal = (reserved: RnsReservedNameSummary) => {
    setDetailSheet(null);
    setNotifyEmail("");
    setNotifyModal({ kind: "watch-reserved", reserved });
  };

  const handleConfirmNotifyAction = () => {
    const email = notifyEmail.trim();
    const requiresEmail =
      notifyModal?.kind === "watch-auction" || notifyModal?.kind === "watch-reserved";

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(requiresEmail ? "Enter a valid email to watch this name." : "Enter a valid email or leave it blank.");
      return;
    }

    if (notifyModal?.kind === "create-auction") {
      if (!isApproved) {
        toast.error("Approve marketplace escrow first.");
        return;
      }
      const durationDays = Number.parseInt(notifyModal.days, 10);
      const startTime = BigInt(Math.floor(Date.now() / 1000) + 120);
      const endTime = startTime + BigInt(durationDays * 24 * 60 * 60);
      if (email) {
        setPendingAuctionSubscription({
          chainId,
          scope: "marketplace_seller",
          email,
          wallet: address ?? undefined,
          name: notifyModal.name,
          node: notifyModal.node,
        });
      }
      createAuction({
        name: notifyModal.name,
        reservePrice: parseEther(notifyModal.reserveEth),
        minIncrementBps: 500,
        startTime,
        endTime,
      });
      setPendingMarketActionName(notifyModal.name);
      setNotifyModal(null);
      return;
    }

    if (notifyModal?.kind === "create-listing") {
      if (!isApproved) {
        toast.error("Approve marketplace escrow first.");
        return;
      }
      if (email) {
        setPendingListingSubscription({
          chainId,
          scope: "marketplace_seller",
          email,
          wallet: address ?? undefined,
          name: notifyModal.name,
          node: notifyModal.node,
        });
      }
      createListing({
        name: notifyModal.name,
        price: parseEther(notifyModal.priceEth),
      });
      setPendingMarketActionName(notifyModal.name);
      setNotifyModal(null);
      return;
    }

    if (notifyModal?.kind === "bid-auction") {
      if (!bidAmountEth || Number(bidAmountEth) <= 0) {
        toast.error("Enter a valid bid amount.");
        return;
      }
      if (email) {
        setPendingBidSubscription({
          chainId,
          scope: "marketplace_bidder",
          email,
          wallet: address ?? undefined,
          name: notifyModal.auction.name,
          node: isMarketplaceAuction(notifyModal.auction) ? notifyModal.auction.node : null,
          auctionId: notifyModal.auction.auctionId,
        });
      }
      if (notifyModal.source === "primary") {
        setPendingBidAuctionKey(auctionActionKey("primary", notifyModal.auction));
        bidPrimaryAuction({
          auctionId: notifyModal.auction.auctionId,
          amount: parseEther(bidAmountEth),
        });
      } else {
        setPendingBidAuctionKey(auctionActionKey("marketplace", notifyModal.auction));
        bidAuction({
          auctionId: notifyModal.auction.auctionId,
          amount: parseEther(bidAmountEth),
        });
      }
      setPendingMarketActionName(notifyModal.auction.name);
      setNotifyModal(null);
      return;
    }

    if (notifyModal?.kind === "watch-auction") {
      if (!email) {
        toast.error("Add an email to watch this auction.");
        return;
      }
      void persistNotificationIntent({
        chainId,
        scope: "marketplace_watcher",
        email,
        wallet: address ?? undefined,
        name: notifyModal.auction.name,
        node: isMarketplaceAuction(notifyModal.auction) ? notifyModal.auction.node : null,
        auctionId: notifyModal.auction.auctionId,
      })
        .then(() => {
          toast.success(`Watching ${notifyModal.auction.name}.rise`);
          setNotifyModal(null);
          setNotifyEmail("");
        })
        .catch((error) => {
          toast.error(error.message ?? "Could not save auction watch.");
        });
      return;
    }

    if (notifyModal?.kind === "watch-reserved") {
      if (!email) {
        toast.error("Add an email to watch this name.");
        return;
      }
      void persistNotificationIntent({
        chainId,
        scope: "marketplace_watcher",
        email,
        wallet: address ?? undefined,
        name: notifyModal.reserved.label,
      })
        .then(() => {
          toast.success(`Watching ${notifyModal.reserved.fqdn}`);
          setNotifyModal(null);
          setNotifyEmail("");
        })
        .catch((error) => {
          toast.error(error.message ?? "Could not save watch request.");
        });
    }
  };

  const handleBuyListing = (listing: RnsMarketplaceListingSummary) => {
    if (!isConnected) {
      toast.error("Connect your wallet to buy a name.");
      return;
    }
    setPendingMarketActionName(listing.name);
    setPendingListingPurchaseId(listing.listingId.toString());
    buyListing({
      listingId: listing.listingId,
      price: listing.price,
    });
  };

  const handleCancelListing = (listing: RnsMarketplaceListingSummary) => {
    if (!address || address.toLowerCase() !== listing.seller.toLowerCase()) {
      toast.error("Only the seller can cancel this sale.");
      return;
    }
    setPendingMarketActionName(listing.name);
    setPendingCancellationKey(listingActionKey(listing));
    cancelListing({ listingId: listing.listingId });
  };

  const handleCancelAuction = (auction: AnyAuctionSummary, source: AuctionSource) => {
    if (
      source !== "marketplace" ||
      !isMarketplaceAuction(auction) ||
      !address ||
      address.toLowerCase() !== auction.seller.toLowerCase()
    ) {
      toast.error("Only the seller can cancel this auction.");
      return;
    }
    if (auction.bidCount > 0) {
      toast.error("An auction with bids cannot be cancelled by the seller.");
      return;
    }
    setPendingMarketActionName(auction.name);
    setPendingCancellationKey(auctionActionKey(source, auction));
    cancelAuction({ auctionId: auction.auctionId });
  };

  const handleSettleAuction = (auction: AnyAuctionSummary, source: AuctionSource) => {
    if (!isConnected) {
      toast.error("Connect your wallet to settle this auction.");
      return;
    }
    setPendingSettlementAuctionKey(auctionActionKey(source, auction));
    if (source === "primary") {
      settlePrimaryAuction({ auctionId: auction.auctionId });
    } else {
      settleAuction({ auctionId: auction.auctionId });
    }
    setPendingMarketActionName(auction.name);
  };

  const handleBuyReservedName = (reserved: RnsReservedNameSummary) => {
    if (!isConnected) {
      toast.error("Connect your wallet to buy this name.");
      return;
    }
    if (!fixedPremiumQuote.signedQuote || !fixedPremiumQuote.signature) {
      toast.error(fixedPremiumQuote.isLoading ? "Preparing purchase quote..." : "Purchase quote is not ready.");
      return;
    }
    registerFixedPremium({
      name: reserved.label,
      duration: fixedPremiumQuote.duration,
      quote: fixedPremiumQuote.signedQuote,
      signature: fixedPremiumQuote.signature,
      value: fixedPremiumQuote.price,
    });
    setPendingMarketActionName(reserved.label);
  };

  const marketplaceWithdrawableEth = marketplacePendingReturns
    ? formatEthCompact(marketplacePendingReturns)
    : null;
  const primaryWithdrawableEth = primaryPendingReturns
    ? formatEthCompact(primaryPendingReturns)
    : null;
  const marketplaceProceedsEth = marketplaceClaimableProceeds
    ? formatEthCompact(marketplaceClaimableProceeds)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="names-marketplace-page"
    >
      <section className="names-hero">
        <div>
          <div className="eyebrow">RNS Marketplace</div>
          <h1 className="ds-h1 mt-2">
            Buy and sell <span className="text-accent">.rise</span> names
          </h1>
          <p className="text-body-lg text-ink-muted mt-3 max-w-2xl">
            Live marketplace data, fixed-price sales, and rolling auctions all in one place.
          </p>
        </div>
        <NamesSubnav />
      </section>

      <section className="mkt-hero-grid">
        <div className="rns-card rns-card-pad">
          <div className="names-card-heading">
            <div>
              <h2 className="font-display text-2xl text-ink">Hottest short names</h2>
            </div>
            <span className="nm-tag nm-tag-auction">≤4 chars</span>
          </div>
          {featuredShortCards.length > 0 ? (
            <div className="hot-grid mkt-featured-grid">
              {featuredShortCards.map((card) => {
                const saleKind = cardSaleKind(card);
                const isAuctionCard = card.kind === "auction";
                const isReservedCard = card.kind === "reserved";
                const runtimeStatus = isAuctionCard ? auctionRuntimeStatus(card.raw, nowUnix) : null;
                const isOwnAuction =
                  isAuctionCard &&
                  card.source === "marketplace" &&
                  isMarketplaceAuction(card.raw) &&
                  address?.toLowerCase() === card.raw.seller.toLowerCase();
                const canBid = runtimeStatus === "active" && !isOwnAuction;
                const actionKey = isAuctionCard ? auctionActionKey(card.source, card.raw) : null;
                const isThisBidPending = isBidAuctionBusy && pendingBidAuctionKey === actionKey;
                const isThisSettlementPending =
                  isSettleAuctionBusy && pendingSettlementAuctionKey === actionKey;
                const canCancelAuction =
                  isAuctionCard &&
                  isOwnAuction &&
                  card.raw.bidCount === 0 &&
                  (runtimeStatus === "scheduled" || runtimeStatus === "active");
                const isThisCancellationPending =
                  isCancelAuctionBusy && pendingCancellationKey === actionKey;
                const showSettle = runtimeStatus === "ended";
                const settlementLabel = isAuctionCard
                  ? auctionSettlementLabel(card.raw, card.source, address)
                  : "Finalize auction";
                const bidLabel =
                  isAuctionCard && card.raw.highestBid > 0n
                    ? "Top bid"
                    : saleKind === "auction"
                      ? "Opening reserve"
                      : "Price";
                return (
                  <div key={card.id} className="hot-card big">
                    <div className="hot-top">
                      <span className="nm-tier">{card.length}-char</span>
                    </div>
                    <div className="hot-name">
                      {card.label}
                      <span className="tld">.rise</span>
                    </div>
                    <div className="hot-meta">
                      <div className="hot-bid-lbl">{bidLabel}</div>
                      <div className="hot-bid">{formatEthCompact(card.priceWei)} ETH</div>
                      <div className="mkt-price-usd-value">
                        ≈ {formatUsd(ethUsd ? Number(formatEther(card.priceWei)) * ethUsd : null)}
                      </div>
                    </div>
                    <div className="hot-foot">
                      <span>
                        {isAuctionCard
                          ? `${card.raw.bidCount} bid${card.raw.bidCount === 1 ? "" : "s"}`
                          : saleKind === "auction"
                            ? "0 bids"
                            : "Fixed price"}
                      </span>
                      <span className="hot-timer">
                        {isAuctionCard
                          ? runtimeStatus === "scheduled"
                            ? `Starts ${formatTimeLeft(card.raw.startTime, nowUnix)}`
                            : runtimeStatus === "active"
                              ? formatTimeLeft(card.raw.endTime, nowUnix)
                              : "Ended"
                          : reservedSaleLabel(card.raw)}
                      </span>
                    </div>
                    {isAuctionCard ? (
                      <div className="mkt-card-actions">
                        <button
                          type="button"
                          onClick={() => {
                            if (showSettle) {
                              handleSettleAuction(card.raw, card.source);
                              return;
                            }
                            if (canCancelAuction) {
                              handleCancelAuction(card.raw, card.source);
                              return;
                            }
                            handleOpenBidModal(card.raw, card.source);
                          }}
                          disabled={
                            showSettle
                              ? isSettleAuctionBusy
                              : canCancelAuction
                                ? isCancelAuctionBusy
                                : !canBid || isBidAuctionBusy
                          }
                          className={`mkt-card-cta ${canCancelAuction ? "is-cancel" : "is-auction"}`}
                        >
                          {showSettle
                            ? isThisSettlementPending
                              ? <InlineLoading label={auctionSettlementLoadingLabel(settlementLabel)} />
                              : settlementLabel
                            : canCancelAuction
                              ? isThisCancellationPending
                                ? <InlineLoading label="Cancelling..." />
                                : "Cancel auction"
                            : runtimeStatus === "scheduled"
                            ? "Starts soon"
                            : isOwnAuction
                                ? "Auction live"
                                : isThisBidPending
                                  ? <InlineLoading label="Submitting..." />
                                  : "Place bid"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenAuctionDetails(card.raw, card.source)}
                          className={`mkt-card-view ${canCancelAuction ? "is-cancel" : "is-auction"}`}
                          aria-label={`View ${card.label}.rise auction details`}
                          title="View auction details"
                        >
                          <View size={20} aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <div className="mkt-card-actions">
                        <button
                          type="button"
                          onClick={() => {
                            if (card.kind === "reserved") handleOpenReservedDetails(card.raw);
                          }}
                          className={`mkt-card-cta ${saleKind === "auction" ? "is-auction" : "is-buy-now"}`}
                        >
                          {isReservedCard && saleKind === "buy-now" ? "Buy now" : "Bid"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (card.kind === "reserved") handleOpenReservedDetails(card.raw);
                          }}
                          className={`mkt-card-view ${saleKind === "auction" ? "is-auction" : "is-buy-now"}`}
                          aria-label={`View ${card.label}.rise details`}
                          title="View details"
                        >
                          <View size={20} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rns-card rns-card-pad mkt-empty-state">
              <h3 className="font-display text-2xl text-ink">No short names listed yet</h3>
              <p className="text-body-sm text-ink-muted mt-2">
                Four-character and shorter .rise names will surface in this strip.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="rns-card rns-card-pad mkt-owned-panel mkt-owned-section">
        <div className="mkt-owned-heading">
          <div>
            <div className="mkt-owned-eyebrow">
              Sell from your wallet
            </div>
            <h2 className="font-display text-2xl text-ink">List a .rise name</h2>
            <p className="text-body-sm text-ink-muted mt-2">
              Choose a name, pick a sale method, and set your terms.
            </p>
          </div>
        </div>

        {ownedNames.length > 0 ? (
          <div className="mkt-owned-content">
            <div className="mkt-owned-selector">
              <div className="nm-list mkt-owned-list">
                {ownedNames.map((domain) => {
                  const isSelected = domain.label === selectedOwnedName;
                  return (
                    <button
                      key={domain.node}
                      type="button"
                      className={`nm-row mkt-owned-row ${isSelected ? "is-selected" : ""}`}
                      onClick={() => setSelectedOwnedName(domain.label)}
                      aria-pressed={isSelected}
                    >
                      <span className="mkt-owned-name-wrap">
                        <span className="nm-row-name">
                          <b>{domain.label}</b>
                          <span className="tld">.rise</span>
                        </span>
                      </span>
                      <span className="nm-tier">{isSelected ? "Selected" : "Owned"}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mkt-auction-form">
              <div className="mkt-selected-sale">
                <div className="mkt-selected-sale-copy">
                  <strong>{selectedOwnedName}.rise</strong>
                </div>
              </div>

              <div className="mkt-form-block">
                <div className="mkt-form-block-head">
                  <div className="nm-suggest-label">Sale method</div>
                  <span>How should buyers purchase it?</span>
                </div>
                <div className="mkt-sale-methods">
                  <button
                    type="button"
                    className={`mkt-sale-method ${saleMethod === "auction" ? "is-active" : ""}`}
                    onClick={() => setSaleMethod("auction")}
                    aria-pressed={saleMethod === "auction"}
                  >
                    <span className="mkt-sale-method-copy">
                      <strong>Auction</strong>
                      <small>Let buyers compete</small>
                    </span>
                    <span className="mkt-sale-method-check" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={`mkt-sale-method ${saleMethod === "buy-now" ? "is-active" : ""}`}
                    onClick={() => setSaleMethod("buy-now")}
                    aria-pressed={saleMethod === "buy-now"}
                  >
                    <span className="mkt-sale-method-copy">
                      <strong>Fixed price</strong>
                      <small>Sell instantly at your price</small>
                    </span>
                    <span className="mkt-sale-method-check" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="mkt-form-block">
                {saleMethod === "auction" ? (
                  <>
                    <div className="mkt-field-grid">
                      <label className="mkt-field">
                        <span>Opening reserve</span>
                        <div className="mkt-input-shell">
                          <input
                            aria-label="Opening reserve in ETH"
                            value={reserveEth}
                            onChange={(event) => setReserveEth(event.target.value)}
                            inputMode="decimal"
                          />
                          <b>ETH</b>
                        </div>
                      </label>
                      <label className="mkt-field">
                        <span>Duration</span>
                        <div className="mkt-input-shell">
                          <input
                            aria-label="Auction duration in days"
                            value={auctionDays}
                            onChange={(event) => setAuctionDays(event.target.value)}
                            inputMode="numeric"
                          />
                          <b>Days</b>
                        </div>
                      </label>
                    </div>
                    <div className="mkt-listing-summary">
                      <div>
                        <span>Reserve · 5% bid step</span>
                        <strong>{formatUsd(reserveUsd)}</strong>
                      </div>
                      <p>The highest valid bid wins when the auction ends.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="mkt-field">
                      <span>Fixed price</span>
                      <div className="mkt-input-shell">
                        <input
                          aria-label="Fixed price in ETH"
                          value={fixedPriceEth}
                          onChange={(event) => setFixedPriceEth(event.target.value)}
                          inputMode="decimal"
                        />
                        <b>ETH</b>
                      </div>
                    </label>
                    <div className="mkt-listing-summary">
                      <div>
                        <span>Buyer pays</span>
                        <strong>{formatUsd(fixedPriceUsd)}</strong>
                      </div>
                      <p>The first buyer can purchase immediately at this amount.</p>
                    </div>
                  </>
                )}
              </div>

              <div className="mkt-listing-action">
                {!isApproved ? (
                  <button
                    type="button"
                    onClick={approve}
                    disabled={isApprovalBusy}
                    className="btn-secondary names-action-btn w-full disabled:opacity-60"
                  >
                    {isApprovalBusy ? <InlineLoading label="Approving..." /> : "Approve marketplace"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenComposeModal}
                    disabled={(saleMethod === "auction" ? isCreateAuctionBusy : isCreateListingBusy) || !selectedOwnedName}
                    className="btn-primary names-action-btn w-full disabled:opacity-60"
                  >
                    {saleMethod === "auction"
                      ? isCreateAuctionBusy
                        ? <InlineLoading label="Creating auction..." />
                        : "Start auction"
                      : isCreateListingBusy
                        ? <InlineLoading label="Creating listing..." />
                        : "List now"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}
        {marketplacePendingReturns && marketplacePendingReturns > 0n ? (
          <button
            type="button"
            onClick={() => withdrawMarketplaceReturns()}
            disabled={isWithdrawBusy}
            className="btn-secondary names-action-btn mt-4 w-full disabled:opacity-60"
          >
            {isWithdrawBusy ? (
              <InlineLoading label="Withdrawing..." />
            ) : (
              `Withdraw marketplace refund · ${marketplaceWithdrawableEth} ETH`
            )}
          </button>
        ) : null}
        {marketplaceClaimableProceeds && marketplaceClaimableProceeds > 0n ? (
          <button
            type="button"
            onClick={() => withdrawMarketplaceProceeds()}
            disabled={isWithdrawProceedsBusy}
            className="btn-secondary names-action-btn mt-3 w-full disabled:opacity-60"
          >
            {isWithdrawProceedsBusy ? (
              <InlineLoading label="Withdrawing..." />
            ) : (
              `Withdraw marketplace proceeds · ${marketplaceProceedsEth} ETH`
            )}
          </button>
        ) : null}
        {primaryPendingReturns && primaryPendingReturns > 0n ? (
          <button
            type="button"
            onClick={() => withdrawPrimaryAuctionReturns()}
            disabled={isWithdrawPrimaryBusy}
            className="btn-secondary names-action-btn mt-3 w-full disabled:opacity-60"
          >
            {isWithdrawPrimaryBusy ? (
              <InlineLoading label="Withdrawing..." />
            ) : (
              `Withdraw primary auction refund · ${primaryWithdrawableEth} ETH`
            )}
          </button>
        ) : null}
      </section>

      <section className="mkt-filter-section">
        <div className="filter-bar">
          <Search className="w-4 h-4 text-ink-faint" />
          <input
            className="search-input"
            placeholder="Search listings..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="chip-group">
            {[
              ["all", "All"],
              ["auction", "Auctions"],
              ["buy-now", "Buy now"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`chip ${kind === value ? "active" : ""}`}
                onClick={() => setKind(value as "all" | ListingKind)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="chip-group">
            {[
              ["all", "Any"],
              ["2", "2 char"],
              ["3", "3 char"],
              ["4", "4 char"],
              ["5", "5+"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`chip ${lengthFilter === value ? "active-secondary" : ""}`}
                onClick={() => setLengthFilter(value as "all" | "2" | "3" | "4" | "5")}
              >
                {label}
              </button>
            ))}
          </div>
          <select className="sort-dropdown" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="hot">Sort: Hottest</option>
            <option value="price-low">Price low to high</option>
            <option value="price-high">Price high to low</option>
            <option value="ending">Ending soon</option>
          </select>
        </div>
      </section>

      <section>
        {marketError ? (
          <div className="rns-card rns-card-pad mkt-empty-state">
            <h3 className="font-display text-2xl text-ink">Marketplace feed unavailable</h3>
            <p className="text-body-sm text-ink-muted mt-2">{marketError}</p>
          </div>
        ) : isLoadingMarket ? (
          <div className="rns-card rns-card-pad mkt-empty-state">
            <LoadingState
              label="Loading marketplace"
              description="Pulling live listings and auctions."
              compact
              variant="dots"
            />
          </div>
        ) : (
          <div className="mkt-grid">
            {marketCards.map((card) => {
              const usdValue = ethUsd ? Number(formatEther(card.priceWei)) * ethUsd : null;
              const isAuction = card.kind === "auction";
              const isReserved = card.kind === "reserved";
              const saleKind = cardSaleKind(card);
              const pricePending = isReserved && !reservedPriceWei(card.raw);
              const runtimeStatus = card.kind === "auction" ? auctionRuntimeStatus(card.raw, nowUnix) : null;
              const isOwnListing =
                card.kind === "buy-now" && address?.toLowerCase() === card.raw.seller.toLowerCase();
              const isOwnAuction =
                card.kind === "auction" &&
                card.source === "marketplace" &&
                isMarketplaceAuction(card.raw) &&
                address?.toLowerCase() === card.raw.seller.toLowerCase();
              const isOwnEntry = isOwnListing || isOwnAuction;
              const showSettle = runtimeStatus === "ended";
              const canBid = runtimeStatus === "active" && !isOwnEntry;
              const actionKey = isAuction ? auctionActionKey(card.source, card.raw) : null;
              const cancellationKey =
                card.kind === "buy-now" ? listingActionKey(card.raw) : actionKey;
              const isThisBidPending = isBidAuctionBusy && pendingBidAuctionKey === actionKey;
              const isThisSettlementPending =
                isSettleAuctionBusy && pendingSettlementAuctionKey === actionKey;
              const canCancelAuction =
                card.kind === "auction" &&
                isOwnAuction &&
                card.raw.bidCount === 0 &&
                (runtimeStatus === "scheduled" || runtimeStatus === "active");
              const canCancelListing = card.kind === "buy-now" && isOwnListing;
              const isThisCancellationPending =
                pendingCancellationKey === cancellationKey &&
                (isCancelAuctionBusy || isCancelListingBusy);
              const settlementLabel = isAuction
                ? auctionSettlementLabel(card.raw, card.source, address)
                : "Finalize auction";
              const isThisPurchasePending =
                card.kind === "buy-now" &&
                isBuyListingBusy &&
                pendingListingPurchaseId === card.raw.listingId.toString();

              return (
                <article key={card.id} className={`mkt-card ${isReserved ? "mkt-card-preview" : ""}`}>
                  <div className="mkt-card-top">
                    <div>
                      <div className="mkt-card-name">
                        {card.label}
                        <span className="tld">.rise</span>
                      </div>
                      <div className="mkt-card-seller">
                        {isReserved
                          ? `${card.length} characters`
                          : isAuction && card.source === "primary"
                            ? "Primary auction"
                            : `Seller ${card.seller}`}
                      </div>
                    </div>
                  </div>
                  <div className="mkt-card-value">
                    <div className="mkt-price-lbl">
                      {isAuction && card.raw.highestBid > 0n
                        ? "Current bid"
                        : saleKind === "auction"
                          ? "Opening reserve"
                          : "Price"}
                    </div>
                    <div className="mkt-price-eth">{pricePending ? "TBA" : `${formatEthCompact(card.priceWei)} ETH`}</div>
                    <div className="mkt-price-usd-value">
                      ≈ {pricePending ? "Price pending" : formatUsd(usdValue)}
                    </div>
                  </div>

                  <div className="mkt-card-marketline">
                    <span>
                      {isAuction
                        ? `${card.raw.bidCount} bid${card.raw.bidCount === 1 ? "" : "s"}`
                        : saleKind === "auction"
                          ? "No bids yet"
                          : "Fixed price"}
                    </span>
                    <span>
                      {isAuction
                        ? runtimeStatus === "scheduled"
                          ? `Starts in ${formatTimeLeft(card.raw.startTime, nowUnix)}`
                          : runtimeStatus === "active"
                            ? `${formatTimeLeft(card.raw.endTime, nowUnix)} left`
                            : cardStatusLabel(card, nowUnix)
                        : `${card.length} characters`}
                    </span>
                  </div>

                  <div className="mkt-card-actions">
                    <button
                      type="button"
                      onClick={() => {
                        if (card.kind === "auction") {
                          if (showSettle) {
                            handleSettleAuction(card.raw, card.source);
                            return;
                          }
                          if (canCancelAuction) {
                            handleCancelAuction(card.raw, card.source);
                            return;
                          }
                          handleOpenBidModal(card.raw, card.source);
                          return;
                        }
                        if (card.kind === "reserved") {
                          handleOpenReservedDetails(card.raw);
                          return;
                        }
                        if (canCancelListing) {
                          handleCancelListing(card.raw);
                          return;
                        }
                        handleBuyListing(card.raw);
                      }}
                      disabled={
                        card.kind === "auction"
                          ? showSettle
                            ? isSettleAuctionBusy
                            : canCancelAuction
                              ? isCancelAuctionBusy
                              : !canBid || isBidAuctionBusy
                          : card.kind === "buy-now"
                            ? canCancelListing
                              ? isCancelListingBusy
                              : isBuyListingBusy
                            : false
                      }
                      className={`mkt-card-cta ${
                        canCancelAuction || canCancelListing
                          ? "is-cancel"
                          : saleKind === "auction"
                            ? "is-auction"
                            : "is-buy-now"
                      }`}
                    >
                      {card.kind === "auction"
                        ? showSettle
                          ? isThisSettlementPending
                            ? <InlineLoading label={auctionSettlementLoadingLabel(settlementLabel)} />
                            : settlementLabel
                          : canCancelAuction
                            ? isThisCancellationPending
                              ? <InlineLoading label="Cancelling..." />
                              : "Cancel auction"
                            : runtimeStatus === "scheduled"
                              ? "Starts soon"
                              : isOwnAuction
                                ? "Auction live"
                                : isThisBidPending
                                  ? <InlineLoading label="Submitting..." />
                                  : "Place bid"
                        : card.kind === "reserved"
                          ? saleKind === "auction" ? "View auction" : "Buy now"
                          : canCancelListing
                            ? isThisCancellationPending
                              ? <InlineLoading label="Cancelling..." />
                              : "Cancel sale"
                            : isThisPurchasePending
                              ? <InlineLoading label="Buying..." />
                              : "Buy now"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (card.kind === "auction") {
                          handleOpenAuctionDetails(card.raw, card.source);
                        } else if (card.kind === "reserved") {
                          handleOpenReservedDetails(card.raw);
                        } else {
                          handleOpenListingDetails(card.raw);
                        }
                      }}
                      className={`mkt-card-view ${
                        canCancelAuction || canCancelListing
                          ? "is-cancel"
                          : saleKind === "auction"
                            ? "is-auction"
                            : "is-buy-now"
                      }`}
                      aria-label={`View ${card.label}.rise details`}
                      title="View details"
                    >
                      <View size={20} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!isLoadingMarket && !marketError && marketCards.length === 0 ? (
          <div className="rns-card rns-card-pad mkt-empty-state">
            <h3 className="font-display text-2xl text-ink">No listings match your filters</h3>
            <p className="text-body-sm text-ink-muted mt-2">Try clearing the search or length filters.</p>
          </div>
        ) : null}
      </section>

      {detailSheet ? (
        <ResponsiveDialog
          open={Boolean(detailSheet)}
          onOpenChange={(open) => {
            if (!open) setDetailSheet(null);
          }}
          title={
            detailSheet.kind === "auction" ? (
              <>
                {detailSheet.auction.name}
                <span className="ml-1 text-xl text-ink-faint">.rise</span>
              </>
            ) : detailSheet.kind === "listing" ? (
              <>
                {detailSheet.listing.name}
                <span className="ml-1 text-xl text-ink-faint">.rise</span>
              </>
            ) : (
              detailSheet.reserved.fqdn
            )
          }
          description={
            detailSheet.kind === "auction"
              ? `${
                  detailSheet.source === "primary"
                    ? "Primary auction"
                    : `Seller ${shortSeller(isMarketplaceAuction(detailSheet.auction) ? detailSheet.auction.seller : "Stage0")}`
                } · ${
                  auctionRuntimeStatus(detailSheet.auction, nowUnix) === "scheduled"
                    ? "Starts soon"
                    : auctionRuntimeStatus(detailSheet.auction, nowUnix) === "active"
                      ? "Live now"
                      : auctionRuntimeStatus(detailSheet.auction, nowUnix) === "ended"
                        ? detailSheet.auction.bidCount === 0
                          ? "Ended without bids"
                          : "Ready to finalize"
                        : auctionRuntimeStatus(detailSheet.auction, nowUnix)
                }`
              : detailSheet.kind === "listing"
                ? `Fixed-price sale · Seller ${shortSeller(detailSheet.listing.seller)}`
              : `${reservedSaleLabel(detailSheet.reserved)} · ${formatEthCompact(reservedPriceWei(detailSheet.reserved) ?? 0n)} ETH`
          }
          className="mkt-market-dialog"
        >
          {detailSheet.kind === "auction" ? (() => {
            const auction = detailSheet.auction;
            const currentBid = auction.highestBid > 0n ? auction.highestBid : auction.reservePrice;
            const currentBidUsd = ethUsd ? Number(formatEther(currentBid)) * ethUsd : null;
            const nextBidUsd =
              detailMinimumNextBid && ethUsd ? Number(formatEther(detailMinimumNextBid)) * ethUsd : null;
            const isOwnAuction =
              detailSheet.source === "marketplace" &&
              isMarketplaceAuction(auction) &&
              address?.toLowerCase() === auction.seller.toLowerCase();
            const runtimeStatus = auctionRuntimeStatus(auction, nowUnix);
            const canSettle = runtimeStatus === "ended";
            const canBid = runtimeStatus === "active" && !isOwnAuction;
            const actionKey = auctionActionKey(detailSheet.source, auction);
            const isThisBidPending = isBidAuctionBusy && pendingBidAuctionKey === actionKey;
            const isThisSettlementPending =
              isSettleAuctionBusy && pendingSettlementAuctionKey === actionKey;
            const canCancelAuction =
              isOwnAuction &&
              auction.bidCount === 0 &&
              (runtimeStatus === "scheduled" || runtimeStatus === "active");
            const isThisCancellationPending =
              isCancelAuctionBusy && pendingCancellationKey === actionKey;
            const settlementLabel = auctionSettlementLabel(auction, detailSheet.source, address);
            const timeLabel =
              runtimeStatus === "scheduled"
                ? `Starts in ${formatTimeLeft(auction.startTime, nowUnix)}`
                : runtimeStatus === "active"
                  ? `${formatTimeLeft(auction.endTime, nowUnix)} left`
                  : "Bidding ended";
            const guidance =
              runtimeStatus === "ended"
                ? auction.bidCount === 0
                  ? "No bids were placed. Finalize the auction to close it and return the name when applicable."
                  : "Bidding is closed. Finalize the auction to complete the name transfer."
                : isOwnAuction && auction.bidCount === 0
                  ? "No bids yet. You can leave the auction live or cancel it and return the name to your wallet."
                  : auction.bidCount === 0
                    ? "Be the first bidder by meeting the opening reserve."
                    : "Each new bid must clear the current top bid by at least 5%.";
            return (
              <div className="mkt-detail-layout">
                <div className="mkt-detail-hero">
                  <div>
                    <span className="mkt-detail-kicker">
                      {auction.highestBid > 0n ? "Current bid" : "Opening reserve"}
                    </span>
                    <strong className="mkt-detail-price">{formatEthCompact(currentBid)} ETH</strong>
                    <span className="mkt-detail-usd">≈ {formatUsd(currentBidUsd)}</span>
                  </div>
                  {runtimeStatus !== "active" ? (
                    <span className={`mkt-detail-status is-${runtimeStatus}`}>
                      {runtimeStatus === "scheduled"
                        ? "Scheduled"
                        : runtimeStatus === "ended"
                          ? auction.bidCount === 0 ? "No bids" : "Ended"
                          : runtimeStatus}
                    </span>
                  ) : null}
                </div>

                <div className="mkt-detail-facts">
                  <div className="mkt-detail-fact">
                    <span>Bids</span>
                    <strong>{auction.bidCount}</strong>
                  </div>
                  <div className="mkt-detail-fact">
                    <span>Timing</span>
                    <strong>{timeLabel}</strong>
                  </div>
                  <div className="mkt-detail-fact">
                    <span>Leading wallet</span>
                    <strong>{auction.highestBidder ? shortSeller(auction.highestBidder) : "None yet"}</strong>
                  </div>
                </div>

                {runtimeStatus !== "ended" ? (
                  <div className="mkt-detail-next-bid">
                    <div>
                      <span>Next valid bid</span>
                      <strong>
                        {detailMinimumNextBid ? `${formatEthCompact(detailMinimumNextBid)} ETH` : "Calculating..."}
                      </strong>
                    </div>
                    <span className="mkt-detail-next-usd">
                      ≈ {detailMinimumNextBid ? formatUsd(nextBidUsd) : "USD loading"}
                    </span>
                  </div>
                ) : null}

                <p className="mkt-detail-guidance">
                  {guidance} Bids near the deadline extend the auction to prevent last-second sniping.
                </p>

                <div className="mkt-detail-actions">
                  {canSettle ? (
                    <button
                      type="button"
                      onClick={() => handleSettleAuction(auction, detailSheet.source)}
                      disabled={isSettleAuctionBusy}
                      className="mkt-detail-primary"
                    >
                      {isThisSettlementPending ? (
                        <InlineLoading label={auctionSettlementLoadingLabel(settlementLabel)} />
                      ) : (
                        settlementLabel
                      )}
                    </button>
                  ) : canCancelAuction ? (
                    <button
                      type="button"
                      onClick={() => handleCancelAuction(auction, detailSheet.source)}
                      disabled={isCancelAuctionBusy}
                      className="mkt-detail-primary is-cancel"
                    >
                      {isThisCancellationPending ? <InlineLoading label="Cancelling..." /> : "Cancel auction"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenBidModal(auction, detailSheet.source)}
                      disabled={!canBid || isBidAuctionBusy}
                      className="mkt-detail-primary"
                    >
                      {runtimeStatus === "scheduled"
                        ? `Bidding opens ${formatTimeLeft(auction.startTime, nowUnix)}`
                        : isOwnAuction
                          ? "Auction in progress"
                          : isThisBidPending
                            ? <InlineLoading label="Submitting bid..." />
                            : "Place bid"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenWatchAuctionModal(auction, detailSheet.source)}
                    className="mkt-detail-secondary"
                  >
                    Join watchlist
                  </button>
                </div>
              </div>
            );
          })() : detailSheet.kind === "listing" ? (() => {
            const listing = detailSheet.listing;
            const listingUsd = ethUsd ? Number(formatEther(listing.price)) * ethUsd : null;
            const isOwnListing = address?.toLowerCase() === listing.seller.toLowerCase();
            const key = listingActionKey(listing);
            const isThisCancellationPending =
              isCancelListingBusy && pendingCancellationKey === key;
            const isThisPurchasePending =
              isBuyListingBusy && pendingListingPurchaseId === listing.listingId.toString();
            return (
              <div className="mkt-detail-layout">
                <div className="mkt-detail-hero">
                  <div>
                    <span className="mkt-detail-kicker">Fixed price</span>
                    <strong className="mkt-detail-price">{formatEthCompact(listing.price)} ETH</strong>
                    <span className="mkt-detail-usd">≈ {formatUsd(listingUsd)}</span>
                  </div>
                  <span className="mkt-detail-status is-active">Available</span>
                </div>

                <div className="mkt-detail-facts">
                  <div className="mkt-detail-fact">
                    <span>Seller</span>
                    <strong>{shortSeller(listing.seller)}</strong>
                  </div>
                  <div className="mkt-detail-fact">
                    <span>Length</span>
                    <strong>{listing.name.length} characters</strong>
                  </div>
                  <div className="mkt-detail-fact">
                    <span>Delivery</span>
                    <strong>Onchain transfer</strong>
                  </div>
                </div>

                <p className="mkt-detail-guidance">
                  {isOwnListing
                    ? "Your name remains in marketplace escrow until it sells. You can cancel before a buyer completes the purchase."
                    : "Buy at the listed price and the name transfers directly to your connected wallet."}
                </p>

                <div className="mkt-detail-actions">
                  <button
                    type="button"
                    onClick={() => isOwnListing ? handleCancelListing(listing) : handleBuyListing(listing)}
                    disabled={isOwnListing ? isCancelListingBusy : isBuyListingBusy}
                    className={`mkt-detail-primary ${isOwnListing ? "is-cancel" : ""}`}
                  >
                    {isOwnListing
                      ? isThisCancellationPending
                        ? <InlineLoading label="Cancelling..." />
                        : "Cancel sale"
                      : isThisPurchasePending
                        ? <InlineLoading label="Buying..." />
                        : "Buy now"}
                  </button>
                </div>
              </div>
            );
          })() : (() => {
            const reserved = detailSheet.reserved;
            const priceWei = reserved.saleMode === "buy_now" ? reserved.fixedPriceWei : reserved.reservePriceWei;
            const usdValue = priceWei && ethUsd ? Number(formatEther(priceWei)) * ethUsd : null;
            return (
              <div className="mkt-detail-layout">
                <div className="mkt-detail-hero">
                  <div>
                    <span className="mkt-detail-kicker">
                      {reserved.saleMode === "buy_now" ? "Fixed price" : "Opening reserve"}
                    </span>
                    <strong className="mkt-detail-price">
                      {priceWei ? `${formatEthCompact(priceWei)} ETH` : "TBA"}
                    </strong>
                    <span className="mkt-detail-usd">≈ {priceWei ? formatUsd(usdValue) : "Price pending"}</span>
                  </div>
                  <span className="mkt-detail-status is-active">Available</span>
                </div>

                <div className="mkt-detail-facts">
                  <div className="mkt-detail-fact">
                    <span>Length</span>
                    <strong>{reserved.label.length} characters</strong>
                  </div>
                  <div className="mkt-detail-fact">
                    <span>Sale</span>
                    <strong>{reservedSaleLabel(reserved)}</strong>
                  </div>
                </div>

                <p className="mkt-detail-guidance">
                  {reserved.saleMode === "buy_now"
                    ? "Complete the purchase to register this name directly to your connected wallet."
                    : "Join the watchlist for an alert when bidding becomes available."}
                </p>

                <div className="mkt-detail-actions">
                <button
                  type="button"
                  onClick={() =>
                    reserved.saleMode === "buy_now"
                      ? handleBuyReservedName(reserved)
                      : handleOpenWatchReservedModal(reserved)
                  }
                  disabled={reserved.saleMode === "buy_now" && (isFixedPremiumBusy || fixedPremiumQuote.isLoading)}
                  className="mkt-detail-primary"
                >
                  {reserved.saleMode === "buy_now"
                    ? isFixedPremiumBusy
                      ? <InlineLoading label="Buying..." />
                      : fixedPremiumQuote.isLoading
                        ? <InlineLoading label="Preparing quote..." />
                        : "Buy now"
                    : "Bid"}
                </button>
              </div>
              </div>
            );
          })()}
        </ResponsiveDialog>
      ) : null}

      {notifyModal ? (
        <ResponsiveDialog
          open={Boolean(notifyModal)}
          onOpenChange={(open) => {
            if (!open) {
              setNotifyModal(null);
              setNotifyEmail("");
              setBidAmountEth("");
            }
          }}
          title={
            notifyModal.kind === "bid-auction"
              ? `Bid on ${notifyModal.auction.name}.rise`
              : notifyModal.kind === "watch-auction"
                ? `Watch ${notifyModal.auction.name}.rise`
              : notifyModal.kind === "watch-reserved"
                  ? `Watch ${notifyModal.reserved.fqdn}`
                  : notifyModal.kind === "create-auction"
                    ? `Auction ${notifyModal.name}.rise`
                    : `List ${notifyModal.name}.rise`
          }
          description={
            notifyModal.kind === "watch-auction" || notifyModal.kind === "watch-reserved"
              ? "Add an email to join the watchlist for this name. Stage0 will send updates when the market moves."
              : "Add an email if you want Stage0 to send updates about this listing or auction. Leave it blank if you do not need alerts."
          }
          className="max-w-md"
        >
          {notifyModal.kind === "bid-auction" ? (
            <div className="mkt-field">
              <span>Bid amount (ETH)</span>
              <input value={bidAmountEth} onChange={(event) => setBidAmountEth(event.target.value)} inputMode="decimal" />
              <span className="mt-2 block text-xs text-ink-faint">
                Minimum next bid:{" "}
                {minimumNextBid !== undefined ? `${formatEthCompact(minimumNextBid)} ETH` : <Spinner size="xs" variant="dots" />}
              </span>
            </div>
          ) : null}

          <label className="mkt-field mt-5">
            <span>Email address</span>
            <input
              value={notifyEmail}
              onChange={(event) => setNotifyEmail(event.target.value)}
              placeholder="name@example.com"
              inputMode="email"
            />
          </label>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setNotifyModal(null);
                setNotifyEmail("");
                setBidAmountEth("");
              }}
              className="btn-secondary names-action-btn w-full"
            >
              Cancel
            </button>
            <button type="button" onClick={handleConfirmNotifyAction} className="btn-primary names-action-btn w-full">
              {notifyModal.kind === "watch-auction" || notifyModal.kind === "watch-reserved"
                ? "Join watchlist"
                : notifyModal.kind === "bid-auction"
                  ? "Place bid"
                  : notifyModal.kind === "create-auction"
                    ? "Start auction"
                    : "List name"}
            </button>
          </div>
        </ResponsiveDialog>
      ) : null}
    </motion.div>
  );
}

export default DomainsMarketplacePage;
