import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { getExplorerUrl, riseMainnet } from "@/config";
import { useRnsIncomingTransfers } from "@/lib/hooks/rns/useRnsIncomingTransfers";
import type { RnsIncomingTransfer } from "@/lib/api/rns";
import { ExternalLink } from "@/components/ui/icons";

export default function IncomingNamesNotice({ onUseWallet }: { onUseWallet: (item: RnsIncomingTransfer) => void }) {
  const { unread, acknowledge } = useRnsIncomingTransfers();
  const { hash } = useLocation();
  const panel = useRef<HTMLElement>(null);
  const hasUnread = unread.length > 0;
  useEffect(() => { if (hash === "#incoming-names" && hasUnread) panel.current?.scrollIntoView({behavior:"smooth",block:"start"}); }, [hash,hasUnread]);
  if (!hasUnread) return null;
  return <section ref={panel} id="incoming-names" aria-label="Received names" className="scroll-mt-24 rounded-2xl border border-border bg-canvas-alt p-4 sm:p-5">
    <div className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden="true"/><h2 className="font-display text-lg text-ink">{unread.length === 1 ? "You received a name" : `You received ${unread.length} names`}</h2></div>
    <p className="mt-1 text-sm leading-6 text-ink-muted">Ownership is yours. Check the resolving address before using a received name in other apps.</p>
    <div className="mt-4 max-h-80 divide-y divide-border overflow-y-auto">
      {unread.map(item => <div key={item.id} className="flex min-w-0 flex-col gap-3 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><Link to={`/domains?q=${encodeURIComponent(item.label)}`} className="break-all font-semibold text-ink hover:text-accent">{item.name}</Link><a href={`${getExplorerUrl(riseMainnet.id)}/tx/${item.transactionHash}`} target="_blank" rel="noopener noreferrer" className="mt-1 flex w-fit items-center gap-1 text-xs text-ink-muted hover:text-ink">View transfer <ExternalLink size={12}/></a></div>
        <div className="flex shrink-0 flex-wrap items-center gap-2"><button type="button" onClick={() => onUseWallet(item)} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-ink hover:border-accent">Check address</button><button type="button" onClick={() => acknowledge(item.id)} className="rounded-xl bg-accent/10 px-3 py-2 text-xs font-semibold text-accent" aria-label={`Acknowledge ${item.name}`}>Got it</button></div>
      </div>)}
    </div>
    <p className="mt-3 text-xs text-ink-muted">“Got it” clears this notice for this wallet in this browser. No signature needed.</p>
  </section>;
}
