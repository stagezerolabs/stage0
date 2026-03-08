import { PresaleCreated } from '../generated/PresaleFactory/PresaleFactory';
import { PresaleContract as PresaleContractTemplate } from '../generated/templates';
import { refreshPresale } from './presaleEntity';
import { nowBlock, nowTimestamp } from './common';

export function handlePresaleCreated(event: PresaleCreated): void {
  const entity = refreshPresale(event.params.presale, nowBlock(event), nowTimestamp(event));
  entity.creator = event.params.creator;
  entity.saleToken = event.params.saleToken;
  entity.paymentToken = event.params.paymentToken;
  entity.requiresWhitelist = event.params.requiresWhitelist;
  entity.save();

  PresaleContractTemplate.create(event.params.presale);
}
