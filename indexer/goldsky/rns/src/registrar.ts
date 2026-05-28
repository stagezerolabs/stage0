import { Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  NameRegistered,
  NameReleased,
  NameRenewed,
} from "../generated/RNSRegistrar/RNSRegistrar";
import { RnsDomain } from "../generated/schema";

/**
 * The `name` parameter is indexed in the contract ABI which means only its
 * keccak256 hash is stored in the log — the original string is unrecoverable
 * from event.params.name (a Bytes hash).
 *
 * We recover the original label by ABI-decoding the transaction calldata:
 *   register(string name, uint256 duration, address resolver_)
 */
function decodeLabelFromRegisterCalldata(input: Bytes): string {
  if (input.length <= 4) return "";
  const data = Bytes.fromUint8Array(input.slice(4));
  const decoded = ethereum.decode("(string,uint256,address)", data);
  if (!decoded) return "";
  return decoded.toTuple()[0].toString().toLowerCase();
}

/**
 * Recover the label from a renew(string name, uint256 duration) calldata.
 * Not strictly required — the entity already has the label from registration —
 * but useful if a domain is renewed before it is indexed (e.g. re-org).
 */
function decodeLabelFromRenewCalldata(input: Bytes): string {
  if (input.length <= 4) return "";
  const data = Bytes.fromUint8Array(input.slice(4));
  const decoded = ethereum.decode("(string,uint256)", data);
  if (!decoded) return "";
  return decoded.toTuple()[0].toString().toLowerCase();
}

export function handleNameRegistered(event: NameRegistered): void {
  const id = event.params.node.toHexString();

  let domain = RnsDomain.load(id);
  if (!domain) {
    domain = new RnsDomain(id);
    domain.createdAtBlock = event.block.number;
    domain.registeredAt = event.block.timestamp;
  }

  const name = decodeLabelFromRegisterCalldata(event.transaction.input);
  domain.label = name;
  domain.fqdn = name.length > 0 ? name + ".rise" : "";
  domain.owner = event.params.registrant;
  domain.registrant = event.params.registrant;
  domain.expiry = event.params.expires;
  domain.updatedAtBlock = event.block.number;
  domain.releasedAt = null;

  domain.save();
}

export function handleNameRenewed(event: NameRenewed): void {
  const id = event.params.node.toHexString();
  const domain = RnsDomain.load(id);
  if (!domain) {
    // Edge case: renewed before registration was indexed (unlikely but safe)
    const newDomain = new RnsDomain(id);
    const name = decodeLabelFromRenewCalldata(event.transaction.input);
    newDomain.label = name;
    newDomain.fqdn = name.length > 0 ? name + ".rise" : "";
    // Owner unknown at this point — use zero address placeholder
    newDomain.owner = Bytes.fromHexString(
      "0x0000000000000000000000000000000000000000"
    );
    newDomain.registrant = newDomain.owner;
    newDomain.expiry = event.params.expires;
    newDomain.renewedAt = event.block.timestamp;
    newDomain.registeredAt = event.block.timestamp;
    newDomain.createdAtBlock = event.block.number;
    newDomain.updatedAtBlock = event.block.number;
    newDomain.save();
    return;
  }

  domain.expiry = event.params.expires;
  domain.renewedAt = event.block.timestamp;
  domain.updatedAtBlock = event.block.number;
  domain.save();
}

export function handleNameReleased(event: NameReleased): void {
  const id = event.params.node.toHexString();
  const domain = RnsDomain.load(id);
  if (!domain) return;

  domain.releasedAt = event.block.timestamp;
  domain.updatedAtBlock = event.block.number;
  domain.save();
}
