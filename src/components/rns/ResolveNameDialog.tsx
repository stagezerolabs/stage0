import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { InlineLoading } from "@/components/ui/spinner";
import { ExternalLink } from "@/components/ui/icons";
import { riseMainnet } from "@/config";
import { useRnsContracts } from "@/lib/hooks/rns/useRnsContracts";
import { useRnsSetAddr } from "@/lib/hooks/rns/useRnsActions";
import { RNSRegistrar, RNSRegistry, RNSResolver } from "@/lib/rns/abis";
import { normalizeRnsLabel } from "@/lib/rns/utils";
import { resolverUpdateBlockReason } from "@/lib/rns/resolver-update";
import { fetchRnsNameResolution } from "@/lib/api/rns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAccount } from "@wagmi/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAddress, isAddressEqual, zeroAddress, type TransactionReceipt } from "viem";
import { useAccount, useConfig, usePublicClient } from "wagmi";
import type { TransferNameSelection } from "./TransferNameDialog";

type Phase = "ready" | "checking" | "wallet" | "verifying" | "unverified" | "success" | "failed";

export default function ResolveNameDialog({ selection, onClose, onUpdated }: {
  selection: TransferNameSelection; onClose: () => void; onUpdated: () => void | Promise<unknown>;
}) {
  const contracts = useRnsContracts();
  const [context] = useState(() => ({ ...contracts, ...selection, label: normalizeRnsLabel(selection.label) }));
  const account = useAccount();
  const config = useConfig();
  const client = usePublicClient({ chainId: context.chainId });
  const queryClient = useQueryClient();
  const { node, setAddr, hash, receipt: observedReceipt, isConfirming, error: writeError, reset } = useRnsSetAddr(context.label, context.resolver, { chainId: context.chainId, account: context.sender });
  const [phase, setPhase] = useState<Phase>("ready");
  const [message, setMessage] = useState<string | null>(null);
  const [recoveredReceipt, setRecoveredReceipt] = useState<TransactionReceipt | null>(null);
  const receipt = recoveredReceipt ?? observedReceipt;
  const locked = useRef(false);
  const verifying = useRef(false);
  const updatedCallback = useRef(onUpdated);
  useEffect(() => { updatedCallback.current = onUpdated; }, [onUpdated]);

  const readState = useCallback(async () => {
    if (!client || !node) throw new Error("RISE RPC is unavailable. Try again shortly.");
    if (node.toLowerCase() !== context.node.toLowerCase()) throw new Error("The name does not match its registry node. Refresh your names.");
    const block = await client.getBlock({ blockTag: "latest" });
    const [owner, expiry, resolver] = await Promise.all([
      client.readContract({ address: context.registry, abi: RNSRegistry, functionName: "owner", args: [node], blockNumber: block.number }),
      client.readContract({ address: context.registrar, abi: RNSRegistrar, functionName: "expiryOf", args: [context.label], blockNumber: block.number }),
      client.readContract({ address: context.registry, abi: RNSRegistry, functionName: "resolver", args: [node], blockNumber: block.number }),
    ]);
    const resolvedAddress = isAddressEqual(resolver, context.resolver)
      ? await client.readContract({ address: resolver, abi: RNSResolver, functionName: "addr", args: [node], blockNumber: block.number })
      : undefined;
    return { owner, expiry, resolver, resolvedAddress, now: block.timestamp };
  }, [client, node, context]);
  const editable = phase === "ready" || phase === "failed";
  const state = useQuery({ queryKey: ["rns", "resolver-update", context.chainId, context.node], queryFn: readState, enabled: Boolean(client && node) && editable, staleTime: 0, refetchInterval: 15_000, retry: 1 });
  const blocked = resolverUpdateBlockReason({ ...state.data, connected: account.isConnected, supportedChain: account.chainId === riseMainnet.id && context.chainId === riseMainnet.id, wallet: account.address, custody: context.custody, now: BigInt(Math.floor(Date.now()/1000)), expectedResolver: context.resolver })
    ?? (!account.address || !isAddressEqual(account.address, context.sender) ? "Reconnect the wallet that opened this dialog." : null);
  const busy = phase === "checking" || phase === "wallet" || phase === "verifying";

  const verify = useCallback(async (confirmed: TransactionReceipt) => {
    if (verifying.current) return;
    verifying.current = true; setPhase("verifying"); setMessage(null);
    try {
      if (confirmed.status !== "success") {
        locked.current = false; setPhase("failed"); setMessage("The transaction reverted. No address update was confirmed."); return;
      }
      const fresh = await readState();
      if (!fresh.resolvedAddress || !isAddressEqual(fresh.resolvedAddress, context.sender) || !isAddressEqual(fresh.owner, context.sender)) throw new Error("The latest owner or address record differs from this update. Check the explorer before taking further action.");
      setPhase("success");
      // The API independently re-reads the chain. Never edit indexed rows from the browser.
      try {
        await fetchRnsNameResolution({ name: context.label, chainId: context.chainId });
        await queryClient.invalidateQueries({ predicate: ({queryKey}) => queryKey[0] === "rns" ||
          ((queryKey[0] === "readContract" || queryKey[0] === "readContracts") && JSON.stringify(queryKey, (_key,value) => typeof value === "bigint" ? value.toString() : value).toLowerCase().includes(context.resolver.toLowerCase())) });
        await updatedCallback.current();
      } catch { setMessage("Address verified onchain. The API is still catching up; refresh shortly."); }
    } catch (error) { setPhase("unverified"); setMessage(error instanceof Error ? error.message : "Could not verify the address. Retry verification without sending another transaction."); }
    finally { verifying.current = false; }
  }, [readState, context, queryClient]);

  const recoverReceipt = useCallback(async () => {
    if (!client || !hash || verifying.current) return;
    setPhase("verifying");
    try { const confirmed = await client.getTransactionReceipt({ hash }); setRecoveredReceipt(confirmed); await verify(confirmed); }
    catch { setPhase("unverified"); setMessage("No confirmed receipt is available yet. Check the explorer or retry verification."); }
  }, [client, hash, verify]);

  useEffect(() => {
    if (phase !== "wallet") return;
    if (receipt) void verify(receipt);
    else if (writeError) {
      if (hash) void recoverReceipt();
      else { locked.current = false; setPhase("failed"); setMessage("The transaction was rejected or could not be submitted. Nothing was changed by this flow."); }
    }
  }, [phase, receipt, writeError, hash, verify, recoverReceipt]);

  const submit = async () => {
    if (locked.current || !editable || blocked || state.error || !client || !node) return;
    locked.current = true; reset(); setRecoveredReceipt(null); setPhase("checking"); setMessage(null);
    try {
      const fresh = await readState();
      const live = getAccount(config);
      const reason = resolverUpdateBlockReason({ ...fresh, connected: live.isConnected, supportedChain: live.chainId === riseMainnet.id && context.chainId === riseMainnet.id, wallet: live.address, custody: context.custody, expectedResolver: context.resolver });
      if (reason) throw new Error(reason);
      if (!live.address || !isAddressEqual(live.address, context.sender)) throw new Error("Your wallet changed. Reopen this dialog.");
      await client.simulateContract({ address: context.resolver, abi: RNSResolver, functionName: "setAddr", args: [node, context.sender], account: context.sender });
      const current = getAccount(config);
      if (!current.isConnected || current.chainId !== context.chainId || !current.address || !isAddressEqual(current.address, context.sender)) throw new Error("Your wallet changed. Reopen this dialog.");
      setPhase("wallet"); setAddr({ addr: getAddress(context.sender) });
    } catch (error) { locked.current = false; setPhase("failed"); setMessage(error instanceof Error ? error.message.split("\n")[0] : "Unable to verify this update."); }
  };
  const status = phase === "success" ? "Resolving address updated" : phase === "checking" ? "Checking name" : phase === "wallet" ? hash ? isConfirming ? "Confirming update" : "Transaction submitted" : "Awaiting wallet confirmation" : phase === "verifying" ? "Verifying address" : phase === "unverified" ? "Update not yet verified" : phase === "failed" ? "Update failed or rejected" : null;
  const transactionHash = receipt?.transactionHash ?? hash;
  const alreadyPointsToWallet = Boolean(state.data?.resolvedAddress && isAddressEqual(state.data.resolvedAddress, context.sender));
  return <ResponsiveDialog open dismissible={!busy} onOpenChange={open => { if (!open && !busy) onClose(); }} title="Update resolving address" description={`${context.label}.rise`}>
    <div className="space-y-5">
      <p className="text-sm leading-6 text-ink-muted">Point this name to your wallet so other apps can resolve it to you.</p>
      <dl className="space-y-4 rounded-2xl border border-border bg-canvas p-4 text-sm">
        <div><dt className="text-ink-muted">Currently points to</dt><dd className="mt-1 break-all font-mono text-ink">{phase === "success" ? getAddress(context.sender) : state.data?.resolvedAddress && state.data.resolvedAddress !== zeroAddress ? getAddress(state.data.resolvedAddress) : state.data ? state.data.resolvedAddress === undefined ? "Custom or unconfigured resolver" : "No address set" : "Checking…"}</dd></div>
        <div><dt className="text-ink-muted">Your wallet</dt><dd className="mt-1 break-all font-mono text-ink">{getAddress(context.sender)}</dd></div>
      </dl>
      <p className="text-sm leading-6 text-ink-muted">One transaction with a network fee. Ownership, text records and expiry stay unchanged. Making this your primary name is a separate, gas-free signature.</p>
      {status && <div role="status" className="font-semibold text-ink">{busy ? <InlineLoading label={status} /> : status}</div>}
      {phase === "success" && <p className="text-sm leading-6 text-ink-muted">Your name now points to your wallet. Other apps will update after indexing; you may need to refresh them.</p>}
      {(message || (editable && (blocked || state.error))) && <p role="alert" className="break-words text-sm leading-6 text-ink-muted">{message ?? (state.error ? "Cannot verify the resolver right now. Please retry." : blocked)}</p>}
      {state.error && editable && <button className="text-sm text-accent underline" onClick={() => void state.refetch()}>Retry checks</button>}
      {transactionHash && <a className="inline-flex items-center gap-2 text-sm text-accent" href={`${context.explorerUrl}/tx/${transactionHash}`} target="_blank" rel="noopener noreferrer">View transaction <ExternalLink size={14}/></a>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button onClick={onClose} disabled={busy} className="btn-secondary names-action-btn disabled:opacity-50">{phase === "success" ? "Done" : "Close"}</button>
        {phase === "unverified" ? <button onClick={() => void (receipt ? verify(receipt) : recoverReceipt())} className="btn-primary names-action-btn">Retry verification</button> : phase !== "success" && !alreadyPointsToWallet && <button onClick={() => void submit()} disabled={!editable || Boolean(blocked || state.error)} className="btn-primary names-action-btn disabled:opacity-50">Use my wallet</button>}
      </div>
    </div>
  </ResponsiveDialog>;
}
