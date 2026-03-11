export type NFTSaleStatus = 'live' | 'upcoming' | 'ended';
export type NFTSalePhase = 'whitelist' | 'public' | 'upcoming' | 'ended';

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
