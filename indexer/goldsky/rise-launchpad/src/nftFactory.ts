import { NFTCreated } from '../generated/NFTFactory/NFTFactory';
import { NftCollectionContract as NftCollectionContractTemplate } from '../generated/templates';
import { refreshNftCollection } from './nftEntity';
import { nowBlock, nowTimestamp } from './common';

export function handleNftCreated(event: NFTCreated): void {
  const entity = refreshNftCollection(event.params.nft, nowBlock(event), nowTimestamp(event));
  entity.creator = event.params.creator;
  entity.is721A = event.params.is721A;
  entity.save();

  NftCollectionContractTemplate.create(event.params.nft);
}
