import { useEffect, useMemo, useState } from 'react';
import { type Address } from 'viem';
import { useReadContracts } from 'wagmi';
import { NFTCollectionContract } from '@/config';
import {
  fetchTokenDisplayMetadata,
  type TokenDisplayMetadata,
  type TokenMetadataAttribute,
} from '@/lib/utils/nft-metadata';
import { useUserNFTHoldings } from '@/lib/hooks/useUserNFTHoldings';

const MAX_TOKEN_SCAN_PER_COLLECTION = 1000;

export type OwnedNFTAttribute = TokenMetadataAttribute;
type TokenMetadata = TokenDisplayMetadata | null;

type OwnerReadResult = {
  status?: string;
  result?: unknown;
};

type OwnedTokenTarget = {
  collectionAddress: Address;
  collectionName: string;
  collectionSymbol: string;
  collectionOwner: Address;
  tokenId: bigint;
  collectionBaseURI?: string;
  collectionStatus: 'live' | 'upcoming' | 'ended';
  is721A: boolean;
};

type UseUserOwnedNFTTokensOptions = {
  collectionAddress?: Address;
  metadataLimit?: number;
};

function readResult<T>(entry: unknown): T | undefined {
  if (!entry || typeof entry !== 'object') return undefined;
  const result = entry as OwnerReadResult;
  if (result.status && result.status !== 'success') return undefined;
  return result.result as T | undefined;
}

function compareTokenTargets(a: OwnedTokenTarget, b: OwnedTokenTarget): number {
  const collectionA = a.collectionAddress.toLowerCase();
  const collectionB = b.collectionAddress.toLowerCase();

  if (collectionA !== collectionB) return collectionA < collectionB ? -1 : 1;
  return Number(b.tokenId - a.tokenId);
}

export type OwnedNFTToken = {
  collectionAddress: Address;
  collectionName: string;
  collectionSymbol: string;
  collectionOwner: Address;
  tokenId: bigint;
  tokenURI?: string;
  image?: string;
  metadataName?: string;
  metadataDescription?: string;
  attributes?: OwnedNFTAttribute[];
  collectionStatus: 'live' | 'upcoming' | 'ended';
  is721A: boolean;
};

