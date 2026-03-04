// TODO: DEX features (swap) not needed for initial launch.
// RouterContract and Weth9Contract ABIs are not yet available in config.
// Re-enable this hook when DEX contracts are deployed.

export function useSwap(_params: {
  fromToken: { address: `0x${string}`; decimals: number; symbol: string } | undefined;
  toToken: { address: `0x${string}`; decimals: number; symbol: string } | undefined;
  fromAmount: string;
}) {
  return {
    toAmount: "",
    swap: async () => {},
    approve: async () => {},
    needsApproval: false,
    isLoading: false,
    isSuccess: false,
    hash: undefined,
  };
}
