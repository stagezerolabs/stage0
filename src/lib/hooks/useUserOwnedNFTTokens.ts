import { useEffect, useMemo, useState } from 'react';
import { type Address } from 'viem';
import { useReadContracts } from 'wagmi';
import { NFTCollectionContract } from '@/config';
import { ipfsUriToHttp } from '@/lib/utils/ipfs';
import { useUserNFTHoldings } from '@/lib/hooks/useUserNFTHoldings';

const MAX_TOKEN_SCAN_PER_COLLECTION = 1000;

type TokenMetadata = {
  image?: string;
  name?: string;
  description?: string;
} | null;

type OwnerReadResult = {
  status?: string;
  result?: unknown;
};

function readResult<T>(entry: unknown): T | undefined {
  if (!entry || typeof entry !== 'object') return undefined;
  const result = entry as OwnerReadResult;
  if (result.status && result.status !== 'success') return undefined;
  return result.result as T | undefined;
}

function resolveMetadataImageUri(imageUri: string, metadataUri: string): string {
  const normalized = imageUri.trim();
  if (!normalized) return '';

  if (
    normalized.startsWith('ipfs://') ||
    normalized.startsWith('http://') ||
    normalized.startsWith('https://')
  ) {
    return ipfsUriToHttp(normalized);
  }

  try {
    const base = ipfsUriToHttp(metadataUri);
    return new URL(normalized, base).toString();
  } catch {
    return ipfsUriToHttp(normalized);
  }
}

function looksLikeImageUrl(value: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(value);
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
  collectionStatus: 'live' | 'upcoming' | 'ended';
  is721A: boolean;
};

export function useUserOwnedNFTTokens(userAddress?: Address, enabled = true) {
  const canRead = Boolean(enabled && userAddress);

  const { holdings, totalOwned, isLoading: isHoldingsLoading } = useUserNFTHoldings(userAddress, canRead);

  const holdingsWithBalance = useMemo(
    () => holdings.filter((holding) => holding.ownedCount > 0n),
    [holdings]
  );

  const ownerScanTargets = useMemo(() => {
    const targets: Array<{
      collectionAddress: Address;
      collectionName: string;
      collectionSymbol: string;
      collectionOwner: Address;
      tokenId: bigint;
      collectionStatus: 'live' | 'upcoming' | 'ended';
      is721A: boolean;
    }> = [];

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
          collectionStatus: holding.status,
          is721A: holding.is721A,
        });
      }
    }

    return targets;
  }, [holdingsWithBalance]);

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

  const tokenUriQueries = useMemo(
    () =>
      ownedTargets.map((target) => ({
        abi: NFTCollectionContract,
        address: target.collectionAddress,
        functionName: 'tokenURI',
        args: [target.tokenId],
      })),
    [ownedTargets]
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
    return ownedTargets.map((target, idx) => {
      const tokenURI = readResult<string>(tokenUriResults?.[idx]);
      return { ...target, tokenURI };
    });
  }, [ownedTargets, tokenUriResults]);

  const [metadataByToken, setMetadataByToken] = useState<Record<string, TokenMetadata>>({});

  useEffect(() => {
    const pending = tokenRows.filter(
      (row) =>
        row.tokenURI &&
        metadataByToken[`${row.collectionAddress.toLowerCase()}:${row.tokenId.toString()}`] === undefined
    );

    if (pending.length === 0) return;

    let cancelled = false;

    (async () => {
      const entries = await Promise.all(
        pending.map(async (row) => {
          const key = `${row.collectionAddress.toLowerCase()}:${row.tokenId.toString()}`;
          try {
            const tokenUriHttp = ipfsUriToHttp(row.tokenURI || '');
            if (!tokenUriHttp) return [key, null] as const;

            const response = await fetch(tokenUriHttp);
            if (!response.ok) throw new Error(`Metadata fetch failed: ${response.status}`);

            const metadata = (await response.json()) as Record<string, unknown>;
            const name =
              typeof metadata.name === 'string' && metadata.name.trim().length > 0
                ? metadata.name.trim()
                : undefined;
            const description =
              typeof metadata.description === 'string' && metadata.description.trim().length > 0
                ? metadata.description.trim()
                : undefined;
            const image =
              typeof metadata.image === 'string' && metadata.image.trim().length > 0
                ? resolveMetadataImageUri(metadata.image, tokenUriHttp)
                : undefined;

            return [key, { image, name, description } as TokenMetadata] as const;
          } catch {
            const directImage =
              row.tokenURI && looksLikeImageUrl(row.tokenURI) ? ipfsUriToHttp(row.tokenURI) : undefined;
            return [key, directImage ? ({ image: directImage } as TokenMetadata) : null] as const;
          }
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
  }, [tokenRows, metadataByToken]);

  const tokens = useMemo((): OwnedNFTToken[] => {
    return tokenRows
      .map((row) => {
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
          collectionStatus: row.collectionStatus,
          is721A: row.is721A,
        };
      })
      .sort((a, b) => {
        if (a.collectionAddress.toLowerCase() !== b.collectionAddress.toLowerCase()) {
          return a.collectionAddress.toLowerCase() < b.collectionAddress.toLowerCase() ? -1 : 1;
        }
        return Number(b.tokenId - a.tokenId);
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
      (ownerQueries.length > 0 && isOwnerLoading) ||
      (tokenUriQueries.length > 0 && isTokenUriLoading),
    isTruncatedScan: truncatedCollections.length > 0,
    truncatedCollections,
    scanLimitPerCollection: MAX_TOKEN_SCAN_PER_COLLECTION,
  };
}
