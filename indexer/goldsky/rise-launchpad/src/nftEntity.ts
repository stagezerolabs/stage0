import { Address, BigInt } from '@graphprotocol/graph-ts';
import { NftCollection } from '../generated/schema';
import { LaunchpadNFT } from '../generated/templates/NftCollectionContract/LaunchpadNFT';
import { ZERO_ADDRESS } from './common';

const ZERO_BI = BigInt.zero();

export function loadOrCreateNftCollection(address: Address, blockNumber: BigInt, timestamp: BigInt): NftCollection {
  const id = address.toHexString().toLowerCase();
  let entity = NftCollection.load(id);

  if (entity == null) {
    entity = new NftCollection(id);
    entity.address = address;
    entity.creator = ZERO_ADDRESS;
    entity.owner = ZERO_ADDRESS;
    entity.payoutWallet = ZERO_ADDRESS;
    entity.is721A = false;
    entity.name = 'NFT Collection';
    entity.symbol = 'NFT';
    entity.contractURI = '';
    entity.maxSupply = ZERO_BI;
    entity.totalMinted = ZERO_BI;
    entity.remaining = ZERO_BI;
    entity.mintPrice = ZERO_BI;
    entity.walletLimit = 0;
    entity.saleStart = ZERO_BI;
    entity.saleEnd = ZERO_BI;
    entity.createdAtBlock = blockNumber;
    entity.createdAtTimestamp = timestamp;
  }

  entity.updatedAtBlock = blockNumber;
  entity.updatedAtTimestamp = timestamp;

  return entity as NftCollection;
}

export function refreshNftCollection(address: Address, blockNumber: BigInt, timestamp: BigInt): NftCollection {
  const entity = loadOrCreateNftCollection(address, blockNumber, timestamp);
  const contract = LaunchpadNFT.bind(address);

  const nameResult = contract.try_name();
  if (!nameResult.reverted) {
    entity.name = nameResult.value;
  }

  const symbolResult = contract.try_symbol();
  if (!symbolResult.reverted) {
    entity.symbol = symbolResult.value;
  }

  const contractUriResult = contract.try_contractURI();
  if (!contractUriResult.reverted) {
    entity.contractURI = contractUriResult.value;
  }

  const maxSupplyResult = contract.try_maxSupply();
  if (!maxSupplyResult.reverted) {
    entity.maxSupply = maxSupplyResult.value;
  }

  const totalMintedResult = contract.try_totalMinted();
  if (!totalMintedResult.reverted) {
    entity.totalMinted = totalMintedResult.value;
  }

  const remainingResult = contract.try_remainingSupply();
  if (!remainingResult.reverted) {
    entity.remaining = remainingResult.value;
  } else if (entity.maxSupply.ge(entity.totalMinted)) {
    entity.remaining = entity.maxSupply.minus(entity.totalMinted);
  }

  const mintPriceResult = contract.try_mintPrice();
  if (!mintPriceResult.reverted) {
    entity.mintPrice = mintPriceResult.value;
  }

  const walletLimitResult = contract.try_walletLimit();
  if (!walletLimitResult.reverted) {
    entity.walletLimit = walletLimitResult.value.toI32();
  }

  const saleStartResult = contract.try_saleStart();
  if (!saleStartResult.reverted) {
    entity.saleStart = saleStartResult.value;
  }

  const saleEndResult = contract.try_saleEnd();
  if (!saleEndResult.reverted) {
    entity.saleEnd = saleEndResult.value;
  }

  const ownerResult = contract.try_owner();
  if (!ownerResult.reverted) {
    entity.owner = ownerResult.value;
  }

  const payoutResult = contract.try_payoutWallet();
  if (!payoutResult.reverted) {
    entity.payoutWallet = payoutResult.value;
  }

  return entity;
}
