export type NFTSaleStatus = 'live' | 'upcoming' | 'ended';
export type NFTSalePhase = 'whitelist' | 'public' | 'upcoming' | 'ended';
export type NFTCountdownPhase =
  | 'whitelist-upcoming'
  | 'whitelist-live'
  | 'public-upcoming'
  | 'public-live'
  | 'ended'
  | 'public-open';

export type NFTSaleCountdown = {
  phase: NFTCountdownPhase;
  label: string;
  targetTime?: bigint;
  fallbackLabel?: string;
  completedLabel?: string;
  stoppedMessage?: string;
};

type NFTSaleConfig = {
  maxSupply: bigint;
  totalMinted: bigint;
  saleStart: bigint;
  saleEnd: bigint;
  whitelistEnabled: boolean;
  whitelistStart: bigint;
};

type NFTMintPricingConfig = NFTSaleConfig & {
  mintPrice: bigint;
  whitelistPrice: bigint;
};

export function getNFTSalePhase(config: NFTSaleConfig, now = BigInt(Math.floor(Date.now() / 1000))): NFTSalePhase {
  if (config.maxSupply > 0n && config.totalMinted >= config.maxSupply) return 'ended';
  if (config.saleEnd > 0n && now >= config.saleEnd) return 'ended';

  if (
    config.whitelistEnabled &&
    config.whitelistStart > 0n &&
    now >= config.whitelistStart &&
    now < config.saleStart
  ) {
    return 'whitelist';
  }

  if (now < config.saleStart) return 'upcoming';
  return 'public';
}

export function getNFTSaleStatus(config: NFTSaleConfig, now = BigInt(Math.floor(Date.now() / 1000))): NFTSaleStatus {
  const phase = getNFTSalePhase(config, now);
  if (phase === 'ended') return 'ended';
  if (phase === 'upcoming') return 'upcoming';
  return 'live';
}

export function getNFTActiveMintPrice(
  config: NFTMintPricingConfig,
  now = BigInt(Math.floor(Date.now() / 1000))
): bigint {
  return getNFTSalePhase(config, now) === 'whitelist' ? config.whitelistPrice : config.mintPrice;
}

export function isWhitelistLocked(
  whitelistEnabled: boolean,
  whitelistStart: bigint,
  now = BigInt(Math.floor(Date.now() / 1000))
): boolean {
  return whitelistEnabled && whitelistStart > 0n && now >= whitelistStart;
}

type CountdownResolverConfig = Pick<NFTSaleConfig, 'saleStart' | 'saleEnd' | 'whitelistEnabled' | 'whitelistStart'> & {
  status: NFTSaleStatus;
  nowSec: number;
};

export function resolveNFTSaleCountdown(config: CountdownResolverConfig): NFTSaleCountdown {
  if (config.status === 'ended') {
    return {
      phase: 'ended',
      label: 'Sale status',
      stoppedMessage: 'Sale Ended',
      completedLabel: 'Sale Ended',
    };
  }

  const now = config.nowSec;
  const whitelistStartSec = Number(config.whitelistStart);
  const saleStartSec = Number(config.saleStart);
  const hasSaleEnd = config.saleEnd > 0n;
  const saleEndSec = Number(config.saleEnd);

  if (config.whitelistEnabled && config.whitelistStart > 0n && now < whitelistStartSec) {
    return {
      phase: 'whitelist-upcoming',
      label: 'Whitelist starts in',
      targetTime: config.whitelistStart,
      fallbackLabel: 'Start date TBD',
      completedLabel: 'Whitelist live',
    };
  }

  if (config.whitelistEnabled && now < saleStartSec) {
    return {
      phase: 'whitelist-live',
      label: 'Whitelist ends in',
      targetTime: config.saleStart,
      fallbackLabel: 'Start date TBD',
      completedLabel: 'Public live',
    };
  }

  if (now < saleStartSec) {
    return {
      phase: 'public-upcoming',
      label: 'Public starts in',
      targetTime: config.saleStart,
      fallbackLabel: 'Start date TBD',
      completedLabel: 'Public live',
    };
  }

  if (hasSaleEnd && now < saleEndSec) {
    return {
      phase: 'public-live',
      label: 'Public sale ends in',
      targetTime: config.saleEnd,
      fallbackLabel: 'End date TBD',
      completedLabel: 'Sale Ended',
    };
  }

  if (hasSaleEnd && now >= saleEndSec) {
    return {
      phase: 'ended',
      label: 'Sale status',
      stoppedMessage: 'Sale Ended',
      completedLabel: 'Sale Ended',
    };
  }

  return {
    phase: 'public-open',
    label: 'Public sale',
    fallbackLabel: 'No end date',
    stoppedMessage: 'Public sale live',
  };
}
