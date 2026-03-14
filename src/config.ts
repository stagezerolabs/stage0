import { type Address, http, defineChain } from "viem";
import BearsImg from "./assets/Bears.jpg";
import { createConfig } from "wagmi";
import { RiseWallet, Storage } from "rise-wallet";
import { riseWallet } from "rise-wallet/wagmi";
import {
  connectorsForWallets,
} from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
  coinbaseWallet,
} from "@rainbow-me/rainbowkit/wallets";

// ---------------------------------------------------------------------------
// Chain definitions
// ---------------------------------------------------------------------------

export const riseTestnet = defineChain({
  id: 11155931,
  name: "RISE Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet.riselabs.xyz"] },
  },
  blockExplorers: {
    default: { name: "RISE Explorer", url: "https://explorer.testnet.riselabs.xyz" },
  },
  testnet: true,
});

export const SUPPORTED_CHAINS = [riseTestnet] as const;

// ---------------------------------------------------------------------------
// Wagmi / RainbowKit config
// ---------------------------------------------------------------------------

const PROJECT_ID = "05f1bc7c3d4ce4d40fe55e540e58c2da";

const rainbowConnectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, rainbowWallet, walletConnectWallet, coinbaseWallet],
    },
  ],
  {
    appName: "Stage0",
    projectId: PROJECT_ID,
  }
);

export const RISE_CONNECTOR_ID = "com.risechain.wallet";
const riseWalletConfig = {
  ...RiseWallet.defaultConfig,
  // Use app-specific persistence to avoid stale cross-dapp session state.
  storage: Storage.localStorage(),
  storageKey: "stage0.risewallet.store",
} as const;

export const rwConnector = riseWallet(riseWalletConfig);

const connectors = [rwConnector, ...rainbowConnectors];

export const config = createConfig({
  connectors,
  chains: SUPPORTED_CHAINS,
  transports: {
    [riseTestnet.id]: http("https://testnet.riselabs.xyz"),
  },
});

// ---------------------------------------------------------------------------
// Address configuration
// ---------------------------------------------------------------------------

const ZERO: Address = "0x0000000000000000000000000000000000000000";
const ENV_OWNER_ADDRESS = import.meta.env.VITE_OWNER_ADDRESS?.trim();

// Keep owner configurable so production networks can be swapped in by env.
export const OWNER: Address =
  ENV_OWNER_ADDRESS && ENV_OWNER_ADDRESS.length === 42
    ? (ENV_OWNER_ADDRESS as Address)
    : ZERO;

// ---------------------------------------------------------------------------
// Contract address map
// ---------------------------------------------------------------------------

export type ContractAddressMap = {
  tokenLocker: Address;
  nftFactory: Address;
  nftFactoryLens: Address;
  presaleFactory: Address;
  tokenFactory: Address;
  airdropMultisender: Address;
};

export const CONTRACT_ADDRESSES: Record<number, ContractAddressMap> = {
  [riseTestnet.id]: {
    tokenLocker: "0xb225cb8Ea90E0ab1F9f5011d31fD217083c31fc7",
    nftFactory: "0xCEA1A715927408216B838DcAcd90Dff025Ab0b2D",
    nftFactoryLens: "0x5F52461ac88ea4a9095A2eD82743Df17E1a1c1af",
    presaleFactory: "0x67064a9236050D3d947d7F5Bd3448BD4b5D947FC",
    tokenFactory: "0xa0b761A94013FF721fD682eEB7e57709C0e03f42",
    airdropMultisender: "0x8DB306030Cf163A6C809fB3599500DBE28Df2CC6",
  },
};

// ---------------------------------------------------------------------------
// Staking contract addresses
// ---------------------------------------------------------------------------

export const STAKING_CONTRACT_ADDRESSES: Record<number, Address> = {
  [riseTestnet.id]: ZERO,
};

// ---------------------------------------------------------------------------
// Explorer URLs
// ---------------------------------------------------------------------------

export const EXPLORER_URLS: Record<number, string> = {
  [riseTestnet.id]: "https://explorer.testnet.riselabs.xyz",
};

