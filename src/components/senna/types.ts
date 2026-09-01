export type SennaActionType =
  | 'create_token'
  | 'create_nft'
  | 'create_presale'
  | 'lock_token'
  | 'airdrop_tokens'
  | 'buy_name'
  | 'open_launchpad'
  | 'open_dashboard'
  | 'open_route';

export interface SennaActionDraft {
  actionType: SennaActionType;
  targetRoute: string;
  requiredWallet?: 'evm' | null;
  requiredChain?: 'rise_mainnet' | null;
  prefill: Record<string, string>;
  summary: string;
  warnings?: string[];
  missingFields?: string[];
  nextSteps?: string[];
}

export type SignerPhase =
  | 'idle'
  | 'needs_wallet'
  | 'needs_chain'
  | 'approving'
  | 'awaiting_signature'
  | 'submitted'
  | 'confirming'
  | 'success'
  | 'error';

export interface SignerState {
  phase: SignerPhase;
  /** Two-step indicator: 'approve' or 'action' if applicable. */
  step?: 'approve' | 'action';
  primaryLabel: string;
  /** Error message safe for users. Empty when no error. */
  errorMessage: string;
  /** Tx hashes to surface as explorer links. */
  approveHash?: `0x${string}` | null;
  actionHash?: `0x${string}` | null;
  /** Address of the thing we just created/bought, if known. */
  createdAddress?: `0x${string}` | null;
  /** Whether the user should hit the primary button now. */
  ready: boolean;
  /** Primary button click handler. */
  primary: () => void;
  /** Whether the primary action is gated by an open wallet/sign. */
  busy: boolean;
  /** Availability, duration, and quote controls for a .rise registration. */
  nameRegistration?: {
    name: string;
    availability: 'checking' | 'available' | 'taken' | 'reserved';
    durationYears: number | null;
    setDurationYears: (years: number) => void;
    options: Array<{
      years: number;
      label: string;
      priceEth: string | null;
      totalUsd: string | null;
      discountPercent: number;
    }>;
    selectedPriceEth: string | null;
    selectedTotalUsd: string | null;
    quoteLoading: boolean;
  };
}
