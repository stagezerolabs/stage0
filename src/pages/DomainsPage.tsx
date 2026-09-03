import NamesSubnav from "@/components/rns/NamesSubnav";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  fetchRnsMarketplaceReserved,
  fetchRnsNameResolution,
  fetchRnsPrimaryAuctions,
  fetchRnsPricing,
  type RnsPrimaryAuctionSummary,
  type RnsPricingSummary,
  type RnsReservedNameSummary,
} from "@/lib/api/rns";
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  History,
  Search,
  Star,
  Trash2,
  Wallet,
} from "@/components/ui/icons";
import { InlineLoading, Spinner } from "@/components/ui/spinner";
import { getExplorerUrl, riseMainnet } from "@/config";
import {
  formatDomainDisplay,
  normalizeDomainName,
  validateDomainName,
} from "@/lib/domains/storage";
import {
  useRnsContracts,
  useRnsExpiry,
  useRnsNameStatus,
  useRnsOwnedLabel,
  useRnsRegister,
  useRnsRegistrationQuote,
  useRnsRelease,
  useRnsRenew,
} from "@/lib/hooks/rns";
import { RNSResolver } from "@/lib/rns/abis";
import { RNS_DEFAULT_REGISTRATION_DURATION } from "@/lib/rns/constants";
import { setPrimaryLabel } from "@/lib/rns/primary-label";
import { saveRecentRegistration } from "@/lib/rns/recent-registration";
import { rnsNamehash } from "@/lib/rns/utils";
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { formatEther } from "viem";
import {
  useAccount,
  useBalance,
  useChainId,
  useSwitchChain,
  useWriteContract,
} from "wagmi";

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const SUGGESTIONS = ["stage0", "risehub", "antigravity", "mainnet", "builder"];

const REGISTRATION_PERIODS = [
  { years: 1, label: "Starter" },
  { years: 2, label: "Steady" },
  { years: 3, label: "Builder" },
  { years: 5, label: "Diamond hand" },
] as const;

const WEI_PER_ETH = 1_000_000_000_000_000_000n;
const MICROS_PER_USD = 1_000_000n;

function formatEthValue(value: bigint) {
  const numeric = Number(formatEther(value));
  if (!Number.isFinite(numeric) || numeric === 0) return "0 ETH";
  if (numeric >= 1) return `${numeric.toFixed(2)} ETH`;
  if (numeric >= 0.01)
    return `${numeric.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")} ETH`;
  return `${numeric.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")} ETH`;
}

