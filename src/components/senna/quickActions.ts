import React from 'react';
import { Coins, Lock, Send, Star } from '@/components/ui/icons';
import type { SennaActionType } from './types';

export interface QuickAction {
  actionType: SennaActionType;
  label: string;
  sub: string;
  prompt: string;
  icon: React.FC<{ className?: string }>;
}

export const SENNA_QUICK_ACTIONS: QuickAction[] = [
  {
    actionType: 'create_token',
    label: 'Create a token',
    sub: 'Deploy an ERC-20 on RISE',
    prompt: 'I want to create a token',
    icon: Coins,
  },
  {
    actionType: 'lock_token',
    label: 'Lock tokens',
    sub: 'Time-lock liquidity or supply',
    prompt: 'I want to lock some tokens',
    icon: Lock,
  },
  {
    actionType: 'airdrop_tokens',
    label: 'Airdrop',
    sub: 'Bulk send to many wallets',
    prompt: 'I want to do an airdrop',
    icon: Send,
  },
  {
    actionType: 'buy_name',
    label: 'Buy a name',
    sub: 'Register a .rise name',
    prompt: 'I want to register a .rise name',
    icon: Star,
  },
];
