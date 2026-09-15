import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { InlineLoading } from "@/components/ui/spinner";
import { ExternalLink } from "@/components/ui/icons";
import { SUPPORTED_CHAINS } from "@/config";
import { useRnsContracts } from "@/lib/hooks/rns/useRnsContracts";
import { useRnsRegistrySetOwner } from "@/lib/hooks/rns/useRnsActions";
import { RNSRegistrar, RNSRegistry } from "@/lib/rns/abis";
import { normalizeRnsLabel } from "@/lib/rns/utils";
import { refreshAfterVerifiedTransfer, transferBlockReason, validateTransferRecipient, type RnsCustody } from "@/lib/rns/transfer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAccount } from "@wagmi/core";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { getAddress, isAddressEqual, type Address, type Hex, type TransactionReceipt } from "viem";
import { useAccount, useConfig, usePublicClient } from "wagmi";

export type TransferNameSelection = {
  label: string;
  node: Hex;
  custody: RnsCustody;
  sender: Address;
};

type Props = {
  selection: TransferNameSelection;
  onClose: () => void;
  onTransferred: () => void | Promise<unknown>;
};

type Phase = "ready" | "checking" | "wallet" | "verifying" | "unverified" | "success" | "failed";

/** One instance per selected name, never mounted inside the portfolio map. */
export default function TransferNameDialog({ selection, onClose, onTransferred }: Props) {
  const contracts = useRnsContracts();
  // Keep receipt tracking, sender identity and explorer fixed if the wallet
  // switches account/network after submission.
  const [context] = useState(() => ({ ...contracts, ...selection, label: normalizeRnsLabel(selection.label) }));
  const config = useConfig();
  const account = useAccount();
  const client = usePublicClient({ chainId: context.chainId });
  const queryClient = useQueryClient();
  const { node, setOwner, hash, receipt: observedReceipt, isConfirming, error: writeError, reset } = useRnsRegistrySetOwner(context.label, {
    account: context.sender, chainId: context.chainId,
  });
  const id = useId();
  const [input, setInput] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [phase, setPhase] = useState<Phase>("ready");
  const [message, setMessage] = useState<string | null>(null);
  const [confirmedRecipient, setConfirmedRecipient] = useState<Address | null>(null);
  const [recoveredReceipt, setRecoveredReceipt] = useState<TransactionReceipt | null>(null);
  const receipt = recoveredReceipt ?? observedReceipt;
  const attempt = useRef<Address | null>(null);
  const submitLocked = useRef(false);
  const verifying = useRef(false);
  const onTransferredRef = useRef(onTransferred);
  useEffect(() => { onTransferredRef.current = onTransferred; }, [onTransferred]);

  const readState = useCallback(async () => {
    if (!client || !node) throw new Error("RISE RPC is unavailable. Try again shortly.");
    if (node.toLowerCase() !== context.node.toLowerCase()) throw new Error("This name does not match its registry node. Refresh your names before transferring.");
    // Read a consistent latest block for both ownership and expiry.
    const block = await client.getBlock();
    const [owner, expiry] = await Promise.all([
      client.readContract({ address: context.registry, abi: RNSRegistry, functionName: "owner", args: [node], blockNumber: block.number }),
      client.readContract({ address: context.registrar, abi: RNSRegistrar, functionName: "expiryOf", args: [context.label], blockNumber: block.number }),
    ]);
    return { owner, expiry, now: block.timestamp };
  }, [client, node, context.registry, context.registrar, context.label, context.node]);

  const state = useQuery({
    queryKey: ["rns", "transfer", context.chainId, context.registry, node],
    queryFn: readState,
    enabled: Boolean(client && node) && (phase === "ready" || phase === "failed"),
    staleTime: 0,
    refetchInterval: 15_000,
    retry: 1,
  });
  const supported = account.chainId === context.chainId && SUPPORTED_CHAINS.some((chain) => chain.id === account.chainId);
  const sameWallet = Boolean(account.address && isAddressEqual(account.address, context.sender));
  const blocked = transferBlockReason({
    connected: account.isConnected,
    supportedChain: supported,
    wallet: account.address,
    owner: state.data?.owner,
    custody: context.custody,
    expiry: state.data?.expiry,
    now: BigInt(Math.floor(Date.now() / 1000)),
  }) ?? (!sameWallet ? "Reconnect the wallet that opened this transfer." : null);
  const recipient = validateTransferRecipient(input, state.data?.owner);
  const busy = phase === "checking" || phase === "wallet" || phase === "verifying";
  const editable = phase === "ready" || phase === "failed";
  const transactionHash = receipt?.transactionHash ?? hash;

  const verifyTransfer = useCallback(async () => {
    const target = attempt.current;
    if (verifying.current || !target || !receipt || !client || !node) return;
    verifying.current = true;
    setPhase("verifying");
    setMessage(null);
    try {
      if (receipt.status !== "success") {
        attempt.current = null;
        submitLocked.current = false;
        setPhase("failed");
        setMessage("Transfer failed onchain. No ownership or primary-name preference was changed by this flow.");
        return;
      }
      const owner = await client.readContract({ address: context.registry, abi: RNSRegistry, functionName: "owner", args: [node], blockTag: "latest" });
      if (!isAddressEqual(owner, target)) {
        throw new Error("The registry does not currently show the recipient as owner. Check the transaction and retry verification before taking further action.");
      }
      setConfirmedRecipient(target);
      // Only this path may clear a primary preference or modify cached lists.
      try {
        await refreshAfterVerifiedTransfer({ queryClient, sender: context.sender, recipient: target, label: context.label, node, chainId: context.chainId, registry: context.registry, registrar: context.registrar });
        await onTransferredRef.current();
      } catch {
        setMessage("Ownership is verified. Your name list could not fully refresh; reload the page to refresh it.");
      }
      attempt.current = null;
      setPhase("success");
    } catch (error) {
      setPhase("unverified");
      setMessage(error instanceof Error ? error.message : "Could not verify ownership. Retry verification; do not submit another transfer.");
    } finally {
      verifying.current = false;
    }
  }, [receipt, client, node, context, queryClient]);

  const recoverReceipt = useCallback(async () => {
    if (!client || !hash || !attempt.current || verifying.current) return;
    verifying.current = true;
    setPhase("verifying");
    try {
      // Wagmi throws for reverted receipts. Fetch the raw receipt so a revert
      // is shown as failed, while an RPC timeout remains safely unverified.
      const recovered = await client.getTransactionReceipt({ hash });
      setRecoveredReceipt(recovered);
      setMessage(null);
      setPhase("wallet");
    } catch {
      setPhase("unverified");
      setMessage("No confirmed receipt is available yet. Check the explorer or retry verification shortly.");
    } finally {
      verifying.current = false;
    }
  }, [client, hash]);

  useEffect(() => {
    if (phase !== "wallet" || !attempt.current) return;
    if (receipt) {
      void verifyTransfer();
    } else if (writeError) {
      // A receipt polling error does not mean a submitted tx failed. Keep it
      // locked until its receipt can be checked instead of allowing a resend.
      if (hash) {
        void recoverReceipt();
      } else {
        attempt.current = null;
        submitLocked.current = false;
        setPhase("failed");
        setMessage("Transfer failed or was rejected in your wallet. Your primary-name preference is unchanged.");
      }
    }
  }, [phase, receipt, writeError, hash, verifyTransfer, recoverReceipt]);

  const retryVerification = async () => {
    if (receipt) { await verifyTransfer(); return; }
    await recoverReceipt();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitLocked.current || !editable || !acknowledged || recipient.error || blocked || state.error) return;
    submitLocked.current = true;
    reset();
    setRecoveredReceipt(null);
    setMessage(null);
    setPhase("checking");
    try {
      const fresh = await readState();
      const live = getAccount(config);
      const reason = transferBlockReason({ connected: live.isConnected, supportedChain: live.chainId === context.chainId && SUPPORTED_CHAINS.some((chain) => chain.id === live.chainId), wallet: live.address, owner: fresh.owner, custody: context.custody, expiry: fresh.expiry, now: fresh.now });
      if (reason) throw new Error(reason);
      if (!live.address || !isAddressEqual(live.address, context.sender)) throw new Error("Your wallet changed. Reopen the transfer with the correct wallet.");
      const checked = validateTransferRecipient(input, fresh.owner);
      if (checked.address === null) throw new Error(checked.error);
      setInput(checked.address);
      attempt.current = checked.address;
      setPhase("wallet");
      setOwner(checked.address);
    } catch (error) {
      attempt.current = null;
      submitLocked.current = false;
      setPhase("failed");
      setMessage(error instanceof Error ? error.message : "Unable to check this transfer. Please try again.");
    }
  };

  const status = phase === "success" ? "Transfer sent"
    : phase === "checking" ? "Checking ownership"
    : phase === "verifying" ? "Verifying transfer"
    : phase === "unverified" ? "Ownership not yet verified"
    : phase === "failed" ? "Transfer failed or rejected"
    : phase === "wallet" ? hash ? isConfirming ? "Confirming transfer" : "Transaction submitted" : "Awaiting wallet confirmation"
    : null;

  return (
    <ResponsiveDialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }} dismissible={!busy}
      title="Transfer" description={`${context.label}.rise`}>
      <form onSubmit={(event) => { void submit(event); }} className="space-y-5">
        <dl className="space-y-3 rounded-2xl border border-border bg-canvas p-4 text-sm">
          <div><dt className="font-bold text-ink">Current owner</dt><dd className="mt-1 break-all font-mono font-bold text-ink">{confirmedRecipient ?? (state.data?.owner ? getAddress(state.data.owner) : "Checking registry…")}</dd></div>
          <div><dt className="font-bold text-ink">Expires</dt><dd className="mt-1 font-bold text-ink">{state.data ? state.data.expiry > 0n ? new Date(Number(state.data.expiry) * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "No active registration" : "Checking expiry…"}</dd></div>
        </dl>
        {phase !== "success" && (
          <>
            <div>
              <label htmlFor={`${id}-recipient`} className="block text-sm font-semibold text-ink">Recipient address</label>
              <input id={`${id}-recipient`} value={input} onChange={(event) => setInput(event.target.value)}
                onBlur={() => { if (recipient.address) setInput(recipient.address); }}
                disabled={!editable} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="0x…"
                aria-invalid={Boolean(input && recipient.error)} aria-describedby={`${id}-recipient-help`}
                className="mt-2 min-h-12 w-full min-w-0 rounded-xl border border-border-strong bg-canvas px-3 py-3 font-mono text-sm text-ink focus:border-accent focus:outline-none disabled:opacity-60" />
              <p id={`${id}-recipient-help`} className="mt-2 break-all text-xs text-ink-muted">{input ? recipient.error ?? `Send to ${recipient.address}` : "Use the recipient’s EVM wallet address, not a name or exchange deposit address."}</p>
            </div>
            <div className="space-y-2 rounded-2xl border border-border bg-canvas p-4 text-sm leading-6 text-ink-muted">
              <p className="font-medium text-ink">Once confirmed, ownership changes immediately. Stage0 cannot reverse the transfer.</p>
              <p>Transferring does not renew the name or extend its expiry.</p>
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-ink">
              <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} disabled={!editable} className="mt-1 h-4 w-4 shrink-0 accent-accent" />
              I have checked the recipient and understand this transfer cannot be reversed by Stage0.
            </label>
          </>
        )}
        {editable && (state.error || (blocked && blocked !== message)) && (
          <div role="status" className="text-sm leading-6 text-ink-muted">
            {state.error ? "Unable to verify ownership and expiry. Transfer is disabled until the RPC responds." : blocked}
            {state.error && <button type="button" onClick={() => { void state.refetch(); }} className="ml-2 underline">Retry checks</button>}
          </div>
        )}
        <div aria-live="polite" className="space-y-2 text-sm text-ink">
          {status && <p className="font-semibold">{busy ? <InlineLoading label={status} /> : status}</p>}
          {hash && (phase === "wallet" || phase === "verifying") && <p className="text-ink-muted">Checking confirmation and ownership.</p>}
          {phase === "success" && <p className="break-all text-ink-muted">{context.label}.rise now belongs to {confirmedRecipient}.</p>}
          {message && <p role="alert" className="leading-6 text-ink-muted">{message}</p>}
          {transactionHash && <a href={`${context.explorerUrl}/tx/${transactionHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-accent hover:underline">View transaction <ExternalLink size={14} /></a>}
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary names-action-btn disabled:opacity-50">{phase === "success" ? "Done" : transactionHash ? "Close" : "Cancel"}</button>
          {phase === "unverified" ? <button type="button" onClick={() => { void retryVerification(); }} className="btn-primary names-action-btn">Retry verification</button>
            : phase !== "success" && <button type="submit" disabled={!editable || !acknowledged || Boolean(recipient.error || blocked || state.error)} className="btn-primary names-action-btn disabled:opacity-50">Transfer</button>}
        </div>
      </form>
    </ResponsiveDialog>
  );
}
