export const INCOMING_ACK_EVENT = "rns_incoming_acknowledged";
const key = (chainId: number, address: string) => `rns_incoming_ack_v1:${chainId}:${address.toLowerCase()}`;

export function incomingAckSnapshot(chainId: number, address?: string): string {
  if (!address) return "";
  try { return localStorage.getItem(key(chainId,address)) ?? ""; } catch { return ""; }
}
export function acknowledgedTransferIds(snapshot: string): Set<string> {
  try { const value: unknown = JSON.parse(snapshot); return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []); }
  catch { return new Set(); }
}
export function acknowledgeIncomingTransfer(chainId: number, address: string, id: string): boolean {
  try {
    const ids = acknowledgedTransferIds(incomingAckSnapshot(chainId,address));
    ids.add(id);
    localStorage.setItem(key(chainId,address),JSON.stringify([...ids]));
    window.dispatchEvent(new Event(INCOMING_ACK_EVENT));
    return true;
  } catch { return false; }
}
export function subscribeToIncomingAcknowledgements(callback: () => void) {
  window.addEventListener(INCOMING_ACK_EVENT,callback);
  window.addEventListener("storage",callback);
  return () => { window.removeEventListener(INCOMING_ACK_EVENT,callback); window.removeEventListener("storage",callback); };
}