export function useUserOwnedNFTTokens(
  userAddress?: Address,
  enabled = true,
  options: UseUserOwnedNFTTokensOptions = {}
) {
  const canRead = Boolean(enabled && userAddress);
  const metadataLimit =
    typeof options.metadataLimit === 'number' && Number.isFinite(options.metadataLimit)
      ? Math.max(0, Math.floor(options.metadataLimit))
      : undefined;

  const { holdings, isLoading: isHoldingsLoading } = useUserNFTHoldings(userAddress, canRead);

  const holdingsWithBalance = useMemo(
    () => holdings.filter((holding) => {
      if (holding.ownedCount <= 0n) return false;
      if (!options.collectionAddress) return true;
      return holding.address.toLowerCase() === options.collectionAddress.toLowerCase();
    }),
    [holdings, options.collectionAddress]
  );

  const totalOwned = useMemo(
    () => holdingsWithBalance.reduce((sum, holding) => sum + holding.ownedCount, 0n),
    [holdingsWithBalance]
  );

  const baseUriQueries = useMemo(
    () =>
      holdingsWithBalance.map((holding) => ({
        abi: NFTCollectionContract,
        address: holding.address,
        functionName: 'baseURI',
      })),
    [holdingsWithBalance]
  );

  const { data: baseUriResults, isLoading: isBaseUriLoading } = useReadContracts({
    contracts: baseUriQueries as readonly any[],
    query: {
      enabled: canRead && baseUriQueries.length > 0,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  });

  const baseUriByCollection = useMemo(() => {
    const entries = new Map<string, string>();
    holdingsWithBalance.forEach((holding, index) => {
      const baseURI = readResult<string>(baseUriResults?.[index]);
      if (baseURI) entries.set(holding.address.toLowerCase(), baseURI);
    });
    return entries;
  }, [baseUriResults, holdingsWithBalance]);

  const ownerScanTargets = useMemo(() => {
    const targets: OwnedTokenTarget[] = [];

    for (const holding of holdingsWithBalance) {
      const mintedCount = Number(holding.totalMinted);
      const scanLimit = Math.min(mintedCount, MAX_TOKEN_SCAN_PER_COLLECTION);
      for (let tokenId = 1; tokenId <= scanLimit; tokenId += 1) {
        targets.push({
          collectionAddress: holding.address,
          collectionName: holding.name,
          collectionSymbol: holding.symbol,
          collectionOwner: holding.owner,
          tokenId: BigInt(tokenId),
          collectionBaseURI: baseUriByCollection.get(holding.address.toLowerCase()),
          collectionStatus: holding.status,
          is721A: holding.is721A,
        });
      }
    }

    return targets;
  }, [baseUriByCollection, holdingsWithBalance]);

  const ownerQueries = useMemo(
    () =>
      ownerScanTargets.map((target) => ({
        abi: NFTCollectionContract,
        address: target.collectionAddress,
        functionName: 'ownerOf',
        args: [target.tokenId],
      })),
    [ownerScanTargets]
  );

  const { data: ownerResults, isLoading: isOwnerLoading } = useReadContracts({
    contracts: ownerQueries as readonly any[],
    query: {
      enabled: canRead && ownerQueries.length > 0,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const ownedTargets = useMemo(() => {
    if (!userAddress || ownerScanTargets.length === 0) return [];
    const lower = userAddress.toLowerCase();

    return ownerScanTargets.filter((_, idx) => {
      const owner = readResult<Address>(ownerResults?.[idx]);
      return Boolean(owner && owner.toLowerCase() === lower);
    });
  }, [userAddress, ownerScanTargets, ownerResults]);

  const sortedOwnedTargets = useMemo(
    () => [...ownedTargets].sort(compareTokenTargets),
    [ownedTargets]
  );

  const metadataTargets = useMemo(
    () => sortedOwnedTargets.slice(0, metadataLimit ?? sortedOwnedTargets.length),
    [metadataLimit, sortedOwnedTargets]
  );

  const tokenUriQueries = useMemo(
    () =>
      metadataTargets.map((target) => ({
        abi: NFTCollectionContract,
        address: target.collectionAddress,
        functionName: 'tokenURI',
        args: [target.tokenId],
      })),
    [metadataTargets]
  );

  const { data: tokenUriResults, isLoading: isTokenUriLoading } = useReadContracts({
    contracts: tokenUriQueries as readonly any[],
    query: {
      enabled: canRead && tokenUriQueries.length > 0,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const tokenRows = useMemo(() => {
    return sortedOwnedTargets.map((target, idx) => {
      const tokenURI = idx < metadataTargets.length ? readResult<string>(tokenUriResults?.[idx]) : undefined;
      return { ...target, tokenURI };
    });
  }, [metadataTargets.length, sortedOwnedTargets, tokenUriResults]);

  const [metadataByToken, setMetadataByToken] = useState<Record<string, TokenMetadata>>({});

  useEffect(() => {
    if (baseUriQueries.length > 0 && isBaseUriLoading) return;

    const pending = tokenRows.filter(
      (row) =>
        (row.tokenURI || row.collectionBaseURI) &&
        metadataByToken[`${row.collectionAddress.toLowerCase()}:${row.tokenId.toString()}`] === undefined
    );

    if (pending.length === 0) return;

    let cancelled = false;

    (async () => {
      const entries = await Promise.all(
        pending.map(async (row) => {
          const key = `${row.collectionAddress.toLowerCase()}:${row.tokenId.toString()}`;
          const metadata = await fetchTokenDisplayMetadata(row.tokenURI || '', {
            baseUri: row.collectionBaseURI,
            tokenId: row.tokenId,
          });
          return [key, metadata] as const;
        })
      );

      if (cancelled) return;

      setMetadataByToken((prev) => {
        const next = { ...prev };
        for (const [key, value] of entries) {
          next[key] = value;
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [baseUriQueries.length, isBaseUriLoading, tokenRows, metadataByToken]);

  const tokens = useMemo((): OwnedNFTToken[] => {
    return tokenRows.map((row) => {
      const key = `${row.collectionAddress.toLowerCase()}:${row.tokenId.toString()}`;
      const metadata = metadataByToken[key];
      return {
        collectionAddress: row.collectionAddress,
        collectionName: row.collectionName,
        collectionSymbol: row.collectionSymbol,
        collectionOwner: row.collectionOwner,
        tokenId: row.tokenId,
        tokenURI: row.tokenURI,
        image: metadata?.image,
        metadataName: metadata?.name,
        metadataDescription: metadata?.description,
        attributes: metadata?.attributes,
        collectionStatus: row.collectionStatus,
        is721A: row.is721A,
      };
    });
  }, [tokenRows, metadataByToken]);

  const truncatedCollections = useMemo(
    () =>
      holdingsWithBalance.filter((holding) => Number(holding.totalMinted) > MAX_TOKEN_SCAN_PER_COLLECTION),
    [holdingsWithBalance]
  );

  return {
    tokens,
    holdings: holdingsWithBalance,
    totalOwned,
    isLoading:
      isHoldingsLoading ||
      (baseUriQueries.length > 0 && isBaseUriLoading) ||
      (ownerQueries.length > 0 && isOwnerLoading) ||
      (tokenUriQueries.length > 0 && isTokenUriLoading),
    isTruncatedScan: truncatedCollections.length > 0,
    truncatedCollections,
    scanLimitPerCollection: MAX_TOKEN_SCAN_PER_COLLECTION,
  };
}
