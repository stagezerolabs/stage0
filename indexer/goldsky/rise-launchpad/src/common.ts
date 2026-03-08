import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';

export const ZERO_ADDRESS = Address.fromString('0x0000000000000000000000000000000000000000');

export function nowBlock(event: ethereum.Event): BigInt {
  return event.block.number;
}

export function nowTimestamp(event: ethereum.Event): BigInt {
  return event.block.timestamp;
}
