import { useMemo, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { riseMainnet } from "@/config";
import { fetchRnsIncomingTransfers } from "@/lib/api/rns";
import { acknowledgeIncomingTransfer, acknowledgedTransferIds, incomingAckSnapshot, subscribeToIncomingAcknowledgements } from "@/lib/rns/incoming-notices";
import { toast } from "sonner";

export function useRnsIncomingTransfers() {
  const { address, isConnected } = useAccount();
  const snapshot = useSyncExternalStore(subscribeToIncomingAcknowledgements, () => incomingAckSnapshot(riseMainnet.id,address), () => "");
  const query = useQuery({
    queryKey: ["rns","incoming",riseMainnet.id,address?.toLowerCase()],
    queryFn: () => fetchRnsIncomingTransfers(address!,riseMainnet.id),
    enabled: isConnected && Boolean(address), staleTime: 15_000, refetchInterval: 30_000, retry: 1,
  });
  const unread = useMemo(() => {
    const acknowledged = acknowledgedTransferIds(snapshot);
    return isConnected ? (query.data ?? []).filter(item => !acknowledged.has(item.id)) : [];
  }, [snapshot, query.data, isConnected]);
  return { ...query, unread, acknowledge: (id: string) => {
    if (address && unread.some(item => item.id === id) && !acknowledgeIncomingTransfer(riseMainnet.id,address,id)) toast.error("Your browser could not remember this acknowledgement. Please enable site storage.");
  } };
}