function formatUsdValue(value?: string | number | null) {
  if (value === undefined || value === null || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return `$${numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function discountLabel(display?: { discountBps?: number; discountPercent?: string }) {
  if (!display?.discountBps) return "No loyalty discount";
  return `${display.discountPercent ?? display.discountBps / 100}% loyalty discount`;
}

function getUsdCentsPerYearForLength(pricing: RnsPricingSummary | null, length: number) {
  if (!pricing || length <= 0) return null;
  const tier = pricing.tiers.find((item) => length >= item.minLength && length <= item.maxLength);
  return tier ? BigInt(tier.usdCentsPerYear) : null;
}

function getPriceMultiplierBps(pricing: RnsPricingSummary | null, years: number) {
  if (!pricing) return 10_000;
  const schedule = pricing.multiYearPolicy.schedule ?? [];
  const exact = schedule.find((item) => item.years === years);
  if (exact) return exact.priceMultiplierBps;

  const eligible = [...schedule]
    .sort((a, b) => a.years - b.years)
    .filter((item) => years >= item.years);
  const fallback = eligible[eligible.length - 1];

  return fallback?.priceMultiplierBps ?? 10_000;
}

function estimateRegistrationTotals(
  pricing: RnsPricingSummary | null,
  labelLength: number,
  years: number,
) {
  const usdCentsPerYear = getUsdCentsPerYearForLength(pricing, labelLength);
  if (!pricing || !usdCentsPerYear || years <= 0) return null;

  const subtotalUsdCents = usdCentsPerYear * BigInt(years);
  const priceMultiplierBps = getPriceMultiplierBps(pricing, years);
  const totalUsdCents = (subtotalUsdCents * BigInt(priceMultiplierBps)) / 10_000n;
  const discountUsdCents = subtotalUsdCents - totalUsdCents;
  const ethPriceMicros = BigInt(Math.round(pricing.ethUsd * Number(MICROS_PER_USD)));
  if (ethPriceMicros <= 0n) return null;

  const priceWei = ((totalUsdCents * 10_000n) * WEI_PER_ETH) / ethPriceMicros;

  return {
    priceWei,
    subtotalUsd: Number(subtotalUsdCents) / 100,
    totalUsd: Number(totalUsdCents) / 100,
    discountBps: Math.max(0, 10_000 - priceMultiplierBps),
    discountUsd: Number(discountUsdCents) / 100,
  };
}

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatExpiry(expiry: bigint | number) {
  const value = Number(expiry);
  if (!value) return null;
  return new Date(value * 1000).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });
}

function getAuctionDisplayPrice(auction: RnsPrimaryAuctionSummary) {
  return auction.highestBid > 0n ? auction.highestBid : auction.reservePrice;
}

function getReservedDisplayPrice(name: RnsReservedNameSummary) {
  return name.saleMode === "buy_now" ? name.fixedPriceWei : name.reservePriceWei;
}

type ShortMarketItem =
  | { kind: "auction"; label: string; priceWei: bigint; meta: string; rank: number; key: string }
  | { kind: "reserved"; label: string; priceWei: bigint; meta: string; rank: number; key: string };

function buildSearchSuggestions(input: string) {
  const clean = normalizeDomainName(input);
  if (!clean) return [];

  const candidates = [
    clean,
    `${clean}hq`,
    `${clean}labs`,
    `${clean}dao`,
    `get${clean}`,
    `${clean}x`,
  ];

  return [...new Set(candidates)]
    .filter((name) => validateDomainName(name).valid)
    .slice(0, 5);
}

function tierLabelFor(length: number) {
  if (length <= 3) return "Rare";
  if (length === 4) return "Short";
  return "Standard";
}

const RENEWAL_WINDOW_SECONDS = 60 * 24 * 60 * 60;

// Filled verified seal — primary-name marker (replaces the hollow star).
function PrimarySeal({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ flexShrink: 0 }}
      aria-hidden
    >
      <path
        d="M12 1.6l2.6 1.7 3.1.2.9 3 2.2 2.2-1.3 2.8.6 3.1-2.8 1.4-1.4 2.8-3.1-.3L12 22.4l-2.5-1.9-3.1.3-1.4-2.8L2.2 16.6l.6-3.1L1.5 10.7l2.2-2.2.9-3 3.1-.2z"
        fill="currentColor"
      />
      <path
        d="M8.4 12.3l2.4 2.4 4.8-5"
        stroke="rgb(var(--color-accent-foreground))"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type OwnedDomainSummary = {
  node: string;
  label: string;
  expiry: bigint | number;
  custody?: "wallet" | "marketplace_listing" | "marketplace_auction";
  marketplace?: {
    kind: "listing" | "auction";
    status: string;
  } | null;
};

function getDomainCustody(domain: Pick<OwnedDomainSummary, "custody">) {
  return domain.custody ?? "wallet";
}

function isMarketplaceCustody(domain: Pick<OwnedDomainSummary, "custody">) {
  return getDomainCustody(domain) !== "wallet";
}

function getMarketplaceStatusLabel(domain: OwnedDomainSummary) {
  if (domain.marketplace?.kind === "listing") return "Listed";
  if (domain.marketplace?.status === "ended") return "Auction ended";
  if (domain.marketplace?.status === "scheduled") return "Auction scheduled";
  if (domain.marketplace?.kind === "auction") return "In auction";
  return "In marketplace";
}

/**
 * One card in the "Your names" portfolio grid.
 *
 * Each card owns its own renew quote + write so any name can be renewed (the
 * page-level renew flow only ever covered the primary). The quote is only
 * fetched when the name is in its renewal window or the user explicitly arms a
 * renewal, so the grid doesn't fan out N quote requests on load.
 */
const OwnedNameCard: React.FC<{
  domain: OwnedDomainSummary;
  isPrimary: boolean;
  onSetPrimary: (label: string) => void;
  onRenewed: () => void;
}> = ({ domain, isPrimary, onSetPrimary, onRenewed }) => {
  const { isConnected } = useAccount();
  const [renewArmed, setRenewArmed] = useState(false);
  const firedRef = useRef(false);
  const isEscrowed = isMarketplaceCustody(domain);
  const marketplaceLabel = getMarketplaceStatusLabel(domain);

  const expirySec = Number(domain.expiry);
  const nowSec = Math.floor(Date.now() / 1000);
  const isExpired = expirySec > 0 && expirySec < nowSec;
  const isSoon =
    expirySec > 0 && !isExpired && expirySec - nowSec <= RENEWAL_WINDOW_SECONDS;

  const {
    price: renewPrice = 0n,
    signedQuote,
    signature,
    isLoading: isQuoteLoading,
  } = useRnsRegistrationQuote(domain.label, {
    action: "renew",
    enabled: !isEscrowed && isConnected && Boolean(domain.label) && (isSoon || renewArmed),
  });

  const { renew, isPending, isConfirming, isSuccess, error } = useRnsRenew();
  const isBusy = isPending || isConfirming;

  const {
    release,
    isPending: isReleasePending,
    isConfirming: isReleaseConfirming,
    isSuccess: isReleaseSuccess,
    error: releaseError,
  } = useRnsRelease();
  const isReleasing = isReleasePending || isReleaseConfirming;

  // Once armed, fire the renewal as soon as the signed quote lands.
  useEffect(() => {
    if (!renewArmed || isBusy || firedRef.current) return;
    if (!signedQuote || !signature) return;
    firedRef.current = true;
    renew({ name: domain.label, value: renewPrice, quote: signedQuote, signature });
  }, [renewArmed, isBusy, signedQuote, signature, renewPrice, renew, domain.label]);

  useEffect(() => {
    if (!isSuccess) return;
    toast.success(`Renewed ${formatDomainDisplay(domain.label)}`);
    setRenewArmed(false);
    firedRef.current = false;
    onRenewed();
  }, [isSuccess, domain.label, onRenewed]);

  useEffect(() => {
    if (!error) return;
    toast.error(error.message.split("\n")[0] ?? "Renewal failed.");
    setRenewArmed(false);
    firedRef.current = false;
  }, [error]);

  useEffect(() => {
    if (isReleaseSuccess) {
      toast.success(`${formatDomainDisplay(domain.label)} released.`);
      onRenewed();
    }
  }, [isReleaseSuccess, domain.label, onRenewed]);

  useEffect(() => {
    if (releaseError) {
      toast.error(releaseError.message.split("\n")[0] ?? "Release failed.");
    }
  }, [releaseError]);

  const handleRelease = () => {
    if (!isConnected) {
      toast.error("Connect your wallet to release a name.");
      return;
    }
    if (!window.confirm(`Release ${formatDomainDisplay(domain.label)}? This cannot be undone.`))
      return;
    release({ name: domain.label });
  };

  const handleRenew = () => {
    if (!isConnected) {
      toast.error("Connect your wallet to renew a name.");
      return;
    }
    if (signedQuote && signature) {
      firedRef.current = true;
      renew({ name: domain.label, value: renewPrice, quote: signedQuote, signature });
      return;
    }
    setRenewArmed(true);
  };

  const renewLabel = isBusy
    ? <InlineLoading label="Renewing..." size="xs" />
    : renewArmed && isQuoteLoading
      ? <InlineLoading label="Loading..." size="xs" variant="dots" />
      : isSoon && renewPrice > 0n
        ? `Renew · ${formatEthValue(renewPrice)}`
        : "Renew";

  const expiryText = (() => {
    if (expirySec <= 0) return "Registered";
    const date = formatExpiry(expirySec);
    if (isExpired) return `Expired · ${date}`;
    if (isSoon) return `Expires soon · ${date}`;
    return `Expires ${date}`;
  })();

  return (
    <div className={`own-card ${isPrimary ? "is-primary" : ""} ${isEscrowed ? "is-marketplace" : ""}`}>
      <div className="own-card-head">
        <div className="own-name">
          {domain.label}
          <span className="tld">.rise</span>
        </div>
        {isEscrowed ? (
          <span className="nm-tag nm-tag-auction">{marketplaceLabel}</span>
        ) : isPrimary ? (
          <span className="nm-dur-badge nm-dur-primary-badge">Primary</span>
        ) : (
          <button
            type="button"
            className="own-make-pill"
            onClick={() => onSetPrimary(domain.label)}
          >
            Make primary
          </button>
        )}
      </div>
      <div className={`own-exp ${isSoon || isExpired ? "soon" : ""}`}>{expiryText}</div>
      <div className={`own-actions ${isEscrowed ? "single" : ""}`}>
        {isEscrowed ? (
          <Link to="/domains/marketplace" className="own-btn primary">
            View marketplace
          </Link>
        ) : (
          <>
            <button
              type="button"
              className="own-btn primary"
              onClick={handleRenew}
              disabled={isBusy}
            >
              {renewLabel}
            </button>
            <div className="own-actions-row">
              <Link to="/domains/marketplace" className="own-btn">
                List
              </Link>
              <button
                type="button"
                className="own-btn own-btn-release"
                onClick={handleRelease}
                disabled={isReleasing}
              >
                {isReleasing ? <InlineLoading label="Releasing..." size="xs" /> : "Release"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const DomainsPage: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const chainId = useChainId();
  const isCorrectChain = chainId === riseMainnet.id;
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const explorerUrl = getExplorerUrl(chainId);
  const { resolver: resolverAddress } = useRnsContracts();
  const { writeContract: writeResolverText } = useWriteContract();

  const { data: balanceData } = useBalance({
    address,
    chainId: riseMainnet.id,
    query: { enabled: isConnected && Boolean(address) },
  });

  const [hintLabel, setHintLabel] = useState<string | null>(null);
  const lastRegisteredRef = useRef<string>("");
  const lastRegisteredDurationSecondsRef = useRef<number>(
    Number(RNS_DEFAULT_REGISTRATION_DURATION),
  );
  const setTextFiredRef = useRef(false);

  const {
    label: ownedLabel,
    displayName: ownedDisplayName,
    refetch: refetchOwned,
    expiry: ownedExpiry,
    isLoading: isOwnedLoading,
    allDomains: ownedDomains,
  } = useRnsOwnedLabel(address, hintLabel ?? undefined);

  const [searchParams, setSearchParams] = useSearchParams();
  const [pricing, setPricing] = useState<RnsPricingSummary | null>(null);
  const [shortNameAuctions, setShortNameAuctions] = useState<RnsPrimaryAuctionSummary[]>([]);
  const [reservedShortNames, setReservedShortNames] = useState<RnsReservedNameSummary[]>([]);
  const initialQueryName = useMemo(() => {
    const raw =
      (searchParams.get("name") ?? searchParams.get("q"))
        ?.trim()
        .toLowerCase() ?? "";
    if (!raw) return "";
    const normalizedInitial = normalizeDomainName(raw);
    return /^[a-z0-9-]{3,32}$/.test(normalizedInitial) ? normalizedInitial : "";
  }, [searchParams]);

  const [query, setQuery] = useState(initialQueryName);
  const [submittedQuery, setSubmittedQuery] = useState(initialQueryName);
  const [selectedYears, setSelectedYears] = useState(1);

  useEffect(() => {
    if (!initialQueryName) return;
    setQuery(initialQueryName);
    setSubmittedQuery(initialQueryName);
    const next = new URLSearchParams(searchParams);
    next.delete("name");
    next.delete("q");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQueryName]);

  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("rns_search_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const normalized = useMemo(
    () => normalizeDomainName(submittedQuery),
    [submittedQuery],
  );
  const validation = useMemo(
    () => validateDomainName(normalized),
    [normalized],
  );
  const selectedDuration = useMemo(
    () => RNS_DEFAULT_REGISTRATION_DURATION * BigInt(selectedYears),
    [selectedYears],
  );
  const selectedDurationSeconds = useMemo(
    () => Number(selectedDuration),
    [selectedDuration],
  );

  const nameStatusEnabled = validation.valid && Boolean(normalized);
  const {
    available: onChainAvailable,
    owner: onChainOwner,
    isTaken: onChainIsTaken,
    isReserved,
    isLoading: isStatusLoading,
    refetch: refetchStatus,
  } = useRnsNameStatus(normalized, { enabled: nameStatusEnabled });

  const available = onChainAvailable;

  const takenBy = useMemo(() => {
    if (isReserved) return "0x0000000000000000000000000000000000000000";
    return onChainOwner;
  }, [isReserved, onChainOwner]);

  const isTaken = useMemo(() => {
    if (isReserved) return true;
    return onChainIsTaken;
  }, [isReserved, onChainIsTaken]);

  const ownedDomainsWithLabels = useMemo(
    () =>
      ownedDomains
        .filter((domain) => Boolean(domain.label))
        .sort((a, b) => {
          if (a.label === ownedLabel) return -1;
          if (b.label === ownedLabel) return 1;
          return 0;
        }),
    [ownedDomains, ownedLabel],
  );
  const registrationPeriodEstimates = useMemo(() => {
    const length = normalized.length;
    return REGISTRATION_PERIODS.reduce<Record<number, ReturnType<typeof estimateRegistrationTotals>>>((acc, period) => {
      acc[period.years] = estimateRegistrationTotals(pricing, length, period.years);
      return acc;
    }, {});
  }, [normalized.length, pricing]);

  const matchedOwnedDomain = useMemo(() => {
    if (!normalized || !address || !isTaken) return null;
    return ownedDomainsWithLabels.find((domain) => domain.label === normalized) ?? null;
  }, [normalized, address, isTaken, ownedDomainsWithLabels]);
  const isOwnedByMe = Boolean(matchedOwnedDomain);
  const isSearchedNameEscrowed = matchedOwnedDomain ? isMarketplaceCustody(matchedOwnedDomain) : false;
  const searchedNameMarketStatus = matchedOwnedDomain ? getMarketplaceStatusLabel(matchedOwnedDomain) : null;

  const {
    price: registerPrice = 0n,
    signedQuote: registerSignedQuote,
    signature: registerSignature,
    display: registerDisplay,
    isLoading: isRegisterQuoteLoading,
  } = useRnsRegistrationQuote(normalized, {
      duration: selectedDuration,
      enabled: nameStatusEnabled && available,
    });

  const {
    price: renewPrice = 0n,
    signedQuote: renewSignedQuote,
    signature: renewSignature,
    display: renewDisplay,
    isLoading: isRenewQuoteLoading,
  } = useRnsRegistrationQuote(ownedLabel ?? "", {
    action: "renew",
    enabled: Boolean(ownedLabel),
  });

  const {
    register,
    hash: registerHash,
    isPending: isRegisterPending,
    isConfirming: isRegisterConfirming,
    isSuccess: isRegisterSuccess,
    error: registerError,
    reset: resetRegister,
  } = useRnsRegister();

  const {
    renew,
    isPending: isRenewPending,
    isConfirming: isRenewConfirming,
    isSuccess: isRenewSuccess,
    error: renewError,
  } = useRnsRenew();

  const { expiry: searchExpiry = 0n } = useRnsExpiry(normalized, {
    enabled: validation.valid && Boolean(normalized) && isTaken && !available,
  });

  const isRegistering = isRegisterPending || isRegisterConfirming;
  const isRenewing = isRenewPending || isRenewConfirming;

  const userBalance = balanceData?.value ?? 0n;
  const hasSufficientBalance =
    !balanceData || registerPrice === 0n || userBalance >= registerPrice;
  const selectedRegistrationEstimate = registrationPeriodEstimates[selectedYears];
  const displayedRegisterPrice = registerPrice > 0n
    ? registerPrice
    : selectedRegistrationEstimate?.priceWei ?? 0n;
  const registerUsdTotal = formatUsdValue(
    registerDisplay?.totalUsd ?? selectedRegistrationEstimate?.totalUsd,
  );
  const registerUsdSubtotal = formatUsdValue(
    registerDisplay?.subtotalUsd ?? selectedRegistrationEstimate?.subtotalUsd,
  );
  const registerDiscountBps =
    registerDisplay?.discountBps ?? selectedRegistrationEstimate?.discountBps ?? 0;
  const registerUsdDiscount = formatUsdValue(
    registerDisplay?.discountUsd ?? selectedRegistrationEstimate?.discountUsd,
  );
  const renewUsdTotal = formatUsdValue(renewDisplay?.totalUsd);
  const ethUsd = pricing?.ethUsd ?? null;

  useEffect(() => {
    let cancelled = false;

    void fetchRnsPricing({ chainId: riseMainnet.id })
      .then((next) => {
        if (!cancelled) setPricing(next);
      })
      .catch(() => {
        if (!cancelled) setPricing(null);
      });

    void fetchRnsPrimaryAuctions({ chainId: riseMainnet.id, limit: 100 })
      .then((auctions) => {
        if (cancelled) return;
        setShortNameAuctions(
          auctions
            .filter((auction) => ["active", "scheduled"].includes(auction.status) && auction.name.length <= 4)
            .sort((a, b) => {
              const aPrice = getAuctionDisplayPrice(a);
              const bPrice = getAuctionDisplayPrice(b);
              if (aPrice === bPrice) return Number(a.endTime - b.endTime);
              return aPrice > bPrice ? -1 : 1;
            })
            .slice(0, 4),
        );
      })
      .catch(() => {
        if (!cancelled) setShortNameAuctions([]);
      });

    void fetchRnsMarketplaceReserved({ chainId: riseMainnet.id })
      .then((names) => {
        if (cancelled) return;
        setReservedShortNames(
          names
            .filter((name) => name.enabled && name.label.length <= 4)
            .sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label)),
        );
      })
      .catch(() => {
        if (!cancelled) setReservedShortNames([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const shortMarketItems = useMemo<ShortMarketItem[]>(() => {
    const auctionLabels = new Set(shortNameAuctions.map((auction) => auction.name.toLowerCase()));
    const reservedRankByLabel = new Map(
      reservedShortNames.map((name) => [name.label.toLowerCase(), name.displayOrder]),
    );
    const reservedItems: ShortMarketItem[] = reservedShortNames
      .filter((name) => name.saleMode === "buy_now" && !auctionLabels.has(name.label.toLowerCase()))
      .map((name) => ({
        kind: "reserved",
        key: `reserved-${name.chainId}-${name.id}`,
        label: name.label,
        priceWei: getReservedDisplayPrice(name) ?? 0n,
        meta: name.saleMode === "buy_now" ? "Fixed price" : "0 bids",
        rank: name.displayOrder,
      }));
    const auctionItems: ShortMarketItem[] = shortNameAuctions.map((auction) => ({
      kind: "auction",
      key: `auction-${auction.auctionId.toString()}`,
      label: auction.name,
      priceWei: getAuctionDisplayPrice(auction),
      meta: `${auction.bidCount} bid${auction.bidCount === 1 ? "" : "s"}`,
      rank: reservedRankByLabel.get(auction.name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER,
    }));

    return [...reservedItems, ...auctionItems]
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        if (a.priceWei !== b.priceWei) return a.priceWei > b.priceWei ? -1 : 1;
        return a.label.localeCompare(b.label);
      })
      .slice(0, 4);
  }, [reservedShortNames, shortNameAuctions]);

  const nowSec = Math.floor(Date.now() / 1000);
  const ownedExpirySec = Number(ownedExpiry);
  const isOwnedExpired = ownedExpirySec > 0 && ownedExpirySec < nowSec;
  const twoMonthsSec = 60 * 24 * 60 * 60;
  const isWithinRenewalWindow =
    ownedExpirySec > 0 && ownedExpirySec - nowSec <= twoMonthsSec;

  const searchSuggestions = useMemo(
    () => buildSearchSuggestions(query),
    [query],
  );
  const typedShortName =
    query.length > 0 && normalizeDomainName(query).length < 3;

  const addToHistory = (name: string) => {
    if (!name.trim()) return;
    const clean = normalizeDomainName(name);
    setSearchHistory((prev) => {
      const filtered = prev.filter((item) => item !== clean);
      const next = [clean, ...filtered].slice(0, 5);
      localStorage.setItem("rns_search_history", JSON.stringify(next));
      return next;
    });
  };

  const clearHistory = (event: React.MouseEvent) => {
    event.stopPropagation();
    setSearchHistory([]);
    localStorage.removeItem("rns_search_history");
    toast.success("Search history cleared");
  };

  const handleSearchSubmit = (nextQuery = query) => {
    const cleanQuery = normalizeDomainName(nextQuery);
    if (!cleanQuery) return;
    setQuery(cleanQuery);
    setSubmittedQuery(cleanQuery);
    setSelectedYears(1);
    addToHistory(cleanQuery);
  };

  const handleSearchHistoryClick = (name: string) => {
    setQuery(name);
    setSubmittedQuery(name);
    setSelectedYears(1);
    addToHistory(name);
  };

  useEffect(() => {
    if (!isRegisterSuccess || !address) return;
    if (setTextFiredRef.current) return;
    setTextFiredRef.current = true;

    const registeredName =
      lastRegisteredRef.current ||
      localStorage.getItem("rns_pending_reg") ||
      normalized ||
      "";
    if (!registeredName) return;

    localStorage.removeItem("rns_pending_reg");
    lastRegisteredRef.current = "";

    const node = rnsNamehash(registeredName);
    saveRecentRegistration(
      address,
      registeredName,
      node,
      lastRegisteredDurationSecondsRef.current,
    );
    setPrimaryLabel(address, registeredName);
    writeResolverText({
      address: resolverAddress,
      abi: RNSResolver,
      functionName: "setText",
      args: [node, "label", registeredName],
    });
    setHintLabel(registeredName);
    void fetchRnsNameResolution({ name: registeredName, chainId }).finally(() => {
      void refetchOwned();
    });
    void refetchStatus();
    toast.success(`Registered ${formatDomainDisplay(registeredName)}`);
    resetRegister();
  }, [
    address,
    chainId,
    isRegisterSuccess,
    normalized,
    refetchOwned,
    refetchStatus,
    resetRegister,
    resolverAddress,
    writeResolverText,
  ]);

  useEffect(() => {
    if (ownedLabel && hintLabel && ownedLabel === hintLabel) {
      setHintLabel(null);
    }
  }, [ownedLabel, hintLabel]);

  useEffect(() => {
    if (registerError) {
      toast.error(
        registerError.message.split("\n")[0] ?? "Registration failed.",
      );
    }
  }, [registerError]);

  useEffect(() => {
    if (isRenewSuccess) {
      toast.success("Name renewed.");
      void refetchOwned();
    }
  }, [isRenewSuccess, refetchOwned]);

  useEffect(() => {
    if (renewError) {
      toast.error(renewError.message.split("\n")[0] ?? "Renewal failed.");
    }
  }, [renewError]);

  const handleRegister = () => {
    if (!isConnected || !address) {
      toast.error("Connect your wallet to register a name.");
      return;
    }
    if (!validation.valid || !available) return;
    if (!registerSignedQuote || !registerSignature) {
      toast.error("Registration quote is still loading. Try again in a moment.");
      return;
    }

    setTextFiredRef.current = false;
    lastRegisteredRef.current = normalized;
    lastRegisteredDurationSecondsRef.current = selectedDurationSeconds;
    localStorage.setItem("rns_pending_reg", normalized);
    register({
      name: normalized,
      duration: selectedDuration,
      value: registerPrice,
      quote: registerSignedQuote,
      signature: registerSignature,
    });
  };

  const handleRenew = () => {
    if (!ownedLabel) return;
    if (!renewSignedQuote || !renewSignature) {
      toast.error("Renewal quote is still loading. Try again in a moment.");
      return;
    }
    renew({
      name: ownedLabel,
      value: renewPrice,
      quote: renewSignedQuote,
      signature: renewSignature,
    });
  };

  const handleSetPrimary = (label: string) => {
    if (!address) return;
    setPrimaryLabel(address, label);
    void refetchOwned();
    toast.success(`${formatDomainDisplay(label)} set as your primary name.`);
  };

  const handleConnectWallet = () => {
    if (openConnectModal) {
      openConnectModal();
      return;
    }
    toast.error("Wallet connection is temporarily unavailable.");
  };

  const renderRegisterAction = () => {
    if (!isConnected) {
      return (
        <button
          type="button"
          onClick={handleConnectWallet}
          className="btn-primary names-action-btn"
        >
          <Wallet className="w-4 h-4" />
          Connect wallet to register
        </button>
      );
    }

    if (!isCorrectChain) {
      return (
        <button
          type="button"
          onClick={() => switchChain({ chainId: riseMainnet.id })}
          disabled={isSwitchingChain}
          className="btn-secondary names-action-btn text-status-error border-status-error disabled:opacity-60"
        >
          <AlertTriangle className="w-4 h-4" />
          {isSwitchingChain ? <InlineLoading label="Switching..." /> : "Switch Network"}
        </button>
      );
    }

    return (
      <>
        {!hasSufficientBalance &&
        !isRegisterQuoteLoading &&
        registerPrice > 0n ? (
          <div className="names-balance-warning">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>
              Need {formatEthValue(registerPrice)}. Balance{" "}
              {formatEthValue(userBalance)}.
            </span>
          </div>
        ) : null}
        <button
          type="button"
          onClick={handleRegister}
          disabled={
            isRegistering ||
            isOwnedLoading ||
            Boolean(balanceData && !hasSufficientBalance) ||
            isRegisterQuoteLoading ||
            !registerSignedQuote ||
            !registerSignature
          }
          className="btn-primary names-action-btn disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isRegistering ? (
            <InlineLoading label="Confirming..." />
          ) : isRegisterQuoteLoading ? (
            <InlineLoading label="Loading quote..." variant="dots" />
          ) : (
            "Register name"
          )}
        </button>
      </>
    );
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      className="names-page"
    >
      <motion.section variants={itemVariants} className="names-hero">
        <div>
          <div className="eyebrow">Rise Name Service</div>
          <h1 className="ds-h1 mt-2">Names</h1>
          <p className="text-body-lg text-ink-muted mt-3 max-w-2xl">
            Buy and register your very own{" "}
            <span className="font-mono text-accent">.rise</span> name for your
            wallet, apps, and community presence.
          </p>
        </div>
        <NamesSubnav />
      </motion.section>

      <div className="nm-layout">
          <div className="names-main-column">
            <motion.section
              variants={itemVariants}
              className="rns-card rns-card-pad"
            >
              <div className="names-card-heading">
                <div>
                  <div className="nm-suggest-label">Search</div>
                  <h2 className="font-display text-2xl text-ink mt-1">
                    Find a name
                  </h2>
                </div>
              </div>

              <div className="nm-search-box">
                <Search className="nm-search-icon w-5 h-5" />
                <input
                  id="domain-search"
                  type="text"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    if (event.target.value === "") {
                      setSubmittedQuery("");
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSearchSubmit();
                    }
                  }}
                  placeholder="Search a name"
                  className="nm-search-input"
                  autoComplete="off"
                  spellCheck={false}
                />
                <span className="nm-tld">.rise</span>
                <button
                  type="button"
                  onClick={() => handleSearchSubmit()}
                  className="btn-primary nm-search-btn"
                >
                  Search
                </button>
              </div>

              {typedShortName ? (
                <div className="nm-validation">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  One and two-character names are premium. Browse the
                  marketplace to find short names.
                </div>
              ) : null}

              {!submittedQuery && (
                <div className="names-discovery">
                  {searchSuggestions.length > 0 ? (
                    <>
                      <div className="nm-suggest-label">Quick checks</div>
                      <div className="nm-suggests">
                        {searchSuggestions.map((suggestion, index) => (
                          <button
                            key={suggestion}
                            type="button"
                            className="nm-suggest"
                            style={{ animationDelay: `${index * 45}ms` }}
                            onClick={() => handleSearchSubmit(suggestion)}
                          >
                            <span className="nm-suggest-left">
                              <span className="nm-suggest-name">
                                {suggestion}
                                <span className="tld">.rise</span>
                              </span>
                              <span className="nm-tag nm-tag-search">
                                Check
                              </span>
                            </span>
                            <span className="nm-suggest-right">
                              <span className="nm-tier">
                                {suggestion.length} chars
                              </span>
                              <ArrowRight className="nm-suggest-arrow w-4 h-4" />
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : searchHistory.length > 0 ? (
                    <div>
                      <div className="names-history-head">
                        <span className="nm-suggest-label">Search history</span>
                        <button
                          type="button"
                          onClick={clearHistory}
                          className="names-clear-history"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Clear
                        </button>
                      </div>
                      <div className="nm-suggests">
                        {searchHistory.map((item) => (
                          <button
                            key={item}
                            type="button"
                            className="nm-suggest"
                            onClick={() => handleSearchHistoryClick(item)}
                          >
                            <span className="nm-suggest-left">
                              <History className="w-4 h-4 text-ink-faint" />
                              <span className="nm-suggest-name">
                                {item}
                                <span className="tld">.rise</span>
                              </span>
                            </span>
                            <ArrowRight className="nm-suggest-arrow w-4 h-4" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="nm-suggest-label">
                        Recommended keywords
                      </div>
                      <div className="names-keyword-row">
                        {SUGGESTIONS.map((item) => (
                          <button
                            key={item}
                            type="button"
                            className="chip active-secondary"
                            onClick={() => handleSearchHistoryClick(item)}
                          >
                            #{item}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.section>

            <AnimatePresence mode="wait">
              {submittedQuery ? (
                <motion.section
                  key={submittedQuery}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: -10 }}
                  className="rns-card rns-card-pad"
                >
                  <div className="nm-suggest-label">Search result</div>

                  {isStatusLoading ? (
                    <div className="names-loading-state">
                      <InlineLoading
                        label={`Checking ${formatDomainDisplay(normalized)}...`}
                        variant="dots"
                      />
                    </div>
                  ) : validation.valid ? (
                    available ? (
                      <div className="nm-config">
                        <div className="nm-config-head">
                          <div>
                            <div className="names-result-tags">
                              <span className="nm-tag nm-tag-avail">
                                Available
                              </span>
                              <span className="nm-config-sub">
                                {tierLabelFor(normalized.length)} ·{" "}
                                {normalized.length} characters
                              </span>
                            </div>
                            <div className="nm-config-name">
                              {normalized}
                              <span className="tld">.rise</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="nm-back"
                            onClick={() => {
                              setSubmittedQuery("");
                              setQuery("");
                            }}
                          >
                            Change
                          </button>
                        </div>

                        <div className="names-period-block">
                          <div className="nm-suggest-label">
                            Registration period
                          </div>
                          <div className="nm-dur-grid">
                            {REGISTRATION_PERIODS.map((period) => (
                              <button
                                key={period.years}
                                type="button"
                                className={`nm-dur ${period.years === selectedYears ? "active" : ""}`}
                                onClick={() => setSelectedYears(period.years)}
                              >
                                {period.years === 3 ? (
                                  <span className="nm-dur-badge">Popular</span>
                                ) : null}
                                {(() => {
                                  const discountBps = pricing?.multiYearPolicy.schedule?.find(s => s.years === period.years)?.discountBps;
                                  if (!discountBps) return null;
                                  return (
                                    <span className="nm-dur-badge nm-dur-discount-badge">
                                      {discountBps / 100}% off
                                    </span>
                                  );
                                })()}
                                <div className="nm-dur-years">
                                  {period.years}
                                  <span>yr</span>
                                </div>
                                <div className="nm-dur-yr-lbl">
                                  {period.label}
                                </div>
                                <div className="nm-dur-price">
                                  {(() => {
                                    const isSelected = period.years === selectedYears;
                                    if (isSelected) {
                                      return (
                                        <>
                                          <span>{formatEthValue(displayedRegisterPrice)}</span>
                                          {registerUsdTotal ? <small>≈ {registerUsdTotal}</small> : null}
                                        </>
                                      );
                                    }
                                    const estimate = registrationPeriodEstimates[period.years];
                                    return (
                                      <>
                                        <span>{estimate ? formatEthValue(estimate.priceWei) : "..."}</span>
                                        {estimate ? <small>≈ {formatUsdValue(estimate.totalUsd)}</small> : null}
                                      </>
                                    );
                                  })()}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="nm-breakdown">
                          <div className="nm-bd-row">
                            <span>{selectedYears} year registration</span>
                            <b>
                              {isRegisterQuoteLoading && !selectedRegistrationEstimate
                                ? <Spinner size="xs" variant="dots" />
                                : registerUsdSubtotal ?? formatEthValue(displayedRegisterPrice)}
                            </b>
                          </div>
                          {registerDiscountBps ? (
                            <div className="nm-bd-row">
                              <span>
                                {discountLabel({
                                  discountBps: registerDiscountBps,
                                  discountPercent: `${registerDiscountBps / 100}`,
                                })}
                              </span>
                              <b className="text-accent-secondary">
                                -{registerUsdDiscount ?? "$0.00"}
                              </b>
                            </div>
                          ) : null}
                          <div className="nm-bd-row">
                            <span>Network gas</span>
                            <b className="text-ink-muted">Shown in wallet</b>
                          </div>
                          <div className="names-divider" />
                          <div className="nm-bd-total">
                            <span>Total due now</span>
                            <div className="text-right">
                              <div className="nm-bd-total-eth">
                                {isRegisterQuoteLoading && !selectedRegistrationEstimate
                                  ? <Spinner size="xs" variant="dots" />
                                  : formatEthValue(displayedRegisterPrice).replace(
                                      " ETH",
                                      "",
                                    )}
                                <small> ETH</small>
                              </div>
                              <div className="nm-bd-total-usd">
                                {registerUsdTotal
                                  ? `≈ ${registerUsdTotal}${registerDiscountBps ? ' after discount' : ''}`
                                  : "Paid on RISE Mainnet"}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="names-action-stack">
                          {renderRegisterAction()}
                          {registerHash ? (
                            <a
                              href={`${explorerUrl}/tx/${registerHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="names-tx-link"
                            >
                              View transaction{" "}
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ) : isOwnedByMe ? (
                      <div className={`names-result-card is-owned ${isSearchedNameEscrowed ? "is-marketplace" : ""}`}>
                        <div>
                          <div className="names-result-tags">
                            <span className={`nm-tag ${isSearchedNameEscrowed ? "nm-tag-auction" : "nm-tag-avail"}`}>
                              {isSearchedNameEscrowed ? searchedNameMarketStatus : "You own this"}
                            </span>
                            {!isSearchedNameEscrowed && normalized === ownedLabel ? (
                              <span className="nm-primary-pill">
                                <PrimarySeal size={12} />
                                Primary
                              </span>
                            ) : null}
                          </div>
                          <h3 className="names-result-name">
                            {normalized}
                            <span className="tld">.rise</span>
                          </h3>
                          {searchExpiry > 0n ? (
                            <p className="names-result-meta">
                              Expires {formatExpiry(searchExpiry)}
                            </p>
                          ) : null}
                        </div>
                        {isSearchedNameEscrowed ? (
                          <Link
                            to="/domains/marketplace"
                            className="btn-secondary names-action-btn"
                          >
                            View marketplace <ArrowRight className="w-4 h-4" />
                          </Link>
                        ) : normalized !== ownedLabel ? (
                          <button
                            type="button"
                            onClick={() => handleSetPrimary(normalized)}
                            className="btn-primary names-action-btn"
                          >
                            <Star className="w-4 h-4" />
                            Set primary
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <div className="names-result-card is-taken">
                        <div>
                          <div className="names-result-tags">
                            <span className="nm-tag nm-tag-taken">
                              Registered
                            </span>
                            {isReserved ? (
                              <span className="nm-tier">Reserved</span>
                            ) : null}
                          </div>
                          <h3 className="names-result-name muted-name">
                            {normalized}
                            <span className="tld">.rise</span>
                          </h3>
                          {takenBy ? (
                            <p className="names-result-meta">
                              Owned by{" "}
                              <a
                                href={`${explorerUrl}/address/${takenBy}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {formatAddress(takenBy)}
                              </a>
                              {searchExpiry > 0n
                                ? ` · Expires ${formatExpiry(searchExpiry)}`
                                : ""}
                            </p>
                          ) : null}
                        </div>
                        <Link
                          to="/domains/marketplace"
                          className="btn-secondary names-action-btn"
                        >
                          View marketplace <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    )
                  ) : (
                    <div className="names-validation-card">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{validation.error}</span>
                    </div>
                  )}
                </motion.section>
              ) : null}
            </AnimatePresence>

            {ownedDomainsWithLabels.length > 0 ? (
              <motion.section variants={itemVariants}>
                <div className="own-head">
                  <div>
                    <h2 className="font-display text-2xl text-ink">
                      Your names
                    </h2>
                  </div>
                  <span className="nm-tier">
                    {ownedDomainsWithLabels.length} names
                  </span>
                </div>
                <div className="own-grid">
                  {ownedDomainsWithLabels.map((domain) => (
                    <OwnedNameCard
                      key={domain.node}
                      domain={domain}
                      isPrimary={domain.label === ownedLabel}
                      onSetPrimary={handleSetPrimary}
                      onRenewed={() => {
                        void refetchOwned();
                        void refetchStatus();
                      }}
                    />
                  ))}
                </div>
              </motion.section>
            ) : null}
          </div>

          <aside className="names-side-column">
            {!isConnected ? (
              <motion.section
                variants={itemVariants}
                className="rns-card rns-card-pad names-empty-owned"
              >
                <div className="names-connect-icon names-connect-icon-compact">
                  <Wallet className="w-5 h-5" />
                </div>
                <h3 className="font-display text-xl text-ink">
                  Your names
                </h3>
                <p className="text-body-sm text-ink-muted mt-2">
                  Connect your wallet to register and manage .rise names.
                </p>
                <button
                  type="button"
                  onClick={handleConnectWallet}
                  className="btn-primary names-action-btn mt-4 w-full"
                >
                  Connect wallet
                </button>
              </motion.section>
            ) : ownedLabel ? (
              <motion.section
                variants={itemVariants}
                className="rns-card rns-card-pad nm-primary"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="nm-primary-pill">
                    <PrimarySeal size={13} />
                    Primary
                  </span>
                </div>

                <div className="nm-primary-name">{ownedDisplayName}</div>
                {ownedExpirySec > 0 ? (
                  <p
                    className={`names-primary-expiry ${isOwnedExpired ? "is-expired" : ""}`}
                  >
                    {isOwnedExpired
                      ? "Expired. Renew to keep this identity."
                      : `Expires ${formatExpiry(ownedExpirySec)}`}
                  </p>
                ) : null}

                <div className="names-primary-actions">
                  {isWithinRenewalWindow ? (
                    <button
                      type="button"
                      onClick={handleRenew}
                      disabled={isRenewing || isRenewQuoteLoading}
                      className="btn-primary names-action-btn disabled:opacity-60"
                    >
                      {isRenewing
                        ? <InlineLoading label="Renewing..." />
                        : `Renew ${formatEthValue(renewPrice)}${renewUsdTotal ? ` · ${renewUsdTotal}` : ""}`}
                    </button>
                  ) : null}
                  <Link
                    to="/domains/marketplace"
                    className="nm-release"
                  >
                    List
                  </Link>
                </div>
              </motion.section>
            ) : (
              <motion.section
                variants={itemVariants}
                className="rns-card rns-card-pad names-empty-owned"
              >
                <div className="nm-suggest-label">Your names</div>
                <h3 className="font-display text-xl text-ink mt-2">
                  No names yet
                </h3>
                <p className="text-body-sm text-ink-muted mt-2">
                  Use the search panel to register your first .rise identity.
                </p>
              </motion.section>
            )}

            <motion.section
              variants={itemVariants}
              className="rns-card rns-card-pad"
            >
              <div className="names-card-heading compact">
                <div>
                  <div className="nm-suggest-label">Marketplace</div>
                  <h3 className="font-display text-xl text-ink mt-1">
                    Short names
                  </h3>
                </div>
                <Link to="/domains/marketplace" className="nm-link">
                  Browse →
                </Link>
              </div>
              <p className="nm-primary-cap" style={{ marginTop: 6 }}>
                Top 4-character and shorter names from the marketplace.
              </p>
              <div className="hot-mini">
                {shortMarketItems.length > 0 ? (
                  shortMarketItems.map((item) => (
                    <Link
                      key={item.key}
                      to="/domains/marketplace"
                      className="hot-mini-row"
                    >
                      <div className="hot-mini-name">
                        {item.label}
                        <span className="tld">.rise</span>
                      </div>
                      <div className="hot-mini-right">
                        <div className="hot-mini-bid">{formatEthValue(item.priceWei)}</div>
                        <div className="hot-mini-usd">
                          ≈ {formatUsdValue(ethUsd ? Number(formatEther(item.priceWei)) * ethUsd : null) ?? "USD loading"}
                        </div>
                        <div className="hot-mini-time">{item.meta}</div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <Link to="/domains/marketplace" className="hot-mini-row">
                    <div className="hot-mini-name">No live short auctions</div>
                    <div className="hot-mini-right">
                      <div className="hot-mini-time">Browse market</div>
                    </div>
                  </Link>
                )}
              </div>
            </motion.section>
          </aside>
      </div>

      <motion.aside variants={itemVariants} className="names-developer-cta">
        <div className="names-developer-cta-copy">
          <span className="names-developer-cta-icon" aria-hidden="true">
            <img src="/rise-network.png" alt="" />
          </span>
          <div>
            <div className="names-developer-cta-label">Building on RISE?</div>
            <p>
              Bring <span className="font-mono text-accent">.rise</span> names
              into your wallet, app, or community product.
            </p>
          </div>
        </div>
        <a
          href="https://developers.stage0.xyz/"
          target="_blank"
          rel="noopener noreferrer"
          className="names-developer-cta-link"
        >
          View integration docs
          <ExternalLink className="h-4 w-4" />
        </a>
      </motion.aside>
    </motion.div>
  );
};

export default DomainsPage;
