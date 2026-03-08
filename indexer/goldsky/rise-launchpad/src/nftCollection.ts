import {
  ContractURIUpdated,
  MintConfigUpdated,
  PayoutWalletUpdated,
  SaleTermsUpdated,
  Transfer,
} from '../generated/templates/NftCollectionContract/LaunchpadNFT';
import { refreshNftCollection } from './nftEntity';

export function handleTransfer(event: Transfer): void {
  const entity = refreshNftCollection(event.address, event.block.number, event.block.timestamp);
  entity.save();
}

export function handleMintConfigUpdated(event: MintConfigUpdated): void {
  const entity = refreshNftCollection(event.address, event.block.number, event.block.timestamp);
  entity.save();
}

export function handleContractURIUpdated(event: ContractURIUpdated): void {
  const entity = refreshNftCollection(event.address, event.block.number, event.block.timestamp);
  entity.save();
}

export function handlePayoutWalletUpdated(event: PayoutWalletUpdated): void {
  const entity = refreshNftCollection(event.address, event.block.number, event.block.timestamp);
  entity.save();
}

export function handleSaleTermsUpdated(event: SaleTermsUpdated): void {
  const entity = refreshNftCollection(event.address, event.block.number, event.block.timestamp);
  entity.save();
}