// ---------------------------------------------------------------------------
// Chain labels
// ---------------------------------------------------------------------------

export const CHAIN_LABELS: Record<number, string> = {
  [riseTestnet.id]: "RISE Testnet",
};

// ---------------------------------------------------------------------------
// Native token labels
// ---------------------------------------------------------------------------

export const NATIVE_TOKEN_LABELS: Record<number, string> = {
  [riseTestnet.id]: "ETH",
};

// ---------------------------------------------------------------------------
// Helper functions (default to RISE Testnet)
// ---------------------------------------------------------------------------

export function getContractAddresses(chainId?: number): ContractAddressMap {
  return CONTRACT_ADDRESSES[chainId ?? riseTestnet.id] ?? CONTRACT_ADDRESSES[riseTestnet.id];
}

export function getStakingContractAddress(chainId?: number): Address {
  return STAKING_CONTRACT_ADDRESSES[chainId ?? riseTestnet.id] ?? STAKING_CONTRACT_ADDRESSES[riseTestnet.id];
}

export function getExplorerUrl(chainId?: number): string {
  return EXPLORER_URLS[chainId ?? riseTestnet.id] ?? EXPLORER_URLS[riseTestnet.id];
}

export function getNativeTokenLabel(chainId?: number): string {
  return NATIVE_TOKEN_LABELS[chainId ?? riseTestnet.id] ?? NATIVE_TOKEN_LABELS[riseTestnet.id];
}

// ===========================================================================
//  CONTRACT ABIs
// ===========================================================================

// ---------------------------------------------------------------------------
// StakingContract ABI
// ---------------------------------------------------------------------------

export const StakingContract = [
  {
    inputs: [{ internalType: "address", name: "_tokenAddress", type: "address" }],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "user", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "Stake",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "user", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "UnStake",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "user", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "claimedRewards",
    type: "event",
  },
  {
    inputs: [],
    name: "EmergencyRecover",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "finalise",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getReward",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_amount", type: "uint256" }],
    name: "notify",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_amount", type: "uint256" }],
    name: "stake",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "startStaking",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_finishAt", type: "uint256" }],
    name: "updateFinishAt",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_rewardRate", type: "uint256" }],
    name: "updateRewardRate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_amount", type: "uint256" }],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_account", type: "address" }],
    name: "calculateReward",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "duration",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "finishAt",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_account", type: "address" }],
    name: "pendingRewards",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "rewardPerToken",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "rewardRate",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "rewards",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "rewardsToken",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "stakers",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "stakingStatus",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "stakingToken",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalTokensStakeCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_account", type: "address" }],
    name: "totalUserEarned",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ---------------------------------------------------------------------------
// PresaleFactory ABI
// ---------------------------------------------------------------------------

