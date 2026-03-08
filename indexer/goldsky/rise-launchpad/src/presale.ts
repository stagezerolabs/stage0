import { ethereum } from '@graphprotocol/graph-ts';
import {
  ClaimsEnabled,
  ConfigUpdated,
  ContributionReceived,
  PresaleFinalized,
  RefundClaimed,
  TokensDeposited,
} from '../generated/templates/PresaleContract/LaunchpadPresale';
import { refreshPresale } from './presaleEntity';

function refreshFromEvent(event: ethereum.Event): void {
  const entity = refreshPresale(event.address, event.block.number, event.block.timestamp);
  entity.save();
}

export function handleContributionReceived(event: ContributionReceived): void {
  refreshFromEvent(event);
}

export function handleConfigUpdated(event: ConfigUpdated): void {
  refreshFromEvent(event);
}

export function handleTokensDeposited(event: TokensDeposited): void {
  refreshFromEvent(event);
}

export function handlePresaleFinalized(event: PresaleFinalized): void {
  refreshFromEvent(event);
}

export function handleClaimsEnabled(event: ClaimsEnabled): void {
  refreshFromEvent(event);
}

export function handleRefundClaimed(event: RefundClaimed): void {
  refreshFromEvent(event);
}
