import { Transfer, NewResolver } from "../generated/RNSRegistry/RNSRegistry";
import { RnsDomain } from "../generated/schema";

export function handleTransfer(event: Transfer): void {
  const id = event.params.node.toHexString();
  const domain = RnsDomain.load(id);
  if (!domain) return;

  domain.owner = event.params.owner;
  domain.updatedAtBlock = event.block.number;
  domain.save();
}

export function handleNewResolver(event: NewResolver): void {
  const id = event.params.node.toHexString();
  const domain = RnsDomain.load(id);
  if (!domain) return;

  domain.resolver = event.params.resolver;
  domain.updatedAtBlock = event.block.number;
  domain.save();
}