export const PresaleFactory = [
  { type: "constructor", inputs: [], stateMutability: "nonpayable" },
  {
    type: "function",
    name: "allPresales",
    inputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "createPresale",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct PresaleFactory.CreateParams",
        components: [
          { name: "saleToken", type: "address", internalType: "address" },
          { name: "paymentToken", type: "address", internalType: "address" },
          {
            name: "config",
            type: "tuple",
            internalType: "struct PresaleConfig",
            components: [
              { name: "startTime", type: "uint64", internalType: "uint64" },
              { name: "endTime", type: "uint64", internalType: "uint64" },
              { name: "rate", type: "uint256", internalType: "uint256" },
              { name: "softCap", type: "uint256", internalType: "uint256" },
              { name: "hardCap", type: "uint256", internalType: "uint256" },
              { name: "minContribution", type: "uint256", internalType: "uint256" },
              { name: "maxContribution", type: "uint256", internalType: "uint256" },
            ],
          },
          { name: "owner", type: "address", internalType: "address" },
          { name: "requiresWhitelist", type: "bool", internalType: "bool" },
        ],
      },
    ],
    outputs: [{ name: "presale", type: "address", internalType: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "factoryOwner",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "feeRecipient",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "presalesCreatedBy",
    inputs: [{ name: "creator", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "address[]", internalType: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setFeeRecipient",
    inputs: [{ name: "newRecipient", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setWhitelistedCreator",
    inputs: [
      { name: "creator", type: "address", internalType: "address" },
      { name: "whitelisted", type: "bool", internalType: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "totalPresales",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "whitelistedCreators",
    inputs: [{ name: "", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "CreatorWhitelisted",
    inputs: [
      { name: "creator", type: "address", indexed: true, internalType: "address" },
      { name: "whitelisted", type: "bool", indexed: false, internalType: "bool" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "FeeRecipientUpdated",
    inputs: [{ name: "newRecipient", type: "address", indexed: true, internalType: "address" }],
    anonymous: false,
  },
  {
    type: "event",
    name: "PresaleCreated",
    inputs: [
      { name: "creator", type: "address", indexed: true, internalType: "address" },
      { name: "presale", type: "address", indexed: true, internalType: "address" },
      { name: "saleToken", type: "address", indexed: true, internalType: "address" },
      { name: "paymentToken", type: "address", indexed: false, internalType: "address" },
      { name: "requiresWhitelist", type: "bool", indexed: false, internalType: "bool" },
    ],
    anonymous: false,
  },
] as const;

// ---------------------------------------------------------------------------
// PresaleContract (LaunchpadPresaleContract) ABI
// ---------------------------------------------------------------------------

export const PresaleContract = [
  {
    type: "function",
    name: "saleToken",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract IERC20" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "paymentToken",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract IERC20" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isPaymentETH",
    inputs: [],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "startTime",
    inputs: [],
    outputs: [{ name: "", type: "uint64", internalType: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "endTime",
    inputs: [],
    outputs: [{ name: "", type: "uint64", internalType: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "rate",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "softCap",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hardCap",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "minContribution",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "maxContribution",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalRaised",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "committedTokens",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalTokensDeposited",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "successfulFinalization",
    inputs: [],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "claimEnabled",
    inputs: [],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "refundsEnabled",
    inputs: [],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenFeeBps",
    inputs: [],
    outputs: [{ name: "", type: "uint96", internalType: "uint96" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "proceedsFeeBps",
    inputs: [],
    outputs: [{ name: "", type: "uint96", internalType: "uint96" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "contributions",
    inputs: [{ name: "", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "purchasedTokens",
    inputs: [{ name: "", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "contribute",
    inputs: [{ name: "amount", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "claimTokens",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimRefund",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "depositSaleTokens",
    inputs: [{ name: "amount", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "finalize",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "endAfterSoftcapReached",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "enableClaims",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelPresale",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdrawProceeds",
    inputs: [{ name: "amount", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdrawUnusedTokens",
    inputs: [{ name: "amount", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "addToWhitelist",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "addManyToWhitelist",
    inputs: [{ name: "accounts", type: "address[]", internalType: "address[]" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "removeFromWhitelist",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateConfig",
    inputs: [
      {
        name: "config",
        type: "tuple",
        internalType: "struct PresaleConfig",
        components: [
          { name: "startTime", type: "uint64", internalType: "uint64" },
          { name: "endTime", type: "uint64", internalType: "uint64" },
          { name: "rate", type: "uint256", internalType: "uint256" },
          { name: "softCap", type: "uint256", internalType: "uint256" },
          { name: "hardCap", type: "uint256", internalType: "uint256" },
          { name: "minContribution", type: "uint256", internalType: "uint256" },
          { name: "maxContribution", type: "uint256", internalType: "uint256" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateFees",
    inputs: [
      { name: "newTokenFeeBps", type: "uint96", internalType: "uint96" },
      { name: "newProceedsFeeBps", type: "uint96", internalType: "uint96" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

// ---------------------------------------------------------------------------
// TokenFactory ABI
// ---------------------------------------------------------------------------

export const TokenFactory = [
  {
    type: "function",
    name: "createBurnableToken",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct TokenFactory.TokenParams",
        components: [
          { name: "name", type: "string", internalType: "string" },
          { name: "symbol", type: "string", internalType: "string" },
          { name: "decimals", type: "uint8", internalType: "uint8" },
          { name: "initialSupply", type: "uint256", internalType: "uint256" },
          { name: "initialRecipient", type: "address", internalType: "address" },
        ],
      },
    ],
    outputs: [{ name: "token", type: "address", internalType: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createMintableToken",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct TokenFactory.TokenParams",
        components: [
          { name: "name", type: "string", internalType: "string" },
          { name: "symbol", type: "string", internalType: "string" },
          { name: "decimals", type: "uint8", internalType: "uint8" },
          { name: "initialSupply", type: "uint256", internalType: "uint256" },
          { name: "initialRecipient", type: "address", internalType: "address" },
        ],
      },
    ],
    outputs: [{ name: "token", type: "address", internalType: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createNonMintableToken",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct TokenFactory.TokenParams",
        components: [
          { name: "name", type: "string", internalType: "string" },
          { name: "symbol", type: "string", internalType: "string" },
          { name: "decimals", type: "uint8", internalType: "uint8" },
          { name: "initialSupply", type: "uint256", internalType: "uint256" },
          { name: "initialRecipient", type: "address", internalType: "address" },
        ],
      },
    ],
    outputs: [{ name: "token", type: "address", internalType: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createPlainToken",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct TokenFactory.TokenParams",
        components: [
          { name: "name", type: "string", internalType: "string" },
          { name: "symbol", type: "string", internalType: "string" },
          { name: "decimals", type: "uint8", internalType: "uint8" },
          { name: "initialSupply", type: "uint256", internalType: "uint256" },
          { name: "initialRecipient", type: "address", internalType: "address" },
        ],
      },
    ],
    outputs: [{ name: "token", type: "address", internalType: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createTaxableToken",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct TokenFactory.TokenParams",
        components: [
          { name: "name", type: "string", internalType: "string" },
          { name: "symbol", type: "string", internalType: "string" },
          { name: "decimals", type: "uint8", internalType: "uint8" },
          { name: "initialSupply", type: "uint256", internalType: "uint256" },
          { name: "initialRecipient", type: "address", internalType: "address" },
        ],
      },
      {
        name: "tax",
        type: "tuple",
        internalType: "struct TokenFactory.TaxParams",
        components: [
          { name: "taxWallet", type: "address", internalType: "address" },
          { name: "taxBps", type: "uint96", internalType: "uint96" },
        ],
      },
    ],
    outputs: [{ name: "token", type: "address", internalType: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "deployments",
    inputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    outputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "tokenType", type: "uint8", internalType: "enum TokenFactory.TokenType" },
      { name: "creator", type: "address", internalType: "address" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokensCreatedBy",
    inputs: [{ name: "creator", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "address[]", internalType: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalDeployments",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "TokenCreated",
    inputs: [
      { name: "creator", type: "address", indexed: true, internalType: "address" },
      { name: "token", type: "address", indexed: true, internalType: "address" },
      { name: "tokenType", type: "uint8", indexed: true, internalType: "enum TokenFactory.TokenType" },
    ],
    anonymous: false,
  },
] as const;

// ---------------------------------------------------------------------------
// TokenLocker ABI
// ---------------------------------------------------------------------------

export const TokenLocker = [
  {
    type: "function",
    name: "extendLock",
    inputs: [
      { name: "lockId", type: "uint256", internalType: "uint256" },
      { name: "additionalTime", type: "uint64", internalType: "uint64" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getLock",
    inputs: [{ name: "lockId", type: "uint256", internalType: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct TokenLocker.LockInfo",
        components: [
          { name: "token", type: "address", internalType: "address" },
          { name: "owner", type: "address", internalType: "address" },
          { name: "amount", type: "uint256", internalType: "uint256" },
          { name: "lockDate", type: "uint64", internalType: "uint64" },
          { name: "unlockDate", type: "uint64", internalType: "uint64" },
          { name: "withdrawn", type: "bool", internalType: "bool" },
          { name: "name", type: "string", internalType: "string" },
          { name: "description", type: "string", internalType: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lockTokens",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "lockDuration", type: "uint64", internalType: "uint64" },
      { name: "name", type: "string", internalType: "string" },
      { name: "description", type: "string", internalType: "string" },
    ],
    outputs: [{ name: "lockId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "locksOfOwner",
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256[]", internalType: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalLocks",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transferLockOwnership",
    inputs: [
      { name: "lockId", type: "uint256", internalType: "uint256" },
      { name: "newOwner", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "unlock",
    inputs: [{ name: "lockId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "LockCreated",
    inputs: [
      { name: "lockId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "token", type: "address", indexed: true, internalType: "address" },
      { name: "owner", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "unlockDate", type: "uint64", indexed: false, internalType: "uint64" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "LockExtended",
    inputs: [
      { name: "lockId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "newUnlockDate", type: "uint64", indexed: false, internalType: "uint64" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "LockReleased",
    inputs: [
      { name: "lockId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "LockTransferred",
    inputs: [
      { name: "lockId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "newOwner", type: "address", indexed: true, internalType: "address" },
    ],
    anonymous: false,
  },
] as const;

// ---------------------------------------------------------------------------
// AirdropMultiSender ABI
// ---------------------------------------------------------------------------

export const AirdropMultiSender = [
  {
    inputs: [
      { internalType: "address", name: "token", type: "address" },
      { internalType: "address[]", name: "recipients", type: "address[]" },
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
    ],
    name: "sendERC20",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address[]", name: "recipients", type: "address[]" },
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
    ],
    name: "sendETH",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "token", type: "address" },
      { indexed: false, internalType: "uint256", name: "totalAmount", type: "uint256" },
    ],
    name: "TokensSent",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "uint256", name: "totalAmount", type: "uint256" },
    ],
    name: "EthSent",
    type: "event",
  },
] as const;

// ---------------------------------------------------------------------------
// NFTFactory ABI
// ---------------------------------------------------------------------------

export const NFTFactory = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      {
        internalType: "struct NFTFactory.NFTParams",
        name: "params",
        type: "tuple",
        components: [
          { internalType: "string", name: "name", type: "string" },
          { internalType: "string", name: "symbol", type: "string" },
          { internalType: "string", name: "baseURI", type: "string" },
          { internalType: "string", name: "contractURI", type: "string" },
          {
            internalType: "struct NFTFactory.WhitelistParams",
            name: "whitelistConfig",
            type: "tuple",
            components: [
              { internalType: "bool", name: "enabled", type: "bool" },
              { internalType: "uint64", name: "whitelistStart", type: "uint64" },
              { internalType: "uint128", name: "whitelistPrice", type: "uint128" },
            ],
          },
          { internalType: "uint256", name: "maxSupply", type: "uint256" },
          { internalType: "address", name: "payoutWallet", type: "address" },
          {
            internalType: "struct MintConfig",
            name: "mintConfig",
            type: "tuple",
            components: [
              { internalType: "uint64", name: "saleStart", type: "uint64" },
              { internalType: "uint64", name: "saleEnd", type: "uint64" },
              { internalType: "uint32", name: "walletLimit", type: "uint32" },
              { internalType: "uint128", name: "price", type: "uint128" },
            ],
          },
        ],
      },
    ],
    name: "createETHNFT",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "struct NFTFactory.NFTParams",
        name: "params",
        type: "tuple",
        components: [
          { internalType: "string", name: "name", type: "string" },
          { internalType: "string", name: "symbol", type: "string" },
          { internalType: "string", name: "baseURI", type: "string" },
          { internalType: "string", name: "contractURI", type: "string" },
          {
            internalType: "struct NFTFactory.WhitelistParams",
            name: "whitelistConfig",
            type: "tuple",
            components: [
              { internalType: "bool", name: "enabled", type: "bool" },
              { internalType: "uint64", name: "whitelistStart", type: "uint64" },
              { internalType: "uint128", name: "whitelistPrice", type: "uint128" },
            ],
          },
          { internalType: "uint256", name: "maxSupply", type: "uint256" },
          { internalType: "address", name: "payoutWallet", type: "address" },
          {
            internalType: "struct MintConfig",
            name: "mintConfig",
            type: "tuple",
            components: [
              { internalType: "uint64", name: "saleStart", type: "uint64" },
              { internalType: "uint64", name: "saleEnd", type: "uint64" },
              { internalType: "uint32", name: "walletLimit", type: "uint32" },
              { internalType: "uint128", name: "price", type: "uint128" },
            ],
          },
        ],
      },
    ],
    name: "create721AETHnFT",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "creator", type: "address" }],
    name: "tokensCreatedBy",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalDeployments",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "deployments",
    outputs: [
      { internalType: "address", name: "nft", type: "address" },
      { internalType: "bool", name: "is721A", type: "bool" },
      { internalType: "address", name: "creator", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "factoryOwner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "ethNFTDeployer",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nft721ADeployer",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "deploymentIndex",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "feeRecipient",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "proceedsFeeBps",
    outputs: [{ internalType: "uint96", name: "", type: "uint96" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "FEE_BPS_DENOMINATOR",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "newRecipient", type: "address" }],
    name: "setFeeRecipient",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint96", name: "newProceedsFeeBps", type: "uint96" }],
    name: "setProceedsFeeBps",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "creator", type: "address" },
      { indexed: true, internalType: "address", name: "nft", type: "address" },
      { indexed: true, internalType: "bool", name: "is721A", type: "bool" },
    ],
    name: "NFTCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, internalType: "address", name: "newRecipient", type: "address" }],
    name: "FeeRecipientUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: "uint96", name: "newProceedsFeeBps", type: "uint96" }],
    name: "ProceedsFeeUpdated",
    type: "event",
  },
] as const;

// ---------------------------------------------------------------------------
// NFT Collection ABI (LaunchpadNFTEth / LaunchpadNFT721AEth)
// ---------------------------------------------------------------------------

export const NFTCollectionContract = [
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "maxSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalMinted",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "mintPrice",
    outputs: [{ internalType: "uint128", name: "", type: "uint128" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "walletLimit",
    outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "saleStart",
    outputs: [{ internalType: "uint64", name: "", type: "uint64" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "saleEnd",
    outputs: [{ internalType: "uint64", name: "", type: "uint64" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "whitelistEnabled",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "whitelistStart",
    outputs: [{ internalType: "uint64", name: "", type: "uint64" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "whitelistPrice",
    outputs: [{ internalType: "uint128", name: "", type: "uint128" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "payoutWallet",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "feeRecipient",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "proceedsFeeBps",
    outputs: [{ internalType: "uint96", name: "", type: "uint96" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "remainingSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "newBaseURI", type: "string" }],
    name: "setBaseURI",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "newContractURI", type: "string" }],
    name: "setContractURI",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "contractURI",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "newWallet", type: "address" }],
    name: "setPayoutWallet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint96", name: "newProceedsFeeBps", type: "uint96" },
      { internalType: "address", name: "newFeeRecipient", type: "address" },
    ],
    name: "updateFeeConfig",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bool", name: "enabled", type: "bool" },
      { internalType: "uint64", name: "whitelistStart_", type: "uint64" },
      { internalType: "uint128", name: "whitelistPrice_", type: "uint128" },
    ],
    name: "setWhitelistConfig",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "addToWhitelist",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "removeFromWhitelist",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address[]", name: "accounts", type: "address[]" }],
    name: "addManyToWhitelist",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address[]", name: "accounts", type: "address[]" }],
    name: "removeManyFromWhitelist",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "struct MintConfig",
        name: "config",
        type: "tuple",
        components: [
          { internalType: "uint64", name: "saleStart", type: "uint64" },
          { internalType: "uint64", name: "saleEnd", type: "uint64" },
          { internalType: "uint32", name: "walletLimit", type: "uint32" },
          { internalType: "uint128", name: "price", type: "uint128" },
        ],
      },
    ],
    name: "setMintConfig",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "struct SaleTerms",
        name: "terms",
        type: "tuple",
        components: [
          { internalType: "string", name: "baseURI", type: "string" },
          { internalType: "string", name: "contractURI", type: "string" },
          { internalType: "address", name: "payoutWallet", type: "address" },
          { internalType: "uint64", name: "saleStart", type: "uint64" },
          { internalType: "uint64", name: "saleEnd", type: "uint64" },
          { internalType: "uint128", name: "mintPrice", type: "uint128" },
          { internalType: "uint32", name: "walletLimit", type: "uint32" },
        ],
      },
    ],
    name: "updateSaleTerms",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    name: "withdrawRaised",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "quantity", type: "uint256" }],
    name: "mint",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "wallet", type: "address" }],
    name: "mintedBy",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "wallet", type: "address" }],
    name: "mintedPerWallet",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "whitelist",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ---------------------------------------------------------------------------
// NFT Collection display images (address → image path)
// ---------------------------------------------------------------------------

export const NFT_COLLECTION_IMAGES: Record<string, string> = {
  "0x22634f79250244838c0317ecfad78f16e94124eb": BearsImg,
};

// ---------------------------------------------------------------------------
// ERC20 ABI
// ---------------------------------------------------------------------------

export const erc20Abi = [
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transferFrom",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
      { indexed: false, internalType: "uint256", name: "value", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "owner", type: "address" },
      { indexed: true, internalType: "address", name: "spender", type: "address" },
      { indexed: false, internalType: "uint256", name: "value", type: "uint256" },
    ],
    name: "Approval",
    type: "event",
  },
] as const;

// ---------------------------------------------------------------------------
// NFTFactoryLens ABI
// ---------------------------------------------------------------------------

const COLLECTION_INFO_COMPONENTS = [
  { internalType: "address", name: "nft", type: "address" },
  { internalType: "address", name: "creator", type: "address" },
  { internalType: "bool", name: "is721A", type: "bool" },
  { internalType: "string", name: "name", type: "string" },
  { internalType: "string", name: "symbol", type: "string" },
  { internalType: "string", name: "contractURI", type: "string" },
  { internalType: "uint256", name: "maxSupply", type: "uint256" },
  { internalType: "uint256", name: "totalMinted", type: "uint256" },
  { internalType: "uint256", name: "remaining", type: "uint256" },
  { internalType: "uint128", name: "mintPrice", type: "uint128" },
  { internalType: "uint32", name: "walletLimit", type: "uint32" },
  { internalType: "uint64", name: "saleStart", type: "uint64" },
  { internalType: "uint64", name: "saleEnd", type: "uint64" },
  { internalType: "bool", name: "whitelistEnabled", type: "bool" },
  { internalType: "uint64", name: "whitelistStart", type: "uint64" },
  { internalType: "uint128", name: "whitelistPrice", type: "uint128" },
  { internalType: "address", name: "owner", type: "address" },
  { internalType: "address", name: "payoutWallet", type: "address" },
  { internalType: "address", name: "feeRecipient", type: "address" },
  { internalType: "uint96", name: "proceedsFeeBps", type: "uint96" },
] as const;

export const NFTFactoryLens = [
  {
    inputs: [{ internalType: "address", name: "nft", type: "address" }],
    name: "getCollection",
    outputs: [{
      internalType: "struct NFTFactoryLens.CollectionInfo",
      name: "",
      type: "tuple",
      components: COLLECTION_INFO_COMPONENTS,
    }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "creator", type: "address" }],
    name: "getCollectionsByCreator",
    outputs: [{
      internalType: "struct NFTFactoryLens.CollectionInfo[]",
      name: "infos",
      type: "tuple[]",
      components: COLLECTION_INFO_COMPONENTS,
    }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "offset", type: "uint256" },
      { internalType: "uint256", name: "limit", type: "uint256" },
    ],
    name: "getAllCollections",
    outputs: [{
      internalType: "struct NFTFactoryLens.CollectionInfo[]",
      name: "infos",
      type: "tuple[]",
      components: COLLECTION_INFO_COMPONENTS,
    }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ---------------------------------------------------------------------------
// Aliases
// ---------------------------------------------------------------------------

export const LaunchpadPresaleContract = PresaleContract;
export const AirdropMultisenderContract = AirdropMultiSender;
export const NFTFactoryContract = NFTFactory;
export const PresaleFactoryContract = PresaleFactory;
