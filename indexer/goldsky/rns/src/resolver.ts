import {
  AddrChanged,
  TextChanged,
} from "../generated/RNSResolver/RNSResolver";
import { RnsDomain, RnsReverseRecord } from "../generated/schema";

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

// TextChanged is emitted when a text record is set.
// No-op for now — add a RnsTextRecord entity if key/value queries are needed.
export function handleTextChanged(_event: TextChanged): void {}
