import NamesSubnav from "@/components/rns/NamesSubnav";
import { ArrowRight, Search, Star } from "@/components/ui/icons";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { InlineLoading, LoadingState, Spinner } from "@/components/ui/spinner";
import {
  fetchRnsMarketplaceAuctions,
  fetchRnsMarketplaceListings,
  fetchRnsMarketplaceReserved,
  fetchRnsPricing,
  subscribeRnsMarketplaceNotifications,
  type RnsMarketplaceAuctionSummary,
  type RnsMarketplaceListingSummary,
  type RnsPricingSummary,
  type RnsReservedNameSummary,
} from "@/lib/api/rns";
import { RNSMarketplaceEscrow } from "@/lib/rns/abis";
import {
  useRnsApproveForAll,
  useRnsBidMarketplaceAuction,
  useRnsBuyMarketplaceListing,
  useRnsContracts,
  useRnsCreateMarketplaceAuction,
  useRnsCreateMarketplaceListing,
  useRnsIsApproved,
  useRnsOwnedLabel,
  useRnsSettleMarketplaceAuction,
  useRnsWithdrawMarketplaceReturns,
} from "@/lib/hooks/rns";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { formatEther, parseEther, type Address, type Hex } from "viem";
import { useAccount, useReadContract } from "wagmi";

type ListingKind = "auction" | "buy-now";
type SaleMethod = "auction" | "buy-now";

type MarketCard =
  | {
      kind: "auction";
      id: string;
      label: string;
      length: number;
      seller: string;
      status: string;
      priceWei: bigint;
      bids: number;
      startsAt: bigint;
      endsAt: bigint;
      raw: RnsMarketplaceAuctionSummary;
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
      auction: RnsMarketplaceAuctionSummary;
    }
  | {
      kind: "watch-auction";
      auction: RnsMarketplaceAuctionSummary;
    }
  | {
      kind: "watch-reserved";
      reserved: RnsReservedNameSummary;
    };

