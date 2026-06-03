import { ByteArray, Bytes, crypto } from "@graphprotocol/graph-ts";
import {
  AddrChanged,
  TextChanged,
} from "../generated/RNSResolver/RNSResolver";
import { RnsDomain, RnsReverseRecord } from "../generated/schema";

// keccak256("label") — event.params.key is the hash because `key` is indexed string
const LABEL_KEY_HASH: Bytes = crypto.keccak256(ByteArray.fromUTF8("label")) as Bytes;

export function handleAddrChanged(event: AddrChanged): void {
  const id = event.params.node.toHexString();
  const domain = RnsDomain.load(id);
  if (!domain) return;

  const addr = event.params.addr;
  domain.resolvedAddress = addr;
  domain.updatedAtBlock = event.block.number;
  domain.save();

  // Upsert reverse record keyed on the resolved address
  const reverseId = addr.toHexString().toLowerCase();
  let reverse = RnsReverseRecord.load(reverseId);
  if (!reverse) {
    reverse = new RnsReverseRecord(reverseId);
  }
  reverse.domain = id;
  reverse.save();
}

// When setText("label", value) is called after registration, persist the
// human-readable label on the domain so the subgraph can return it directly.
export function handleTextChanged(event: TextChanged): void {
  if (!event.params.key.equals(LABEL_KEY_HASH)) return;
  const domain = RnsDomain.load(event.params.node.toHexString());
  if (!domain) return;
  const label = event.params.value.toLowerCase();
  if (!label) return;
  domain.label = label;
  domain.fqdn = label + ".rise";
  domain.updatedAtBlock = event.block.number;
  domain.save();
}
