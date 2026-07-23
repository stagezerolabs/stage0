import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAccount, useBalance, useReadContract } from 'wagmi';
import { formatEther, formatUnits, isAddress, keccak256, parseEther, stringToBytes, type Address, type Hex } from 'viem';
import { toast } from 'sonner';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { InlineLoading, Spinner } from '@/components/ui/spinner';
import { ArrowUpRight, Copy, Coins, Users, Settings, ExternalLink } from '@/components/ui/icons';
import { RNSRegistrar } from '@/config';
import {
  activateRnsAdminReservedName,
  fetchRnsAdminReservedNames,
  fetchRnsPrimaryAuctions,
  fetchRnsPricing,
  type RnsPricingSummary,
  type RnsPrimaryAuctionSummary,
  type RnsReservedNameSummary,
  upsertRnsAdminReservedName,
} from '@/lib/api/rns';
import { useChainContracts } from '@/lib/hooks/useChainContracts';
import { useRnsCreatePrimaryAuction, useRnsSetLabelPolicy } from '@/lib/hooks/rns';
import { useLaunchpadPresales } from '@/lib/hooks/useLaunchpadPresales';
import { useSetFeeRecipient, useSetNFTFactoryProceedsFeeBps } from '@/lib/hooks/useAdminActions';
import { useTrackedWriteContract } from '@/lib/hooks/useTrackedWriteContract';
import { useFactoryOwner, useFeeRecipient, useProceedsFeeBps } from '@/lib/utils/admin';
import { useUserNFTs } from '@/lib/hooks/useUserNFTs';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

type ReservedNameDraft = {
  enabled: boolean;
  saleMode: 'auction' | 'buy_now';
  priceEth: string;
  auctionDurationValue: string;
  auctionDurationUnit: 'days' | 'weeks' | 'months' | 'years';
  displayOrder: string;
};

type PendingReservedPublish = {
  id: number;
  label: string;
  fqdn: string;
  saleMode: 'auction' | 'buy_now';
  reservePrice: bigint;
  auctionDurationSeconds: bigint;
  stage: 'policy' | 'auction';
};

const RNS_DAY_SECONDS = 24n * 60n * 60n;
const RNS_YEAR_SECONDS = 365n * 24n * 60n * 60n;
const RNS_MAX_AUCTION_DURATION_SECONDS = 10n * RNS_YEAR_SECONDS;
const RNS_LABEL_POLICY_AUCTION_ONLY = 2;
const RNS_LABEL_POLICY_FIXED_PREMIUM = 3;

function toAuctionDurationDraft(seconds: bigint): Pick<ReservedNameDraft, 'auctionDurationValue' | 'auctionDurationUnit'> {
  if (seconds >= RNS_YEAR_SECONDS && seconds % RNS_YEAR_SECONDS === 0n) {
    return { auctionDurationValue: String(seconds / RNS_YEAR_SECONDS), auctionDurationUnit: 'years' };
  }
  const monthSeconds = 30n * RNS_DAY_SECONDS;
  if (seconds >= monthSeconds && seconds % monthSeconds === 0n) {
    return { auctionDurationValue: String(seconds / monthSeconds), auctionDurationUnit: 'months' };
  }
  const weekSeconds = 7n * RNS_DAY_SECONDS;
  if (seconds >= weekSeconds && seconds % weekSeconds === 0n) {
    return { auctionDurationValue: String(seconds / weekSeconds), auctionDurationUnit: 'weeks' };
  }
  return { auctionDurationValue: String(seconds / RNS_DAY_SECONDS), auctionDurationUnit: 'days' };
}

function parseAuctionDuration(draft: ReservedNameDraft) {
  const value = Number.parseInt(draft.auctionDurationValue, 10);
  if (!Number.isInteger(value) || value < 1) return null;

  const multiplier = {
    days: RNS_DAY_SECONDS,
    weeks: 7n * RNS_DAY_SECONDS,
    months: 30n * RNS_DAY_SECONDS,
    years: RNS_YEAR_SECONDS,
  }[draft.auctionDurationUnit];
  const seconds = BigInt(value) * multiplier;
  return seconds <= RNS_MAX_AUCTION_DURATION_SECONDS ? seconds : null;
}

