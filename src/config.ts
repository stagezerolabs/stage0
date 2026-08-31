import {
  connectorsForWallets,
} from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { RiseWallet, Storage } from "rise-wallet";
import { riseWallet } from "rise-wallet/wagmi";
import { type Address, defineChain, http, zeroAddress } from "viem";
import { createConfig } from "wagmi";
import {
  AirdropMultiSender,
  NFTCollectionContract,
  NFTFactory,
  NFTFactoryLens,
  PresaleContract,
  PresaleFactory,
  RNSRegistrar,
  RNSRegistry,
  RNSResolver,
  TokenFactory,
  TokenLocker,
} from "./lib/contracts/generatedAbis";
import BearsImg from "./assets/Bears.jpg";

const RISE_MAINNET_RPC_URL =
  import.meta.env.VITE_RISE_RPC_URL?.trim() || "https://rpc.risechain.com";

// ---------------------------------------------------------------------------
// Chain definitions
// ---------------------------------------------------------------------------

export const riseMainnet = defineChain({
  id: 4153,
  name: "RISE Mainnet",
  iconUrl: "/rise-network.svg",
  iconBackground: "#0B0E11",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [RISE_MAINNET_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "RISE Explorer", url: "https://explorer.risechain.com" },
  },
});

export const SUPPORTED_CHAINS = [riseMainnet] as const;

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
    [riseMainnet.id]: http(RISE_MAINNET_RPC_URL),
  },
});

// ---------------------------------------------------------------------------
// Address configuration
// ---------------------------------------------------------------------------

const ZERO: Address = zeroAddress;
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
  [riseMainnet.id]: {
    tokenLocker: "0x1A93972280714AB50115Ee839C8861CB37A0Ec61",
    nftFactory: "0x40Dc4C9655f6273803E0C5F049cFdB1Db026486B",
    nftFactoryLens: "0xa0b761A94013FF721fD682eEB7e57709C0e03f42",
    presaleFactory: "0x8DB306030Cf163A6C809fB3599500DBE28Df2CC6",
    tokenFactory: "0x80046108E1292E5d142BCbfaaC47069348AaBDe8",
    airdropMultisender: "0xDB7C570a0489cd0aab0B24816FEF06Acc4Fc01E8",
  },
};

// ---------------------------------------------------------------------------
// Staking contract addresses
// ---------------------------------------------------------------------------

export const STAKING_CONTRACT_ADDRESSES: Record<number, Address> = {
  [riseMainnet.id]: ZERO,
};

// ---------------------------------------------------------------------------
// Explorer URLs
// ---------------------------------------------------------------------------

export const EXPLORER_URLS: Record<number, string> = {
  [riseMainnet.id]: "https://explorer.risechain.com",
};

// ---------------------------------------------------------------------------
// Chain labels
// ---------------------------------------------------------------------------

export const CHAIN_LABELS: Record<number, string> = {
  [riseMainnet.id]: "RISE Mainnet",
};

// ---------------------------------------------------------------------------
// Native token labels
// ---------------------------------------------------------------------------

export const NATIVE_TOKEN_LABELS: Record<number, string> = {
  [riseMainnet.id]: "ETH",
};

// ---------------------------------------------------------------------------
// Helper functions (default to RISE Mainnet)
// ---------------------------------------------------------------------------

export function getContractAddresses(chainId?: number): ContractAddressMap {
  return CONTRACT_ADDRESSES[chainId ?? riseMainnet.id] ?? CONTRACT_ADDRESSES[riseMainnet.id];
}

export function getStakingContractAddress(chainId?: number): Address {
  return STAKING_CONTRACT_ADDRESSES[chainId ?? riseMainnet.id] ?? STAKING_CONTRACT_ADDRESSES[riseMainnet.id];
}

export function getExplorerUrl(chainId?: number): string {
  return EXPLORER_URLS[chainId ?? riseMainnet.id] ?? EXPLORER_URLS[riseMainnet.id];
}

export function getNativeTokenLabel(chainId?: number): string {
  return NATIVE_TOKEN_LABELS[chainId ?? riseMainnet.id] ?? NATIVE_TOKEN_LABELS[riseMainnet.id];
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

export { AirdropMultiSender, NFTCollectionContract, NFTFactory, NFTFactoryLens, PresaleContract, PresaleFactory, RNSRegistrar, RNSRegistry, RNSResolver, TokenFactory, TokenLocker };

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
// RNS contract address map
// ---------------------------------------------------------------------------

export type RnsContractAddressMap = {
  registry: Address;
  resolver: Address;
  registrar: Address;
  auctionHouse: Address;
  marketplace: Address;
};

export const RNS_CONTRACT_ADDRESSES: Record<number, RnsContractAddressMap> = {
  [riseMainnet.id]: {
    registry: "0x6DDca710993C91402d52061868bE76043a4C5888",
    resolver: "0x36D6383774631565AB0D8F3710748610631A675d",
    registrar: "0xbCA437a93C2E7396a68Ce49BE224F65eE3CFd6Db",
    auctionHouse: "0x0E37994c19980A792B83A106cE03a9b8a9cD40Fc",
    marketplace: "0x323A04F474f80225DE60C1Af13a672796aFA6622",
  },
};

export function getRnsContractAddresses(chainId?: number): RnsContractAddressMap {
  return RNS_CONTRACT_ADDRESSES[chainId ?? riseMainnet.id] ?? RNS_CONTRACT_ADDRESSES[riseMainnet.id];
}

// ---------------------------------------------------------------------------
// Aliases
// ---------------------------------------------------------------------------

export const LaunchpadPresaleContract = PresaleContract;
export const AirdropMultisenderContract = AirdropMultiSender;
export const NFTFactoryContract = NFTFactory;
export const PresaleFactoryContract = PresaleFactory;
