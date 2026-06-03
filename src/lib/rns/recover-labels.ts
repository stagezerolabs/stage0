/**
 * Recovers label strings for nodes whose labels are blank in the subgraph.
 *
 * The Goldsky subgraph stores label: "" on Rise Testnet because the node
 * doesn't expose calldata during event processing. We work around this by:
 *   1. Using createdAtBlock from the subgraph to pinpoint the registration tx
 *   2. Fetching the NameRegistered log from exactly that block
 *   3. Decoding register(name, duration, resolver_) calldata to extract `name`
 *   4. Verifying the name's namehash matches the event's `node` topic
 *
 * No localStorage is used — this is a pure on-chain read.
 */

import { decodeAbiParameters, decodeFunctionData, parseAbiItem } from "viem";
import type { Address, Hex, PublicClient } from "viem";
import { RNSRegistrar } from "@/lib/rns/abis";
import { rnsNamehash } from "@/lib/rns/utils";
import type { IndexedRnsDomain } from "@/lib/indexer/rns-goldsky";

// register(string,uint256,address) — used to locate inner call in Orchestrator payloads
const REGISTER_SELECTOR = "5dc1aad3";

const NAME_REGISTERED_EVENT = parseAbiItem(
  "event NameRegistered(string indexed name, bytes32 indexed node, address indexed registrant, uint256 expires)"
);

/**
 * Decode the label from a transaction's input data.
 *
 * Strategy 1 – Direct call: transaction goes straight to the registrar.
 * Strategy 2 – Orchestrator call (ERC-7702 / Rise Wallet): the outer
 *   transaction embeds the inner register() call; locate the selector
 *   in the raw input and decode the bytes that follow.
 */
function decodeLabelFromInput(input: Hex): string {
  // Strategy 1: direct call to registrar
  try {
    const { functionName, args } = decodeFunctionData({ abi: RNSRegistrar, data: input });
    if (functionName === "register" && args?.[0]) {
      return (args[0] as string).toLowerCase();
    }
  } catch { /* not a direct register() call */ }

  // Strategy 2: inner register() call wrapped by Rise Wallet Orchestrator (ERC-7702).
  // Scan the raw input for the register() selector, then decode the ABI params that follow.
  const inputHex = input.toLowerCase();
  // Valid selector positions are even hex-string indices ≥ 2 (past the "0x" prefix)
  const selectorPos = inputHex.indexOf(REGISTER_SELECTOR, 2);
  if (selectorPos > 0 && selectorPos % 2 === 0) {
    try {
      const innerHex = ("0x" + inputHex.slice(selectorPos + 8)) as Hex;
      const decoded = decodeAbiParameters(
        [{ name: "name", type: "string" }, { name: "duration", type: "uint256" }, { name: "resolver", type: "address" }],
        innerHex,
      );
      return (decoded[0] as string).toLowerCase();
    } catch { /* inner decode failed */ }
  }

  return "";
}

/**
 * Fetches on-chain NameRegistered logs for `owner`, decodes the calldata,
 * and returns a node→label map for the requested domains.
 *
 * Uses createdAtBlock from the subgraph to query only the block where each
 * domain was registered — avoiding a full chain scan.
 *
 * Pure on-chain read — no localStorage side effects.
 */
export async function recoverLabelsFromChain(
  owner: Address,
  registrar: Address,
  publicClient: PublicClient,
  targetDomains: IndexedRnsDomain[]
): Promise<Map<string, string>> {
  const recovered = new Map<string, string>();
  if (!targetDomains.length) return recovered;

  await Promise.allSettled(
    targetDomains.map(async (domain) => {
      const nodeHex = domain.node.toLowerCase();
      const block = domain.createdAtBlock;
      if (!block) return;

      // Fetch logs only from the block where this domain was registered
      const logs = await publicClient.getLogs({
        address: registrar,
        event: NAME_REGISTERED_EVENT,
        args: { registrant: owner },
        fromBlock: block,
        toBlock: block,
      });

      for (const log of logs) {
        const logNode = (log.args.node as Hex | undefined)?.toLowerCase();
        if (logNode !== nodeHex) continue;
        if (!log.transactionHash) continue;

        const tx = await publicClient.getTransaction({ hash: log.transactionHash });
        const name = decodeLabelFromInput(tx.input);
        if (!name) continue;

        // Sanity-check: computed namehash must match the on-chain node.
        if (rnsNamehash(name).toLowerCase() !== nodeHex) continue;

        recovered.set(nodeHex, name);
        break;
      }
    })
  );

  return recovered;
}
