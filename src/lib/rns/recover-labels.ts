/**
 * Recovers label strings for nodes whose labels are blank in the subgraph.
 *
 * The Goldsky subgraph stores label: "" on Rise Testnet because the node
 * doesn't expose calldata during event processing. We work around this by:
 *   1. Fetching all NameRegistered events where registrant == owner
 *   2. For each event, fetching the originating transaction
 *   3. Decoding register(name, duration, resolver_) calldata to extract `name`
 *   4. Verifying the name's namehash matches the event's `node` topic
 *   5. Persisting the mapping in label-cache (localStorage)
 */

import { decodeFunctionData, parseAbiItem } from "viem";
import type { Address, Hex, PublicClient } from "viem";
import { RNSRegistrar } from "@/lib/rns/abis";
import { cacheRnsLabel, getCachedRnsLabel } from "@/lib/rns/label-cache";
import { rnsNamehash } from "@/lib/rns/utils";

const NAME_REGISTERED_EVENT = parseAbiItem(
  "event NameRegistered(string indexed name, bytes32 indexed node, address indexed registrant, uint256 expires)"
);

const CHUNK_SIZE = 50_000n;

async function getLogsChunked(
  publicClient: PublicClient,
  registrar: Address,
  owner: Address,
  latestBlock: bigint
): Promise<Array<{ transactionHash: `0x${string}` | null; args: { node?: Hex } }>> {
  const results: Array<{ transactionHash: `0x${string}` | null; args: { node?: Hex } }> = [];
  let from = 0n;
  while (from <= latestBlock) {
    const to = from + CHUNK_SIZE - 1n > latestBlock ? latestBlock : from + CHUNK_SIZE - 1n;
    try {
      const chunk = await publicClient.getLogs({
        address: registrar,
        event: NAME_REGISTERED_EVENT,
        args: { registrant: owner },
        fromBlock: from,
        toBlock: to,
      });
      results.push(...chunk);
    } catch {
      // Chunk failed (range too wide on some nodes) — skip silently.
    }
    from += CHUNK_SIZE;
  }
  return results;
}

/**
 * Fetches on-chain NameRegistered logs for `owner`, decodes the calldata,
 * writes recovered mappings to the label cache, and returns a node→label map.
 *
 * Only queries for `targetNodes` that are not already in the cache.
 */
export async function recoverLabelsFromChain(
  owner: Address,
  registrar: Address,
  publicClient: PublicClient,
  targetNodes: Hex[]
): Promise<Map<string, string>> {
  const recovered = new Map<string, string>();
  if (!targetNodes.length) return recovered;

  // Only attempt nodes that are not already cached.
  const needed = new Set(
    targetNodes.filter((n) => !getCachedRnsLabel(n)).map((n) => n.toLowerCase())
  );
  if (!needed.size) return recovered;

  const latestBlock = await publicClient.getBlockNumber();
  const logs = await getLogsChunked(publicClient, registrar, owner, latestBlock);

  await Promise.allSettled(
    logs.map(async (log) => {
      const nodeHex = log.args.node as Hex | undefined;
      if (!nodeHex || !needed.has(nodeHex.toLowerCase())) return;
      if (!log.transactionHash) return;

      const tx = await publicClient.getTransaction({ hash: log.transactionHash });
      const { functionName, args } = decodeFunctionData({
        abi: RNSRegistrar,
        data: tx.input,
      });
      if (functionName !== "register" || !args?.[0]) return;

      const name = (args[0] as string).toLowerCase();
      // Sanity-check: computed namehash must match the on-chain node.
      if (rnsNamehash(name).toLowerCase() !== nodeHex.toLowerCase()) return;

      cacheRnsLabel(nodeHex, name);
      recovered.set(nodeHex.toLowerCase(), name);
    })
  );

  return recovered;
}