function formatUsdValue(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'USD loading';
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatEditableEth(value: bigint | null | undefined) {
  if (!value || value <= 0n) return '';
  const numeric = Number(formatEther(value));
  if (!Number.isFinite(numeric)) return '';
  if (numeric >= 1) return numeric.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return numeric.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

const AdminDashboard: React.FC = () => {
  const { address } = useAccount();
  const { chainId, nftFactory, nftFactoryLens, rnsRegistrar, explorerUrl } = useChainContracts();
  const { totalDeployments, isLoading: isLoadingNFTs } = useUserNFTs();
  const { factoryOwner, isLoading: isLoadingOwner } = useFactoryOwner('nft');
  const {
    feeRecipient,
    isLoading: isLoadingFeeRecipient,
    refetch: refetchFeeRecipient,
  } = useFeeRecipient('nft');
  const {
    proceedsFeeBps,
    isLoading: isLoadingProceedsFeeBps,
    refetch: refetchProceedsFeeBps,
  } = useProceedsFeeBps();
  const { presales, isLoading: isLoadingPresales } = useLaunchpadPresales('all');

  const [newFeeRecipient, setNewFeeRecipient] = useState('');
  const [newProceedsFeeBps, setNewProceedsFeeBps] = useState('');
  const [newRnsTreasury, setNewRnsTreasury] = useState('');
  const [rnsAdminAction, setRnsAdminAction] = useState<'withdraw' | 'setTreasury' | null>(null);
  const [rnsPricing, setRnsPricing] = useState<RnsPricingSummary | null>(null);
  const [reservedNames, setReservedNames] = useState<RnsReservedNameSummary[]>([]);
  const [primaryAuctions, setPrimaryAuctions] = useState<RnsPrimaryAuctionSummary[]>([]);
  const [reservedDrafts, setReservedDrafts] = useState<Record<number, ReservedNameDraft>>({});
  const [reservedSearch, setReservedSearch] = useState('');
  const [isLoadingReserved, setIsLoadingReserved] = useState(false);
  const [reservedError, setReservedError] = useState<string | null>(null);
  const [savingReservedIds, setSavingReservedIds] = useState<number[]>([]);
  const [publishingReservedId, setPublishingReservedId] = useState<number | null>(null);
  const [pendingReservedPublish, setPendingReservedPublish] = useState<PendingReservedPublish | null>(null);
  const [isReservedInventoryOpen, setIsReservedInventoryOpen] = useState(false);

  const {
    setLabelPolicy,
    hash: setRnsPolicyHash,
    isPending: isSetRnsPolicyPending,
    isConfirming: isSetRnsPolicyConfirming,
    isSuccess: isSetRnsPolicySuccess,
    error: setRnsPolicyError,
    reset: resetSetRnsPolicy,
  } = useRnsSetLabelPolicy();

  const {
    createPrimaryAuction,
    hash: launchPrimaryAuctionHash,
    isPending: isLaunchPrimaryAuctionPending,
    isConfirming: isLaunchPrimaryAuctionConfirming,
    isSuccess: isLaunchPrimaryAuctionSuccess,
    error: launchPrimaryAuctionError,
    reset: resetLaunchPrimaryAuction,
  } = useRnsCreatePrimaryAuction();
  const isSettingRnsPolicy = isSetRnsPolicyPending || isSetRnsPolicyConfirming;
  const isLaunchingPrimaryAuction = isLaunchPrimaryAuctionPending || isLaunchPrimaryAuctionConfirming;

  const {
    setFeeRecipient,
    isBusy: isUpdatingFeeRecipient,
    isSuccess: isFeeRecipientUpdateSuccess,
    isError: isFeeRecipientUpdateError,
    error: feeRecipientUpdateError,
    reset: resetFeeRecipientUpdate,
  } = useSetFeeRecipient('nft');
  const {
    setProceedsFeeBps,
    isBusy: isUpdatingProceedsFee,
    isSuccess: isProceedsFeeUpdateSuccess,
    isError: isProceedsFeeUpdateError,
    error: proceedsFeeUpdateError,
    reset: resetProceedsFeeUpdate,
  } = useSetNFTFactoryProceedsFeeBps();
  const {
    writeContract: writeRnsAdmin,
    isBusy: isUpdatingRnsAdmin,
    isSuccess: isRnsAdminSuccess,
    error: rnsAdminError,
    reset: resetRnsAdmin,
  } = useTrackedWriteContract();

  const {
    data: rnsTreasury,
    isLoading: isLoadingRnsTreasury,
    refetch: refetchRnsTreasury,
  } = useReadContract({
    address: rnsRegistrar,
    abi: RNSRegistrar,
    functionName: 'treasury',
    query: { enabled: Boolean(rnsRegistrar) },
  });

  const {
    data: rnsOwner,
    isLoading: isLoadingRnsOwner,
  } = useReadContract({
    address: rnsRegistrar,
    abi: RNSRegistrar,
    functionName: 'owner',
    query: { enabled: Boolean(rnsRegistrar) },
  });

  const {
    data: rnsRegistrarBalance,
    isLoading: isLoadingRnsBalance,
    refetch: refetchRnsBalance,
  } = useBalance({
    address: rnsRegistrar,
    chainId,
    query: {
      enabled: Boolean(rnsRegistrar),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const totalPresales = presales?.length ?? 0;
  const livePresales = presales?.filter((p) => p.status === 'live').length ?? 0;
  const upcomingPresales = presales?.filter((p) => p.status === 'upcoming').length ?? 0;
  const endedPresales = presales?.filter((p) =>
    ['ended', 'finalized', 'cancelled'].includes(p.status)
  ).length ?? 0;

  const totalRaised = useMemo(() => {
    if (!presales || presales.length === 0) return '0';
    let sum = 0n;
    for (const p of presales) {
      sum += p.totalRaised ?? 0n;
    }
    return Number(formatUnits(sum, 18)).toLocaleString(undefined, { maximumFractionDigits: 4 });
  }, [presales]);

  const isOnChainOwner = useMemo(() => {
    if (!address || !factoryOwner) return false;
    return address.toLowerCase() === factoryOwner.toLowerCase();
  }, [address, factoryOwner]);

  const isRnsOwner = useMemo(() => {
    if (!address || !rnsOwner) return false;
    return address.toLowerCase() === rnsOwner.toLowerCase();
  }, [address, rnsOwner]);

  useEffect(() => {
    if (isFeeRecipientUpdateSuccess) {
      toast.success('NFT factory fee recipient updated.');
      setNewFeeRecipient('');
      resetFeeRecipientUpdate();
      refetchFeeRecipient();
    }
  }, [isFeeRecipientUpdateSuccess, refetchFeeRecipient, resetFeeRecipientUpdate]);

  useEffect(() => {
    if (isFeeRecipientUpdateError) {
      toast.error(feeRecipientUpdateError?.message ?? 'Failed to update NFT fee recipient.');
      resetFeeRecipientUpdate();
    }
  }, [feeRecipientUpdateError, isFeeRecipientUpdateError, resetFeeRecipientUpdate]);

  useEffect(() => {
    if (isProceedsFeeUpdateSuccess) {
      toast.success('NFT factory proceeds fee updated.');
      setNewProceedsFeeBps('');
      resetProceedsFeeUpdate();
      refetchProceedsFeeBps();
    }
  }, [isProceedsFeeUpdateSuccess, refetchProceedsFeeBps, resetProceedsFeeUpdate]);

  useEffect(() => {
    if (isProceedsFeeUpdateError) {
      toast.error(proceedsFeeUpdateError?.message ?? 'Failed to update NFT proceeds fee.');
      resetProceedsFeeUpdate();
    }
  }, [isProceedsFeeUpdateError, proceedsFeeUpdateError, resetProceedsFeeUpdate]);

  useEffect(() => {
    if (!isSetRnsPolicySuccess) return;
    resetSetRnsPolicy();

    if (!pendingReservedPublish) {
      toast.success('RNS sale policy updated on-chain.');
      return;
    }

    if (pendingReservedPublish.stage !== 'policy') return;

    if (pendingReservedPublish.saleMode === 'auction') {
      const startTime = BigInt(Math.floor(Date.now() / 1000) + 120);
      setPendingReservedPublish((current) =>
        current ? { ...current, stage: 'auction' } : current,
      );
      createPrimaryAuction({
        name: pendingReservedPublish.label,
        duration: RNS_YEAR_SECONDS,
        reservePrice: pendingReservedPublish.reservePrice,
        minIncrementBps: 500,
        startTime,
        endTime: startTime + pendingReservedPublish.auctionDurationSeconds,
      });
      return;
    }

    if (!setRnsPolicyHash) {
      toast.error('The policy transaction hash is unavailable. Refresh and publish again.');
      setPublishingReservedId(null);
      setPendingReservedPublish(null);
      return;
    }

    void activateRnsAdminReservedName({
      chainId,
      id: pendingReservedPublish.id,
      txHash: setRnsPolicyHash as Hex,
    })
      .then((activated) => {
        if (activated) {
          setReservedNames((current) =>
            current.map((entry) => (entry.id === activated.id ? activated : entry)),
          );
        }
        toast.success(`${pendingReservedPublish.fqdn} is live as a fixed-price sale.`);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Could not publish this fixed-price sale.');
      })
      .finally(() => {
        setPublishingReservedId(null);
        setPendingReservedPublish(null);
      });
  }, [
    chainId,
    createPrimaryAuction,
    isSetRnsPolicySuccess,
    pendingReservedPublish,
    resetSetRnsPolicy,
    setRnsPolicyHash,
  ]);

  useEffect(() => {
    if (!setRnsPolicyError) return;
    toast.error(setRnsPolicyError.message.split('\n')[0] ?? 'RNS policy update failed.');
    setPublishingReservedId(null);
    setPendingReservedPublish(null);
    resetSetRnsPolicy();
  }, [setRnsPolicyError, resetSetRnsPolicy]);

  useEffect(() => {
    if (!isLaunchPrimaryAuctionSuccess) return;
    resetLaunchPrimaryAuction();

    if (!pendingReservedPublish || pendingReservedPublish.stage !== 'auction') {
      toast.success('Primary auction launched.');
      return;
    }

    if (!launchPrimaryAuctionHash) {
      toast.error('The auction transaction hash is unavailable. Refresh the marketplace to verify it.');
      setPublishingReservedId(null);
      setPendingReservedPublish(null);
      return;
    }

    void activateRnsAdminReservedName({
      chainId,
      id: pendingReservedPublish.id,
      txHash: launchPrimaryAuctionHash as Hex,
    })
      .then((activated) => {
        if (activated) {
          setReservedNames((current) =>
            current.map((entry) => (entry.id === activated.id ? activated : entry)),
          );
        }
        void fetchRnsPrimaryAuctions({ chainId, limit: 200 }).then(setPrimaryAuctions);
        toast.success(`${pendingReservedPublish.fqdn} auction is live.`);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Auction launched, but marketplace refresh failed.');
      })
      .finally(() => {
        setPublishingReservedId(null);
        setPendingReservedPublish(null);
      });
  }, [
    chainId,
    isLaunchPrimaryAuctionSuccess,
    launchPrimaryAuctionHash,
    pendingReservedPublish,
    resetLaunchPrimaryAuction,
  ]);

  useEffect(() => {
    if (!launchPrimaryAuctionError) return;
    toast.error(launchPrimaryAuctionError.message.split('\n')[0] ?? 'Primary auction launch failed.');
    setPublishingReservedId(null);
    setPendingReservedPublish(null);
    resetLaunchPrimaryAuction();
  }, [launchPrimaryAuctionError, resetLaunchPrimaryAuction]);

  useEffect(() => {
    if (isRnsAdminSuccess) {
      toast.success(
        rnsAdminAction === 'withdraw'
          ? 'RNS registrar balance withdrawn to treasury.'
          : 'RNS treasury updated.'
      );
      setNewRnsTreasury('');
      setRnsAdminAction(null);
      resetRnsAdmin();
      refetchRnsTreasury();
      refetchRnsBalance();
    }
  }, [
    isRnsAdminSuccess,
    refetchRnsBalance,
    refetchRnsTreasury,
    resetRnsAdmin,
    rnsAdminAction,
  ]);

  useEffect(() => {
    if (rnsAdminError) {
      toast.error(rnsAdminError.message ?? 'RNS admin transaction failed.');
      setRnsAdminAction(null);
      resetRnsAdmin();
    }
  }, [rnsAdminError, resetRnsAdmin]);

  useEffect(() => {
    let cancelled = false;
    fetchRnsPricing({ chainId })
      .then((next) => {
        if (!cancelled) setRnsPricing(next);
      })
      .catch(() => {
        if (!cancelled) setRnsPricing(null);
      });
    return () => {
      cancelled = true;
    };
  }, [chainId]);

  useEffect(() => {
    let cancelled = false;
    void fetchRnsPrimaryAuctions({ chainId, limit: 200 })
      .then((auctions) => {
        if (!cancelled) setPrimaryAuctions(auctions);
      })
      .catch(() => {
        if (!cancelled) setPrimaryAuctions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [chainId]);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingReserved(true);
    fetchRnsAdminReservedNames({ chainId })
      .then((next) => {
        if (cancelled) return;
        setReservedNames(next);
        setReservedDrafts(
          Object.fromEntries(
            next.map((name) => {
              const activePrice =
                name.saleMode === 'buy_now' ? name.fixedPriceWei : name.reservePriceWei;
              return [
                name.id,
                {
                  enabled: name.enabled,
                  saleMode: name.saleMode,
                  priceEth: formatEditableEth(activePrice),
                  ...toAuctionDurationDraft(name.auctionDurationSeconds),
                  displayOrder: String(name.displayOrder),
                },
              ];
            }),
          ) as Record<number, ReservedNameDraft>,
        );
        setReservedError(null);
      })
      .catch((error) => {
        if (!cancelled) {
          setReservedError(error instanceof Error ? error.message : 'Could not load reserved names.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingReserved(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chainId]);

  const enabledReservedCount = reservedNames.filter((name) => name.enabled).length;
  const filteredReservedNames = reservedNames.filter((name) => {
    if (!reservedSearch.trim()) return true;
    const needle = reservedSearch.trim().toLowerCase();
    return (
      name.label.toLowerCase().includes(needle) ||
      name.category.toLowerCase().includes(needle) ||
      name.fqdn.toLowerCase().includes(needle)
    );
  });

  const handleCopy = (value: string) => {
    if (!value) return;
    navigator.clipboard?.writeText(value);
    toast.success('Copied to clipboard.');
  };

  const handleReservedDraftChange = (
    id: number,
    field: keyof ReservedNameDraft,
    value: string | boolean,
  ) => {
    setReservedDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [field]: value,
      },
    }));
  };

  const handleSaveReservedName = async (name: RnsReservedNameSummary) => {
    if (!isRnsOwner) {
      toast.error('Connected wallet is not the RNS owner.');
      return;
    }

    const draft = reservedDrafts[name.id];
    if (!draft) return;

    let parsedPrice: bigint | null = null;
    if (draft.priceEth.trim()) {
      try {
        parsedPrice = parseEther(draft.priceEth.trim());
      } catch {
        toast.error(`Enter a valid ETH price for ${name.fqdn}.`);
        return;
      }
    }

    const displayOrder = Number.parseInt(draft.displayOrder, 10);
    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      toast.error(`Display order must be zero or greater for ${name.fqdn}.`);
      return;
    }
    const auctionDurationSeconds = parseAuctionDuration(draft);
    if (draft.saleMode === 'auction' && auctionDurationSeconds === null) {
      toast.error(`Set an auction duration between 1 day and 10 years for ${name.fqdn}.`);
      return;
    }

    setSavingReservedIds((current) => [...current, name.id]);
    try {
      const updated = await upsertRnsAdminReservedName({
        chainId,
        label: name.label,
        category: name.category,
        enabled: draft.enabled,
        saleMode: draft.saleMode,
        reservePriceWei: draft.saleMode === 'auction' ? parsedPrice : null,
        fixedPriceWei: draft.saleMode === 'buy_now' ? parsedPrice : null,
        auctionDurationSeconds: auctionDurationSeconds ?? name.auctionDurationSeconds,
        displayOrder,
      });

      setReservedNames((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setReservedDrafts((current) => ({
        ...current,
        [updated.id]: {
          enabled: updated.enabled,
          saleMode: updated.saleMode,
          priceEth: formatEditableEth(
            updated.saleMode === 'buy_now' ? updated.fixedPriceWei : updated.reservePriceWei,
          ),
          ...toAuctionDurationDraft(updated.auctionDurationSeconds),
          displayOrder: String(updated.displayOrder),
        },
      }));
      toast.success(`${updated.fqdn} updated.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update reserved name.');
    } finally {
      setSavingReservedIds((current) => current.filter((id) => id !== name.id));
    }
  };

  const getReservedDraft = (name: RnsReservedNameSummary) =>
    reservedDrafts[name.id] ?? {
      enabled: name.enabled,
      saleMode: name.saleMode,
      priceEth: formatEditableEth(name.saleMode === 'buy_now' ? name.fixedPriceWei : name.reservePriceWei),
      ...toAuctionDurationDraft(name.auctionDurationSeconds),
      displayOrder: String(name.displayOrder),
    };

  const handlePublishReservedName = async (name: RnsReservedNameSummary) => {
    if (!isRnsOwner) {
      toast.error('Connected wallet is not the RNS owner.');
      return;
    }

    const draft = getReservedDraft(name);
    if (!draft.enabled) {
      toast.error(`Enable ${name.fqdn} before publishing it.`);
      return;
    }
    const existingLiveAuction = primaryAuctions.find(
      (auction) =>
        auction.name.toLowerCase() === name.label.toLowerCase() &&
        ["active", "scheduled"].includes(auction.status),
    );
    if (draft.saleMode === 'auction' && existingLiveAuction) {
      toast.error(`${name.fqdn} already has a live or scheduled auction.`);
      return;
    }
    if (!draft.priceEth.trim()) {
      toast.error(`Set a price for ${name.fqdn}.`);
      return;
    }

    let price: bigint;
    try {
      price = parseEther(draft.priceEth.trim());
    } catch {
      toast.error(`Enter a valid ETH price for ${name.fqdn}.`);
      return;
    }
    if (price <= 0n) {
      toast.error(`Price must be greater than zero for ${name.fqdn}.`);
      return;
    }

    const displayOrder = Number.parseInt(draft.displayOrder, 10);
    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      toast.error(`Priority must be zero or greater for ${name.fqdn}.`);
      return;
    }
    const auctionDurationSeconds = parseAuctionDuration(draft);
    if (draft.saleMode === 'auction' && auctionDurationSeconds === null) {
      toast.error(`Set an auction duration between 1 day and 10 years for ${name.fqdn}.`);
      return;
    }

    setPublishingReservedId(name.id);
    try {
      const updated = await upsertRnsAdminReservedName({
        chainId,
        label: name.label,
        category: name.category,
        enabled: true,
        saleMode: draft.saleMode,
        reservePriceWei: draft.saleMode === 'auction' ? price : null,
        fixedPriceWei: draft.saleMode === 'buy_now' ? price : null,
        auctionDurationSeconds: auctionDurationSeconds ?? name.auctionDurationSeconds,
        displayOrder,
      });

      setReservedNames((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setPendingReservedPublish({
        id: updated.id,
        label: updated.label,
        fqdn: updated.fqdn,
        saleMode: updated.saleMode,
        reservePrice: price,
        auctionDurationSeconds: updated.auctionDurationSeconds,
        stage: 'policy',
      });
      setLabelPolicy({
        labelHash: keccak256(stringToBytes(updated.label)),
        policy:
          updated.saleMode === 'buy_now'
            ? RNS_LABEL_POLICY_FIXED_PREMIUM
            : RNS_LABEL_POLICY_AUCTION_ONLY,
      });
    } catch (error) {
      setPublishingReservedId(null);
      setPendingReservedPublish(null);
      toast.error(error instanceof Error ? error.message : 'Could not prepare this marketplace sale.');
    }
  };

  const handleSetFeeRecipient = () => {
    if (!newFeeRecipient || !isAddress(newFeeRecipient)) {
      toast.error('Enter a valid fee recipient address.');
      return;
    }
    setFeeRecipient(newFeeRecipient as Address);
  };

  const handleSetProceedsFeeBps = () => {
    const parsed = Number.parseInt(newProceedsFeeBps, 10);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10_000) {
      toast.error('Proceeds fee must be between 0 and 10000 bps.');
      return;
    }
    setProceedsFeeBps(parsed);
  };

  const handleWithdrawRnsBalance = () => {
    if (!isRnsOwner) {
      toast.error('Connected wallet is not the RNS registrar owner.');
      return;
    }

    const balance = rnsRegistrarBalance?.value ?? 0n;
    if (balance <= 0n) {
      toast.error('No RNS registrar ETH balance to withdraw.');
      return;
    }

    setRnsAdminAction('withdraw');
    writeRnsAdmin({
      address: rnsRegistrar,
      abi: RNSRegistrar,
      functionName: 'withdraw',
    });
  };

  const handleSetRnsTreasury = () => {
    if (!isRnsOwner) {
      toast.error('Connected wallet is not the RNS registrar owner.');
      return;
    }

    if (!newRnsTreasury || !isAddress(newRnsTreasury)) {
      toast.error('Enter a valid RNS treasury address.');
      return;
    }

    setRnsAdminAction('setTreasury');
    writeRnsAdmin({
      address: rnsRegistrar,
      abi: RNSRegistrar,
      functionName: 'setTreasury',
      args: [newRnsTreasury as Address],
    });
  };

  const adminStatusLabel = isOnChainOwner ? 'NFT factory owner' : 'Admin access';
  const rnsStatusLabel = isRnsOwner ? 'RNS owner' : 'Admin access';
  const currentProceedsFeeLabel =
    proceedsFeeBps !== undefined
      ? `${(Number(proceedsFeeBps) / 100).toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })}%`
      : 'Unknown';
  const rnsWithdrawableBalance = rnsRegistrarBalance?.value ?? 0n;
  const rnsWithdrawableLabel = `${Number(formatEther(rnsWithdrawableBalance)).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  })} ETH`;
  const rnsWithdrawableUsd = rnsPricing?.ethUsd
    ? Number(formatEther(rnsWithdrawableBalance)) * rnsPricing.ethUsd
    : null;
  const rnsBusyLabel =
    rnsAdminAction === 'withdraw'
      ? 'Withdrawing...'
      : rnsAdminAction === 'setTreasury'
        ? 'Updating Treasury...'
        : 'Processing...';

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-10"
    >
      <motion.section variants={itemVariants} className="page-hero-card">
        <div className="eyebrow">Admin</div>
        <h1 className="ds-h1 mt-2">Stage0 Admin</h1>
        <p className="text-body text-ink-muted max-w-3xl mt-3">
          Manage launches, whitelisted creators, and NFT launchpad fee defaults from one place.
        </p>
      </motion.section>

      <motion.section variants={itemVariants} className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="stat-card">
          <p className="text-body-sm text-ink-muted">Total Launches</p>
          <p className="font-display text-display-sm text-ink">
            {isLoadingPresales ? <Spinner size="xs" variant="dots" /> : totalPresales}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-body-sm text-ink-muted">Live</p>
          <p className="font-display text-display-sm text-ink">
            {isLoadingPresales ? <Spinner size="xs" variant="dots" /> : livePresales}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-body-sm text-ink-muted">Upcoming</p>
          <p className="font-display text-display-sm text-ink">
            {isLoadingPresales ? <Spinner size="xs" variant="dots" /> : upcomingPresales}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-body-sm text-ink-muted">Ended</p>
          <p className="font-display text-display-sm text-ink">
            {isLoadingPresales ? <Spinner size="xs" variant="dots" /> : endedPresales}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-body-sm text-ink-muted">Total Raised</p>
          <p className="font-display text-display-sm text-ink">
            {isLoadingPresales ? <Spinner size="xs" variant="dots" /> : totalRaised}
          </p>
        </div>
      </motion.section>

      <motion.section variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Link to="/admin/presales" className="tool-surface-card p-6 group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-accent-muted text-accent flex items-center justify-center">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <p className="text-body font-medium text-ink">Manage Launches</p>
                <p className="text-body-sm text-ink-muted">Edit fees and status</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-ink-muted group-hover:text-ink" />
          </div>
        </Link>

        <Link to="/admin/whitelist" className="tool-surface-card p-6 group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-ink/10 text-ink flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-body font-medium text-ink">Whitelist Creators</p>
                <p className="text-body-sm text-ink-muted">Add or remove access</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-ink-muted group-hover:text-ink" />
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setIsReservedInventoryOpen(true)}
          className="glass-card rounded-3xl p-6 text-left transition hover:-translate-y-0.5 hover:border-border-strong"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-ink/10 text-ink flex items-center justify-center">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <p className="text-body font-medium text-ink">Domain Marketplace</p>
                <p className="text-body-sm text-ink-muted">
                  {enabledReservedCount} enabled of {reservedNames.length} curated names
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-ink-muted" />
          </div>
          <p className="mt-4 text-body-sm text-ink-muted">
            Curate reserved names, preview order, and opening prices.
          </p>
        </button>
      </motion.section>

      <motion.section variants={itemVariants} className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div className="space-y-1">
            <p className="text-label text-ink-faint uppercase tracking-wider">NFT Launchpad</p>
            <h2 className="font-display text-display-md text-ink">NFT Factory</h2>
            <p className="text-body text-ink-muted max-w-2xl">
              Deploy standard ERC721 or ERC721A collections with configurable mint windows, wallet limits, and default withdraw fees.
            </p>
          </div>
          <a
            href={`${explorerUrl}/address/${nftFactory}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost inline-flex items-center gap-2 self-start md:self-auto"
          >
            View Factory <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        <div className="glass-card rounded-3xl p-6 space-y-4">
          <div>
            <p className="font-display text-display-sm text-ink">Factory Activity</p>
            <p className="text-body-sm text-ink-muted">Total deployments on this factory</p>
          </div>
          <p className="font-display text-display-md text-ink font-mono">
            {isLoadingNFTs ? <Spinner size="xs" variant="dots" /> : Number(totalDeployments).toLocaleString()}
          </p>
          <Link to="/create/nft" className="btn-primary inline-flex">Create NFT Collection</Link>
        </div>
      </motion.section>

      <motion.section variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-3xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-label text-ink-faint uppercase tracking-wider">RNS Treasury</p>
              <h2 className="font-display text-display-sm text-ink">Registrar Funds</h2>
            </div>
            <span className="text-xs text-ink-faint">{rnsStatusLabel}</span>
          </div>

          <div className="rounded-2xl border border-border bg-canvas/50 p-4">
            <p className="text-body-sm text-ink-muted">Withdrawable Balance</p>
            <p className="font-display text-display-md text-ink">
              {isLoadingRnsBalance ? <Spinner size="sm" variant="dots" /> : rnsWithdrawableLabel}
            </p>
            <p className="mt-1 text-body font-semibold text-ink">
              ≈ {formatUsdValue(rnsWithdrawableUsd)}
            </p>
            <p className="text-xs text-ink-faint mt-2">
              Mint and renewal ETH remains in the registrar until withdrawn to treasury.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-body-sm text-ink-muted">RNS Registrar</p>
            <div className="flex items-center gap-2">
              <code className="text-body-sm font-mono text-ink break-all">{rnsRegistrar}</code>
              <button
                onClick={() => handleCopy(rnsRegistrar)}
                className="p-1.5 rounded-lg hover:bg-ink/5 transition-colors"
                aria-label="Copy RNS registrar address"
              >
                <Copy className="w-4 h-4 text-ink-muted" />
              </button>
            </div>
            <a
              href={`${explorerUrl}/address/${rnsRegistrar}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-body-sm text-accent link-underline inline-flex items-center gap-1"
            >
              View on explorer
            </a>
          </div>

          <div className="space-y-2">
            <p className="text-body-sm text-ink-muted">Registrar Owner</p>
            <p className="text-body-sm font-mono text-ink break-all">
              {isLoadingRnsOwner ? <InlineLoading label="Loading..." size="xs" variant="dots" /> : rnsOwner ?? 'Unknown'}
            </p>
            {isRnsOwner && (
              <p className="text-xs text-status-live mt-1">✓ Connected wallet is owner</p>
            )}
          </div>

          <button
            onClick={handleWithdrawRnsBalance}
            disabled={!isRnsOwner || isUpdatingRnsAdmin || rnsWithdrawableBalance <= 0n}
            className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isUpdatingRnsAdmin && rnsAdminAction === 'withdraw'
              ? <InlineLoading label={rnsBusyLabel} />
              : 'Withdraw to Treasury'}
          </button>
        </div>

        <div className="glass-card rounded-3xl p-6 space-y-5">
          <div className="space-y-1">
            <p className="text-label text-ink-faint uppercase tracking-wider">RNS Settings</p>
            <h2 className="font-display text-display-sm text-ink">Treasury Address</h2>
            <p className="text-body-sm text-ink-muted">
              This address receives registrar ETH when the owner calls withdraw.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-body-sm text-ink-muted">Current Treasury</p>
            <div className="flex items-center gap-2">
              <code className="text-body-sm font-mono text-ink break-all">
                {isLoadingRnsTreasury ? <InlineLoading label="Loading..." size="xs" variant="dots" /> : rnsTreasury ?? 'Unknown'}
              </code>
              {rnsTreasury && (
                <button
                  onClick={() => handleCopy(rnsTreasury)}
                  className="p-1.5 rounded-lg hover:bg-ink/5 transition-colors"
                  aria-label="Copy current RNS treasury address"
                >
                  <Copy className="w-4 h-4 text-ink-muted" />
                </button>
              )}
            </div>
            {rnsTreasury && (
              <a
                href={`${explorerUrl}/address/${rnsTreasury}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body-sm text-accent link-underline inline-flex items-center gap-1"
              >
                View on explorer
              </a>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-body-sm text-ink-muted">Update Treasury</label>
            <input
              value={newRnsTreasury}
              onChange={(event) => setNewRnsTreasury(event.target.value)}
              placeholder="0x..."
              className="input-field font-mono"
            />
            <button
              onClick={handleSetRnsTreasury}
              disabled={!isRnsOwner || !newRnsTreasury || isUpdatingRnsAdmin}
              className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isUpdatingRnsAdmin && rnsAdminAction === 'setTreasury'
                ? <InlineLoading label={rnsBusyLabel} />
                : 'Update Treasury'}
            </button>
            <p className="text-xs text-ink-faint">
              Only the RNS registrar owner can update the treasury or withdraw registrar funds.
            </p>
          </div>
        </div>
      </motion.section>

      <ResponsiveDialog
        open={isReservedInventoryOpen}
        onOpenChange={setIsReservedInventoryOpen}
        title="Reserved Inventory"
        description="Set marketplace visibility, sale terms, and display priority for curated names."
        className="reserved-inventory-dialog max-w-[1180px]"
      >
        <div className="reserved-inventory-panel">
          <div className="reserved-inventory-toolbar">
            <input
              value={reservedSearch}
              onChange={(event) => setReservedSearch(event.target.value)}
              placeholder="Search names or categories"
              className="input-field reserved-inventory-search"
            />
            <p className="reserved-inventory-hint">
              Priority 1 appears first. Publishing opens wallet confirmations.
            </p>
          </div>

          {reservedError ? (
            <div className="rounded-2xl border border-status-error/30 bg-status-error/5 px-4 py-3 text-body-sm text-status-error">
              {reservedError}
            </div>
          ) : null}

          <div className="reserved-inventory-table">
            <div className="reserved-inventory-head">
              <span>Name</span>
              <span>Category</span>
              <span>Visible</span>
              <span>Sale type</span>
              <span>Duration</span>
              <span>Price</span>
              <span>Priority</span>
              <span>Actions</span>
            </div>

            {isLoadingReserved ? (
              <div className="reserved-inventory-empty">
                <InlineLoading label="Loading reserved names..." variant="dots" />
              </div>
            ) : filteredReservedNames.length === 0 ? (
              <div className="reserved-inventory-empty">No reserved names match this search.</div>
            ) : (
              filteredReservedNames.map((name) => {
                const draft = reservedDrafts[name.id];
                const activePriceWei =
                  draft?.saleMode === 'buy_now' ? name.fixedPriceWei : name.reservePriceWei;
                const activePriceUsd =
                  draft?.priceEth && rnsPricing?.ethUsd
                    ? Number(draft.priceEth) * rnsPricing.ethUsd
                    : activePriceWei && rnsPricing?.ethUsd
                      ? Number(formatEther(activePriceWei)) * rnsPricing.ethUsd
                      : null;
                const isSaving = savingReservedIds.includes(name.id);
                const hasLiveAuction = primaryAuctions.some(
                  (auction) =>
                    auction.name.toLowerCase() === name.label.toLowerCase() &&
                    ['active', 'scheduled'].includes(auction.status),
                );
                const isPublishing = publishingReservedId === name.id;

                return (
                  <div
                    key={name.id}
                    className="reserved-inventory-row"
                  >
                    <div className="reserved-inventory-cell reserved-inventory-name" data-label="Name">
                      <p>{name.fqdn}</p>
                      <span>≈ {formatUsdValue(activePriceUsd)}</span>
                    </div>
                    <div className="reserved-inventory-cell reserved-inventory-category" data-label="Category">
                      {name.category.replace(/_/g, ' ')}
                    </div>
                    <label className="reserved-inventory-cell reserved-inventory-toggle" data-label="Visible">
                      <input
                        type="checkbox"
                        checked={draft?.enabled ?? name.enabled}
                        onChange={(event) =>
                          handleReservedDraftChange(name.id, 'enabled', event.target.checked)
                        }
                        className="h-4 w-4 rounded border-border"
                      />
                      <span>{draft?.enabled ?? name.enabled ? 'Visible' : 'Hidden'}</span>
                    </label>
                    <div className="reserved-inventory-cell" data-label="Sale type">
                      <select
                        value={draft?.saleMode ?? name.saleMode}
                        onChange={(event) =>
                          handleReservedDraftChange(name.id, 'saleMode', event.target.value as ReservedNameDraft['saleMode'])
                        }
                        className="input-field reserved-inventory-input"
                      >
                        <option value="auction">Auction</option>
                        <option value="buy_now">Fixed price</option>
                      </select>
                    </div>
                    <div className="reserved-inventory-cell" data-label="Duration">
                      {(draft?.saleMode ?? name.saleMode) === 'auction' ? (
                        <div className="reserved-inventory-duration">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={draft?.auctionDurationValue ?? toAuctionDurationDraft(name.auctionDurationSeconds).auctionDurationValue}
                          onChange={(event) =>
                            handleReservedDraftChange(name.id, 'auctionDurationValue', event.target.value)
                          }
                          aria-label={`Auction duration for ${name.fqdn}`}
                          className="input-field reserved-inventory-input font-mono"
                        />
                        <select
                          value={draft?.auctionDurationUnit ?? toAuctionDurationDraft(name.auctionDurationSeconds).auctionDurationUnit}
                          onChange={(event) =>
                            handleReservedDraftChange(
                              name.id,
                              'auctionDurationUnit',
                              event.target.value as ReservedNameDraft['auctionDurationUnit'],
                            )
                          }
                          aria-label={`Auction duration unit for ${name.fqdn}`}
                          className="input-field reserved-inventory-input"
                        >
                          <option value="days">Days</option>
                          <option value="weeks">Weeks</option>
                          <option value="months">Months</option>
                          <option value="years">Years</option>
                        </select>
                      </div>
                      ) : (
                        <span className="reserved-inventory-until-sold">Until sold</span>
                      )}
                    </div>
                    <div className="reserved-inventory-cell reserved-inventory-price" data-label="Price (ETH)">
                      <input
                        value={draft?.priceEth ?? ''}
                        onChange={(event) =>
                          handleReservedDraftChange(name.id, 'priceEth', event.target.value)
                        }
                        placeholder="0.05"
                        className="input-field reserved-inventory-input font-mono"
                      />
                      <span>ETH</span>
                    </div>
                    <div className="reserved-inventory-cell" data-label="Priority">
                      <input
                        value={draft?.displayOrder ?? String(name.displayOrder)}
                        onChange={(event) =>
                          handleReservedDraftChange(name.id, 'displayOrder', event.target.value)
                        }
                        placeholder="0"
                        className="input-field reserved-inventory-input font-mono"
                      />
                    </div>
                    <div className="reserved-inventory-cell reserved-inventory-actions" data-label="Actions">
                      <div className="reserved-inventory-status">
                        <span className={name.activatedAt ? 'is-published' : 'is-unpublished'}>
                          {name.activatedAt ? 'Published' : 'Unpublished'}
                        </span>
                        {name.primaryAuctionId !== null ? (
                          <small>Auction #{name.primaryAuctionId.toString()}</small>
                        ) : null}
                      </div>
                      <div className="reserved-inventory-buttons">
                        <button
                          type="button"
                          onClick={() => void handleSaveReservedName(name)}
                          disabled={!isRnsOwner || isSaving}
                          className="reserved-inventory-save disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {isSaving ? <InlineLoading label="Saving..." /> : 'Save changes'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handlePublishReservedName(name)}
                          disabled={
                            !isRnsOwner ||
                            publishingReservedId !== null ||
                            isSettingRnsPolicy ||
                            isLaunchingPrimaryAuction ||
                            ((draft?.saleMode ?? name.saleMode) === 'auction' && hasLiveAuction)
                          }
                          className="reserved-inventory-publish disabled:opacity-60 disabled:cursor-not-allowed"
                          title={hasLiveAuction ? 'This name already has a live or scheduled auction.' : undefined}
                        >
                          {isPublishing ? (
                            <InlineLoading
                              label={pendingReservedPublish?.stage === 'auction' ? 'Launching...' : 'Publishing...'}
                            />
                          ) : hasLiveAuction ? (
                            'Auction live'
                          ) : name.activatedAt ? (
                            'Publish again'
                          ) : (
                            'Publish'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </ResponsiveDialog>

      <motion.section variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-display-sm text-ink">Factory Details</h2>
            <span className="text-xs text-ink-faint">{adminStatusLabel}</span>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-body-sm text-ink-muted">NFT Factory</p>
              <div className="flex items-center gap-2">
                <code className="text-body-sm font-mono text-ink break-all">{nftFactory}</code>
                <button
                  onClick={() => handleCopy(nftFactory)}
                  className="p-1.5 rounded-lg hover:bg-ink/5 transition-colors"
                  aria-label="Copy NFT factory address"
                >
                  <Copy className="w-4 h-4 text-ink-muted" />
                </button>
              </div>
              <a
                href={`${explorerUrl}/address/${nftFactory}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body-sm text-accent link-underline inline-flex items-center gap-1 mt-1"
              >
                View on explorer
              </a>
            </div>

            <div>
              <p className="text-body-sm text-ink-muted">NFT Factory Lens</p>
              <div className="flex items-center gap-2">
                <code className="text-body-sm font-mono text-ink break-all">{nftFactoryLens}</code>
                <button
                  onClick={() => handleCopy(nftFactoryLens)}
                  className="p-1.5 rounded-lg hover:bg-ink/5 transition-colors"
                  aria-label="Copy NFT factory lens address"
                >
                  <Copy className="w-4 h-4 text-ink-muted" />
                </button>
              </div>
              <a
                href={`${explorerUrl}/address/${nftFactoryLens}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body-sm text-accent link-underline inline-flex items-center gap-1 mt-1"
              >
                View on explorer
              </a>
            </div>

            <div>
              <p className="text-body-sm text-ink-muted">On-chain Owner</p>
              <p className="text-body-sm font-mono text-ink break-all">
                {isLoadingOwner ? <InlineLoading label="Loading..." size="xs" variant="dots" /> : factoryOwner ?? 'Unknown'}
              </p>
              {isOnChainOwner && (
                <p className="text-xs text-status-live mt-1">✓ Connected wallet is owner</p>
              )}
            </div>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="font-display text-display-sm text-ink">Factory Fee Defaults</h2>
            <p className="text-body-sm text-ink-muted">
              These defaults are applied to NFT collections deployed from this factory.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-body-sm text-ink-muted">Current Fee Recipient</p>
              <p className="text-body-sm font-mono text-ink break-all">
                {isLoadingFeeRecipient ? <InlineLoading label="Loading..." size="xs" variant="dots" /> : feeRecipient ?? 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-body-sm text-ink-muted">Current Proceeds Fee</p>
              <p className="text-body text-ink">
                {isLoadingProceedsFeeBps ? <InlineLoading label="Loading..." size="xs" variant="dots" /> : `${currentProceedsFeeLabel} (${proceedsFeeBps?.toString() ?? '0'} bps)`}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-body-sm text-ink-muted">Update Fee Recipient</label>
            <input
              value={newFeeRecipient}
              onChange={(event) => setNewFeeRecipient(event.target.value)}
              placeholder="0x..."
              className="input-field font-mono"
            />
            <button
              onClick={handleSetFeeRecipient}
              disabled={!newFeeRecipient || isUpdatingFeeRecipient}
              className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isUpdatingFeeRecipient ? <InlineLoading label="Updating recipient..." /> : 'Update Recipient'}
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-body-sm text-ink-muted">Update Proceeds Fee (bps)</label>
            <input
              type="number"
              min="0"
              max="10000"
              value={newProceedsFeeBps}
              onChange={(event) => setNewProceedsFeeBps(event.target.value)}
              placeholder={proceedsFeeBps?.toString() ?? '200'}
              className="input-field"
            />
            <button
              onClick={handleSetProceedsFeeBps}
              disabled={!newProceedsFeeBps || isUpdatingProceedsFee}
              className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isUpdatingProceedsFee ? <InlineLoading label="Updating fee..." /> : 'Update Proceeds Fee'}
            </button>
            <p className="text-xs text-ink-faint">
              Basis points: 100 = 1%. Only the NFT factory owner can update these settings.
            </p>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
};

export default AdminDashboard;
