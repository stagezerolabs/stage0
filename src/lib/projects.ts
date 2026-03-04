export interface Project {
  id: string;
  address: string;
  name: string;
  symbol: string;
  status: 'Live' | 'Upcoming' | 'Ended';
  description: string;
  targetRaise: string;
  raised: string;
  raisePercentage: number;
  participants: number;
  minAllocation: string;
  maxAllocation: string;
  tokenPrice: string;
  vesting: string;
  startDate: string;
  endDate: string;
  chain: string;
  links: {
    website: string;
    twitter: string;
    whitepaper: string;
  };
}

export const projects: Project[] = [
  {
    id: '1',
    address: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
    name: 'Nexus Protocol',
    symbol: 'NXS',
    status: 'Live',
    description: 'Nexus Protocol is a cross-chain liquidity aggregation platform that enables seamless DeFi interoperability across multiple blockchain networks. Our mission is to break down barriers between ecosystems and create a unified liquidity layer for the entire Web3 space.',
    targetRaise: '$750,000',
    raised: '$562,500',
    raisePercentage: 75,
    participants: 1847,
    minAllocation: '$100',
    maxAllocation: '$5,000',
    tokenPrice: '$0.025',
    vesting: '25% TGE, 75% over 6 months',
    startDate: 'Jan 15, 2026',
    endDate: 'Jan 22, 2026',
    chain: 'Sepolia',
    links: {
      website: '#',
      twitter: '#',
      whitepaper: '#',
    },
  },
  {
    id: '2',
    address: '0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c',
    name: 'Aether Finance',
    symbol: 'AETH',
    status: 'Upcoming',
    description: 'Aether Finance is a decentralized lending protocol that offers flash loans and fixed-rate lending. It aims to provide a more stable and predictable lending environment for DeFi users.',
    targetRaise: '$1,200,000',
    raised: '$150,000',
    raisePercentage: 12.5,
    participants: 432,
    minAllocation: '$250',
    maxAllocation: '$10,000',
    tokenPrice: '$0.10',
    vesting: '10% TGE, 90% over 12 months linear',
    startDate: 'Jan 25, 2026',
    endDate: 'Feb 5, 2026',
    chain: 'Sepolia',
    links: {
      website: '#',
      twitter: '#',
      whitepaper: '#',
    },
  },
  {
    id: '3',
    address: '0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d',
    name: 'Quantum Vault',
    symbol: 'QVT',
    status: 'Ended',
    description: 'Quantum Vault is a yield farming aggregator that uses quantum-inspired algorithms to optimize yield strategies across multiple DeFi protocols.',
    targetRaise: '$500,000',
    raised: '$500,000',
    raisePercentage: 100,
    participants: 3102,
    minAllocation: '$50',
    maxAllocation: '$2,000',
    tokenPrice: '$0.05',
    vesting: '50% TGE, 50% over 3 months',
    startDate: 'Jan 1, 2026',
    endDate: 'Jan 7, 2026',
    chain: 'Sepolia',
    links: {
      website: '#',
      twitter: '#',
      whitepaper: '#',
    },
  },
  {
    id: 'aurx',
    address: '0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e',
    name: 'Aurox Protocol',
    symbol: 'AURX',
    status: 'Live',
    description: 'Aurox Protocol is a decentralized trading terminal that aggregates liquidity from CEXs and DEXs into a single interface. Built for both retail and institutional traders seeking optimal execution across fragmented markets.',
    targetRaise: '$25,000',
    raised: '$18,400',
    raisePercentage: 72,
    participants: 614,
    minAllocation: '$50',
    maxAllocation: '$2,500',
    tokenPrice: '$0.08',
    vesting: '20% TGE, 80% over 4 months',
    startDate: 'Feb 20, 2026',
    endDate: 'Mar 10, 2026',
    chain: 'Rise',
    links: {
      website: '#',
      twitter: '#',
      whitepaper: '#',
    },
  },
  {
    id: 'vltx',
    address: '0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f',
    name: 'Voltex Finance',
    symbol: 'VLTX',
    status: 'Live',
    description: 'Voltex Finance is a next-generation perpetual DEX with up to 50x leverage, powered by an oracle-based pricing model. Designed for fast settlement and minimal slippage on Rise Chain.',
    targetRaise: '$20,000',
    raised: '$9,000',
    raisePercentage: 45,
    participants: 328,
    minAllocation: '$100',
    maxAllocation: '$5,000',
    tokenPrice: '$0.12',
    vesting: '15% TGE, 85% over 6 months',
    startDate: 'Feb 25, 2026',
    endDate: 'Mar 15, 2026',
    chain: 'Rise',
    links: {
      website: '#',
      twitter: '#',
      whitepaper: '#',
    },
  },
  {
    id: 'nblk',
    address: '0x6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a',
    name: 'NeoBlock AI',
    symbol: 'NBLK',
    status: 'Upcoming',
    description: 'NeoBlock AI combines on-chain analytics with machine learning to deliver real-time market intelligence and automated portfolio strategies for DeFi participants.',
    targetRaise: '$50,000',
    raised: '$0',
    raisePercentage: 0,
    participants: 0,
    minAllocation: '$200',
    maxAllocation: '$10,000',
    tokenPrice: '$0.15',
    vesting: '10% TGE, 90% over 9 months',
    startDate: 'Mar 15, 2026',
    endDate: 'Mar 30, 2026',
    chain: 'Rise',
    links: {
      website: '#',
      twitter: '#',
      whitepaper: '#',
    },
  },
];