type DetailSheetState =
  | {
      kind: "auction";
      auction: RnsMarketplaceAuctionSummary;
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

function cardStatusLabel(card: MarketCard, nowUnix: number) {
  if (card.kind === "buy-now") return "Instant sale";
  if (card.status === "scheduled") return `Starts ${formatTimeLeft(card.startsAt, nowUnix)}`;
  if (card.status === "ended") return "Awaiting settlement";
  if (card.status === "settled") return "Settled";
  if (card.status === "cancelled") return "Cancelled";
  return `${card.bids} bid${card.bids === 1 ? "" : "s"}`;
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
  const { chainId, marketplace } = useRnsContracts();
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
    bidAuction,
    isPending: isBidAuctionPending,
    isConfirming: isBidAuctionConfirming,
    isSuccess: isBidAuctionSuccess,
    error: bidAuctionError,
    reset: resetBidAuction,
  } = useRnsBidMarketplaceAuction();

  const {
    settleAuction,
    isPending: isSettleAuctionPending,
    isConfirming: isSettleAuctionConfirming,
    isSuccess: isSettleAuctionSuccess,
    error: settleAuctionError,
    reset: resetSettleAuction,
  } = useRnsSettleMarketplaceAuction();

  const {
    withdrawMarketplaceReturns,
    isPending: isWithdrawPending,
    isConfirming: isWithdrawConfirming,
    isSuccess: isWithdrawSuccess,
    error: withdrawError,
    reset: resetWithdraw,
  } = useRnsWithdrawMarketplaceReturns();

  const [kind, setKind] = useState<"all" | ListingKind>("all");
  const [lengthFilter, setLengthFilter] = useState<"all" | "2" | "3" | "4" | "5">("all");
  const [sort, setSort] = useState("hot");
  const [query, setQuery] = useState("");
  const [pricing, setPricing] = useState<RnsPricingSummary | null>(null);
  const [liveListings, setLiveListings] = useState<RnsMarketplaceListingSummary[]>([]);
  const [liveAuctions, setLiveAuctions] = useState<RnsMarketplaceAuctionSummary[]>([]);
  const [reservedDomains, setReservedDomains] = useState<RnsReservedNameSummary[]>([]);
  const [isLoadingMarket, setIsLoadingMarket] = useState(true);
  const [marketError, setMarketError] = useState<string | null>(null);
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
  const isApprovalBusy = isApprovalPending || isApprovalConfirming;
  const isCreateAuctionBusy = isCreateAuctionPending || isCreateAuctionConfirming;
  const isCreateListingBusy = isCreateListingPending || isCreateListingConfirming;
  const isBuyListingBusy = isBuyListingPending || isBuyListingConfirming;
  const isBidAuctionBusy = isBidAuctionPending || isBidAuctionConfirming;
  const isSettleAuctionBusy = isSettleAuctionPending || isSettleAuctionConfirming;
  const isWithdrawBusy = isWithdrawPending || isWithdrawConfirming;

  const featuredAuctions = useMemo(() => {
    return [...liveAuctions]
      .filter((auction) => auction.status === "active" || auction.status === "scheduled")
      .sort((a, b) => {
        const aValue = a.highestBid > 0n ? a.highestBid : a.reservePrice;
        const bValue = b.highestBid > 0n ? b.highestBid : b.reservePrice;
        if (aValue === bValue) return Number(a.endTime - b.endTime);
        return aValue > bValue ? -1 : 1;
      })
      .slice(0, 6);
  }, [liveAuctions]);

  const featuredReserved = useMemo(() => {
    return [...reservedDomains]
      .filter((reserved) => reserved.enabled)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label))
      .slice(0, 12);
  }, [reservedDomains]);

  const marketCards = useMemo(() => {
    const cards: MarketCard[] = [
      ...liveAuctions
        .filter((auction) => !["cancelled", "settled"].includes(auction.status))
        .map((auction) => ({
          kind: "auction" as const,
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
        })),
      ...liveListings
        .filter((listing) => listing.status === "active")
        .map((listing) => ({
          kind: "buy-now" as const,
          id: `listing-${listing.listingId.toString()}`,
          label: listing.name,
          length: listing.name.length,
          seller: shortSeller(listing.seller),
          status: listing.status,
          priceWei: listing.price,
          raw: listing,
        })),
    ];

    let result = cards.filter((card) => {
      const kindMatch = kind === "all" || card.kind === kind;
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
        if (a.kind !== b.kind) return a.kind === "auction" ? -1 : 1;
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
  }, [kind, lengthFilter, liveAuctions, liveListings, query, sort]);

  const currentBidAuctionId =
    notifyModal?.kind === "bid-auction" ? notifyModal.auction.auctionId : undefined;
  const { data: minimumNextBid } = useReadContract({
    address: marketplace,
    abi: RNSMarketplaceEscrow,
    functionName: "minimumNextBid",
    args: currentBidAuctionId !== undefined ? [currentBidAuctionId] : undefined,
    query: { enabled: currentBidAuctionId !== undefined },
  });
  const detailAuctionId = detailSheet?.kind === "auction" ? detailSheet.auction.auctionId : undefined;
  const { data: detailMinimumNextBid } = useReadContract({
    address: marketplace,
    abi: RNSMarketplaceEscrow,
    functionName: "minimumNextBid",
    args: detailAuctionId !== undefined ? [detailAuctionId] : undefined,
    query: { enabled: detailAuctionId !== undefined },
  });

  const { data: pendingReturns } = useReadContract({
    address: marketplace,
    abi: RNSMarketplaceEscrow,
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
        const [nextPricing, nextListings, nextAuctions, nextReserved] = await Promise.all([
          fetchRnsPricing({ chainId }),
          fetchRnsMarketplaceListings({ chainId, limit: 100 }),
          fetchRnsMarketplaceAuctions({ chainId, limit: 100 }),
          fetchRnsMarketplaceReserved({ chainId }),
        ]);

        if (cancelled) return;
        setPricing(nextPricing);
        setLiveListings(nextListings);
        setLiveAuctions(nextAuctions);
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
  }, [chainId]);

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

  useEffect(() => {
    if (!isCreateAuctionSuccess) return;
    toast.success("Auction created. It should appear here as soon as Senna indexes it.");
    void persistNotificationIntent(pendingAuctionSubscription).catch((error) =>
      toast.error(error.message ?? "Could not save auction email updates."),
    );
    setPendingAuctionSubscription(null);
    setNotifyEmail("");
    resetCreateAuction();
  }, [isCreateAuctionSuccess, pendingAuctionSubscription, resetCreateAuction]);

  useEffect(() => {
    if (!createAuctionError) return;
    toast.error(createAuctionError.message.split("\n")[0] ?? "Auction creation failed.");
    setPendingAuctionSubscription(null);
    resetCreateAuction();
  }, [createAuctionError, resetCreateAuction]);

  useEffect(() => {
    if (!isCreateListingSuccess) return;
    toast.success("Listing created. It should appear here as soon as Senna indexes it.");
    void persistNotificationIntent(pendingListingSubscription).catch((error) =>
      toast.error(error.message ?? "Could not save listing email updates."),
    );
    setPendingListingSubscription(null);
    setNotifyEmail("");
    resetCreateListing();
  }, [isCreateListingSuccess, pendingListingSubscription, resetCreateListing]);

  useEffect(() => {
    if (!createListingError) return;
    toast.error(createListingError.message.split("\n")[0] ?? "Listing creation failed.");
    setPendingListingSubscription(null);
    resetCreateListing();
  }, [createListingError, resetCreateListing]);

  useEffect(() => {
    if (!isBuyListingSuccess) return;
    toast.success("Listing purchased.");
    resetBuyListing();
  }, [isBuyListingSuccess, resetBuyListing]);

  useEffect(() => {
    if (!buyListingError) return;
    toast.error(buyListingError.message.split("\n")[0] ?? "Purchase failed.");
    resetBuyListing();
  }, [buyListingError, resetBuyListing]);

  useEffect(() => {
    if (!isBidAuctionSuccess) return;
    toast.success("Bid submitted. If it lands top, the marketplace will update shortly.");
    void persistNotificationIntent(pendingBidSubscription).catch((error) =>
      toast.error(error.message ?? "Could not save bid email updates."),
    );
    setPendingBidSubscription(null);
    setNotifyEmail("");
    setBidAmountEth("");
    resetBidAuction();
  }, [isBidAuctionSuccess, pendingBidSubscription, resetBidAuction]);

  useEffect(() => {
    if (!bidAuctionError) return;
    toast.error(bidAuctionError.message.split("\n")[0] ?? "Bid failed.");
    setPendingBidSubscription(null);
    resetBidAuction();
  }, [bidAuctionError, resetBidAuction]);

  useEffect(() => {
    if (!isSettleAuctionSuccess) return;
    toast.success("Auction settled.");
    resetSettleAuction();
  }, [isSettleAuctionSuccess, resetSettleAuction]);

  useEffect(() => {
    if (!settleAuctionError) return;
    toast.error(settleAuctionError.message.split("\n")[0] ?? "Settlement failed.");
    resetSettleAuction();
  }, [settleAuctionError, resetSettleAuction]);

  useEffect(() => {
    if (!isWithdrawSuccess) return;
    toast.success("Refund withdrawn.");
    resetWithdraw();
  }, [isWithdrawSuccess, resetWithdraw]);

  useEffect(() => {
    if (!withdrawError) return;
    toast.error(withdrawError.message.split("\n")[0] ?? "Refund withdrawal failed.");
    resetWithdraw();
  }, [withdrawError, resetWithdraw]);

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

  const handleOpenBidModal = (auction: RnsMarketplaceAuctionSummary) => {
    if (!isConnected) {
      toast.error("Connect your wallet to bid.");
      return;
    }
    setDetailSheet(null);
    setNotifyEmail("");
    setBidAmountEth("");
    setNotifyModal({ kind: "bid-auction", auction });
  };

  const handleOpenAuctionDetails = (auction: RnsMarketplaceAuctionSummary) => {
    setDetailSheet({ kind: "auction", auction });
  };

  const handleOpenReservedDetails = (reserved: RnsReservedNameSummary) => {
    setDetailSheet({ kind: "reserved", reserved });
  };

  const handleOpenWatchAuctionModal = (auction: RnsMarketplaceAuctionSummary) => {
    setDetailSheet(null);
    setNotifyEmail("");
    setNotifyModal({ kind: "watch-auction", auction });
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
          node: notifyModal.auction.node,
          auctionId: notifyModal.auction.auctionId,
        });
      }
      bidAuction({
        auctionId: notifyModal.auction.auctionId,
        amount: parseEther(bidAmountEth),
      });
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
        node: notifyModal.auction.node,
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
        toast.error("Add an email to watch this reserved name.");
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
    buyListing({
      listingId: listing.listingId,
      price: listing.price,
    });
  };

  const handleSettleAuction = (auction: RnsMarketplaceAuctionSummary) => {
    if (!isConnected) {
      toast.error("Connect your wallet to settle this auction.");
      return;
    }
    settleAuction({ auctionId: auction.auctionId });
  };

  const withdrawableEth = pendingReturns ? formatEthCompact(pendingReturns) : null;

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
              <div className="nm-suggest-label">Most contested</div>
              <h2 className="font-display text-2xl text-ink mt-1">Hottest short names</h2>
            </div>
            <span className="nm-tag nm-tag-auction">Live</span>
          </div>
          {featuredAuctions.length > 0 ? (
            <div className="hot-grid mkt-featured-grid">
              {featuredAuctions.map((auction) => {
                const displayBid = auction.highestBid > 0n ? auction.highestBid : auction.reservePrice;
                return (
                  <div key={auction.auctionId.toString()} className="hot-card big">
                    <div className="hot-top">
                      <span className="nm-tier">{auction.name.length}-char</span>
                    </div>
                    <div className="hot-name">
                      {auction.name}
                      <span className="tld">.rise</span>
                    </div>
                    <div className="hot-meta">
                      <div className="hot-bid-lbl">{auction.highestBid > 0n ? "Top bid" : "Reserve"}</div>
                      <div className="hot-bid">{formatEthCompact(displayBid)} ETH</div>
                      <div className="mkt-price-usd-value">
                        ≈ {formatUsd(ethUsd ? Number(formatEther(displayBid)) * ethUsd : null)}
                      </div>
                    </div>
                    <div className="hot-foot">
                      <span>{auction.bidCount} bid{auction.bidCount === 1 ? "" : "s"}</span>
                      <span className="hot-timer">
                        {auction.status === "scheduled"
                          ? `Starts ${formatTimeLeft(auction.startTime, nowUnix)}`
                          : formatTimeLeft(auction.endTime, nowUnix)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenAuctionDetails(auction)}
                      className="mkt-card-cta is-auction"
                    >
                      View auction
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rns-card rns-card-pad mkt-empty-state">
              <h3 className="font-display text-2xl text-ink">No live short-name auctions yet</h3>
              <p className="text-body-sm text-ink-muted mt-2">
                Once people start listing short .rise names here, they will surface in this strip.
              </p>
            </div>
          )}
        </div>

        <aside className="rns-card rns-card-pad mkt-owned-panel">
          <span className="nm-primary-pill">
            <Star className="w-3 h-3" />
            Your names
          </span>
          <h2 className="font-display text-2xl text-ink mt-4">Sell your .rise names</h2>
          <p className="text-body-sm text-ink-muted mt-2">
            Pick a wallet-held name, then choose whether to run an auction or post a fixed-price sale.
          </p>

          {ownedNames.length > 0 ? (
            <>
              <div className="nm-list mkt-owned-list">
                {ownedNames.slice(0, 4).map((domain) => (
                  <div key={domain.node} className="nm-row">
                    <span className="nm-row-name">
                      <b>{domain.label}</b>
                      <span className="tld">.rise</span>
                    </span>
                    <span className="nm-tier">Owned</span>
                  </div>
                ))}
              </div>

              <div className="mkt-auction-form">
                <div className="nm-suggest-label">Sale method</div>
                <div className="chip-group mb-4">
                  {[
                    ["auction", "Auction"],
                    ["buy-now", "Fixed price"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`chip ${saleMethod === value ? "active" : ""}`}
                      onClick={() => setSaleMethod(value as SaleMethod)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <label className="mkt-field">
                  <span>Choose name</span>
                  <select value={selectedOwnedName} onChange={(event) => setSelectedOwnedName(event.target.value)}>
                    {ownedNames.map((domain) => (
                      <option key={domain.node} value={domain.label}>
                        {domain.label}.rise
                      </option>
                    ))}
                  </select>
                </label>

                {saleMethod === "auction" ? (
                  <>
                    <div className="mkt-field-grid">
                      <label className="mkt-field">
                        <span>Opening reserve</span>
                        <input value={reserveEth} onChange={(event) => setReserveEth(event.target.value)} inputMode="decimal" />
                      </label>
                      <label className="mkt-field">
                        <span>Duration</span>
                        <input value={auctionDays} onChange={(event) => setAuctionDays(event.target.value)} inputMode="numeric" />
                      </label>
                    </div>
                    <div className="mkt-auction-estimate">
                      Opening reserve: {formatUsd(reserveUsd)}. Each new bid must clear the 5% minimum step.
                    </div>
                  </>
                ) : (
                  <>
                    <label className="mkt-field">
                      <span>Fixed price</span>
                      <input value={fixedPriceEth} onChange={(event) => setFixedPriceEth(event.target.value)} inputMode="decimal" />
                    </label>
                    <div className="mkt-auction-estimate">
                      Fixed price: {formatUsd(fixedPriceUsd)}. Buyers can purchase immediately at this amount.
                    </div>
                  </>
                )}

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

                {pendingReturns && pendingReturns > 0n ? (
                  <button
                    type="button"
                    onClick={() => withdrawMarketplaceReturns()}
                    disabled={isWithdrawBusy}
                    className="btn-secondary names-action-btn w-full disabled:opacity-60"
                  >
                    {isWithdrawBusy ? <InlineLoading label="Withdrawing..." /> : `Withdraw refunds · ${withdrawableEth} ETH`}
                  </button>
                ) : null}
              </div>
            </>
          ) : null}

          <Link to="/domains" className="btn-primary names-action-btn mt-5">
            Register a name <ArrowRight className="w-4 h-4" />
          </Link>
        </aside>
      </section>

      {featuredReserved.length > 0 ? (
        <section className="mkt-reserved-section">
          <div className="names-card-heading">
            <div>
              <div className="nm-suggest-label">Reserved board</div>
              <h2 className="font-display text-2xl text-ink mt-1">Curated names going to market</h2>
            </div>
            <span className="nm-tag nm-tag-search">Admin managed</span>
          </div>
          <p className="text-body-sm text-ink-muted mt-3 max-w-2xl">
            These reserved .rise names are being staged from the admin panel. Watch any one to get emailed when it moves.
          </p>
          <div className="mkt-grid mt-5">
            {featuredReserved.map((reserved) => {
              const priceWei =
                reserved.saleMode === "buy_now" ? reserved.fixedPriceWei : reserved.reservePriceWei;
              const usdValue =
                priceWei && ethUsd ? Number(formatEther(priceWei)) * ethUsd : null;
              return (
                <div key={`${reserved.chainId}-${reserved.label}`} className="mkt-card mkt-card-preview">
                  <div className="mkt-card-top">
                    <div>
                      <div className="mkt-card-name">
                        {reserved.label}
                        <span className="tld">.rise</span>
                      </div>
                      <div className="mkt-card-seller">{reserved.category.replace(/_/g, " ")}</div>
                    </div>
                    <span className="nm-tier">
                      {reserved.saleMode === "buy_now" ? "Fixed price" : "Auction"}
                    </span>
                  </div>
                  <div className="mkt-card-price-row">
                    <div>
                      <div className="mkt-price-lbl">
                        {reserved.saleMode === "buy_now" ? "Target price" : "Opening reserve"}
                      </div>
                      <div className="mkt-price-eth">
                        {priceWei ? `${formatEthCompact(priceWei)} ETH` : "TBA"}
                      </div>
                      <div className="mkt-price-usd-value">
                        ≈ {priceWei ? formatUsd(usdValue) : "Price pending"}
                      </div>
                    </div>
                    <div className="mkt-price-right">
                      <div className="mkt-price-lbl">State</div>
                      <div className="mkt-price-meta">Coming up</div>
                      <div className="mkt-price-subtle">
                        {reserved.saleMode === "buy_now" ? "Watch sale alerts" : "Watch auction alerts"}
                      </div>
                    </div>
                  </div>
                  <div className="mkt-card-actions">
                    <button
                      type="button"
                      onClick={() => handleOpenReservedDetails(reserved)}
                      className="mkt-card-cta is-auction"
                    >
                      View details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

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
              const isOwnEntry = address?.toLowerCase() === card.raw.seller.toLowerCase();
              const isAuction = card.kind === "auction";
              const showSettle = isAuction && card.raw.status === "ended";

              return (
                <div key={card.id} className="mkt-card">
                  <div className="mkt-card-top">
                    <div>
                      <div className="mkt-card-name">
                        {card.label}
                        <span className="tld">.rise</span>
                      </div>
                      <div className="mkt-card-seller">by {card.seller}</div>
                    </div>
                  </div>
                  <div className="mkt-card-price-row">
                    <div>
                      <div className="mkt-price-lbl">
                        {isAuction && card.raw.highestBid > 0n ? "Current bid" : isAuction ? "Reserve" : "Price"}
                      </div>
                      <div className="mkt-price-eth">{formatEthCompact(card.priceWei)} ETH</div>
                      <div className="mkt-price-usd-value">≈ {formatUsd(usdValue)}</div>
                    </div>
                    <div className="mkt-price-right">
                      <div className="mkt-price-lbl">{isAuction ? "Status" : "Length"}</div>
                      <div className={`mkt-price-meta ${isAuction ? "timer" : ""}`}>
                        {isAuction
                          ? card.raw.status === "scheduled"
                            ? `Starts ${formatTimeLeft(card.raw.startTime, nowUnix)}`
                            : card.raw.status === "active"
                              ? formatTimeLeft(card.raw.endTime, nowUnix)
                              : "Ended"
                          : `${card.length} char`}
                      </div>
                      <div className="mkt-price-subtle">{cardStatusLabel(card, nowUnix)}</div>
                    </div>
                  </div>

                  {isAuction ? (
                    <div className="mkt-auction-strip">
                      <span className="mkt-auction-pill">
                        {card.raw.bidCount} bid{card.raw.bidCount === 1 ? "" : "s"}
                      </span>
                      <span className="mkt-auction-pill is-secondary">
                        {card.raw.highestBidder
                          ? `Top ${shortSeller(card.raw.highestBidder)}`
                          : "Waiting for first bid"}
                      </span>
                    </div>
                  ) : null}

                  {showSettle ? (
                    <button
                      type="button"
                      onClick={() => handleOpenAuctionDetails(card.raw)}
                      className="mkt-card-cta is-auction"
                    >
                      View auction
                    </button>
                  ) : isAuction ? (
                    <button
                      type="button"
                      onClick={() => handleOpenAuctionDetails(card.raw)}
                      className="mkt-card-cta is-auction"
                    >
                      View auction
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleBuyListing(card.raw)}
                      disabled={isOwnEntry || isBuyListingBusy}
                      className="mkt-card-cta is-buy-now"
                    >
                      {isOwnEntry ? "Your listing" : isBuyListingBusy ? <InlineLoading label="Buying..." /> : "Buy now"}
                    </button>
                  )}
                </div>
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

      <section className="mkt-list-banner">
        <div>
          <div className="eyebrow">Live market</div>
          <h2 className="font-display text-3xl text-ink mt-2">List it for sale or auction</h2>
          <p className="text-body-sm text-ink-muted mt-3 max-w-md">
            Sellers can choose fixed-price sales or timed auctions. Bidders can follow auctions with optional email updates.
          </p>
        </div>
        <Link to="/domains" className="btn-primary names-action-btn">
          Manage names <ArrowRight className="w-4 h-4" />
        </Link>
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
            ) : (
              detailSheet.reserved.fqdn
            )
          }
          description={
            detailSheet.kind === "auction"
              ? `Seller ${shortSeller(detailSheet.auction.seller)} · ${
                  detailSheet.auction.status === "scheduled"
                    ? "Starts soon"
                    : detailSheet.auction.status === "active"
                      ? "Live now"
                      : detailSheet.auction.status === "ended"
                        ? "Awaiting settlement"
                        : detailSheet.auction.status
                }`
              : `${detailSheet.reserved.category.replace(/_/g, " ")} · ${
                  detailSheet.reserved.saleMode === "buy_now" ? "Fixed-price setup" : "Auction setup"
                }`
          }
        >
          {detailSheet.kind === "auction" ? (() => {
            const auction = detailSheet.auction;
            const currentBid = auction.highestBid > 0n ? auction.highestBid : auction.reservePrice;
            const currentBidUsd = ethUsd ? Number(formatEther(currentBid)) * ethUsd : null;
            const nextBidUsd =
              detailMinimumNextBid && ethUsd ? Number(formatEther(detailMinimumNextBid)) * ethUsd : null;
            const isOwnAuction = address?.toLowerCase() === auction.seller.toLowerCase();
            const canSettle = auction.status === "ended";
            const canBid = auction.status === "active" && !isOwnAuction;
            return (
              <>
                <div className="eyebrow">Auction details</div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-card-border bg-card-soft p-4">
                    <div className="mkt-price-lbl">{auction.highestBid > 0n ? "Current bid" : "Reserve"}</div>
                    <div className="mkt-price-eth mt-1">{formatEthCompact(currentBid)} ETH</div>
                    <div className="mkt-price-usd-value">≈ {formatUsd(currentBidUsd)}</div>
                  </div>
                  <div className="rounded-2xl border border-card-border bg-card-soft p-4">
                    <div className="mkt-price-lbl">Bid activity</div>
                    <div className="mkt-price-eth mt-1">{auction.bidCount}</div>
                    <div className="mkt-price-subtle">
                      {auction.bidCount === 1 ? "1 bid placed" : `${auction.bidCount} bids placed`}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-card-border bg-card-soft p-4">
                    <div className="mkt-price-lbl">Lead wallet</div>
                    <div className="mkt-price-meta mt-1">
                      {auction.highestBidder ? shortSeller(auction.highestBidder) : "No bids yet"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-card-border bg-card-soft p-4">
                    <div className="mkt-price-lbl">Time</div>
                    <div className="mkt-price-meta mt-1">
                      {auction.status === "scheduled"
                        ? `Starts ${formatTimeLeft(auction.startTime, nowUnix)}`
                        : auction.status === "active"
                          ? formatTimeLeft(auction.endTime, nowUnix)
                          : "Ended"}
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-card-border bg-card-soft p-4">
                  <div className="mkt-price-lbl">Next valid bid</div>
                  <div className="mkt-price-eth mt-1">
                    {detailMinimumNextBid ? `${formatEthCompact(detailMinimumNextBid)} ETH` : "Waiting to calculate"}
                  </div>
                  <div className="mkt-price-usd-value">
                    ≈ {detailMinimumNextBid ? formatUsd(nextBidUsd) : "USD loading"}
                  </div>
                  <p className="mt-3 text-body-sm text-ink-muted">
                    New bids must clear the current top by at least 5%. If late bids come in, the auction timer rolls forward using the Stage0 extension rules.
                  </p>
                </div>

                <div className="mt-6 grid gap-3">
                  {canSettle ? (
                    <button
                      type="button"
                      onClick={() => handleSettleAuction(auction)}
                      disabled={isSettleAuctionBusy}
                      className="btn-primary names-action-btn w-full disabled:opacity-60"
                    >
                      {isSettleAuctionBusy ? <InlineLoading label="Settling..." /> : "Settle auction"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenBidModal(auction)}
                      disabled={!canBid || isBidAuctionBusy}
                      className="btn-primary names-action-btn w-full disabled:opacity-60"
                    >
                      {auction.status === "scheduled"
                        ? "Bidding opens soon"
                        : isOwnAuction
                          ? "Your auction"
                          : isBidAuctionBusy
                            ? <InlineLoading label="Submitting bid..." />
                            : "Place bid"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenWatchAuctionModal(auction)}
                    className="btn-secondary names-action-btn w-full"
                  >
                    Watch by email
                  </button>
                </div>
              </>
            );
          })() : (
            <>
              <div className="eyebrow">Reserved name</div>

              <div className="rounded-2xl border border-card-border bg-card-soft p-4">
                <div className="mkt-price-lbl">
                  {detailSheet.reserved.saleMode === "buy_now" ? "Target price" : "Opening reserve"}
                </div>
                <div className="mkt-price-eth mt-1">
                  {(() => {
                    const priceWei =
                      detailSheet.reserved.saleMode === "buy_now"
                        ? detailSheet.reserved.fixedPriceWei
                        : detailSheet.reserved.reservePriceWei;
                    return priceWei ? `${formatEthCompact(priceWei)} ETH` : "TBA";
                  })()}
                </div>
                <div className="mkt-price-usd-value">
                  {(() => {
                    const priceWei =
                      detailSheet.reserved.saleMode === "buy_now"
                        ? detailSheet.reserved.fixedPriceWei
                        : detailSheet.reserved.reservePriceWei;
                    const usdValue = priceWei && ethUsd ? Number(formatEther(priceWei)) * ethUsd : null;
                    return `≈ ${priceWei ? formatUsd(usdValue) : "Price pending"}`;
                  })()}
                </div>
                <p className="mt-3 text-body-sm text-ink-muted">
                  This name is reserved by Stage0 policy. Join the watchlist and Senna will email you when it moves into a live marketplace flow.
                </p>
              </div>

              <div className="mt-6 grid gap-3">
                <button
                  type="button"
                  onClick={() => handleOpenWatchReservedModal(detailSheet.reserved)}
                  className="btn-primary names-action-btn w-full"
                >
                  Join watchlist
                </button>
              </div>
            </>
          )}
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
              ? `Follow ${notifyModal.auction.name}.rise`
              : notifyModal.kind === "watch-auction"
                ? `Watch ${notifyModal.auction.name}.rise`
                : notifyModal.kind === "watch-reserved"
                  ? `Watch ${notifyModal.reserved.fqdn}`
                  : `Follow ${notifyModal.name}.rise`
          }
          description={
            notifyModal.kind === "watch-auction" || notifyModal.kind === "watch-reserved"
              ? "Add an email to join the watchlist for this name. Stage0 will send updates when the auction moves."
              : "Add an email if you want Stage0 to send updates about this listing or auction. Leave it blank if you do not need alerts."
          }
          className="max-w-md"
        >
          <div className="eyebrow">Email updates</div>

          {notifyModal.kind === "bid-auction" ? (
            <div className="mkt-field mt-5">
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
                : "Continue"}
            </button>
          </div>
        </ResponsiveDialog>
      ) : null}
    </motion.div>
  );
}

export default DomainsMarketplacePage;
