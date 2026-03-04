// TODO: DEX features (markets) not needed for initial launch.
// PairContract and FactoryContract ABIs are not yet available in config.
// Re-enable this hook when DEX contracts are deployed.

export function useMarkets() {
  return { markets: [] as never[], isLoading: false };
}
