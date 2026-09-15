import {act,cleanup,renderHook,waitFor} from "@testing-library/react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import type {ReactNode} from "react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {useRnsIncomingTransfers} from "./useRnsIncomingTransfers";
import {acknowledgeIncomingTransfer} from "@/lib/rns/incoming-notices";
const env=vi.hoisted(()=>({wallet:{address:"0x1111111111111111111111111111111111111111",isConnected:true},fetch:vi.fn(),toast:vi.fn()}));
vi.mock("wagmi",()=>({useAccount:()=>env.wallet}));
vi.mock("@/config",()=>({riseMainnet:{id:4153}}));
vi.mock("@/lib/api/rns",()=>({fetchRnsIncomingTransfers:env.fetch}));
vi.mock("sonner",()=>({toast:{error:env.toast}}));
let client:QueryClient;
const wallet="0x1111111111111111111111111111111111111111";
const item={id:"4153:registry:tx1:0",node:"0x1234",label:"alice",name:"alice.rise",transactionHash:"0xabcd",blockNumber:"100"};
function wrapper({children}:{children:ReactNode}){return <QueryClientProvider client={client}>{children}</QueryClientProvider>;}
beforeEach(()=>{vi.resetAllMocks();localStorage.clear();env.wallet={address:wallet,isConnected:true};env.fetch.mockResolvedValue([item]);client=new QueryClient({defaultOptions:{queries:{retry:false}}});});
afterEach(()=>{cleanup();client.clear();});

it("finds an incoming transfer on the first visit without prior browser history",async()=>{
 const {result}=renderHook(useRnsIncomingTransfers,{wrapper});
 await waitFor(()=>expect(result.current.unread).toHaveLength(1));
 expect(env.fetch).toHaveBeenCalledWith(wallet,4153);
});
it("acknowledgement clears all mounted consumers and survives remount",async()=>{
 const a=renderHook(useRnsIncomingTransfers,{wrapper});const b=renderHook(useRnsIncomingTransfers,{wrapper});
 await waitFor(()=>expect(a.result.current.unread).toHaveLength(1));
 act(()=>a.result.current.acknowledge(item.id));
 expect(a.result.current.unread).toHaveLength(0);expect(b.result.current.unread).toHaveLength(0);
 a.unmount();b.unmount();
 const c=renderHook(useRnsIncomingTransfers,{wrapper});
 expect(c.result.current.unread).toHaveLength(0);
});
it("a second transfer of the same name produces a new unread notice",async()=>{
 const {result}=renderHook(useRnsIncomingTransfers,{wrapper});
 await waitFor(()=>expect(result.current.unread).toHaveLength(1));
 act(()=>result.current.acknowledge(item.id));
 env.fetch.mockResolvedValue([{...item,id:"4153:registry:tx2:0"}]);
 await act(()=>result.current.refetch());
 await waitFor(()=>expect(result.current.unread[0]?.id).toBe("4153:registry:tx2:0"));
});
it("keeps acknowledgements scoped to the wallet and chain",async()=>{
 acknowledgeIncomingTransfer(11155931,wallet,item.id);
 acknowledgeIncomingTransfer(4153,"0x2222222222222222222222222222222222222222",item.id);
 const {result}=renderHook(useRnsIncomingTransfers,{wrapper});
 await waitFor(()=>expect(result.current.unread).toHaveLength(1));
});
it("does not leak the previous wallet's notices when switching accounts",async()=>{
 const {result,rerender}=renderHook(useRnsIncomingTransfers,{wrapper});
 await waitFor(()=>expect(result.current.unread).toHaveLength(1));
 env.wallet={address:"0x2222222222222222222222222222222222222222",isConnected:true};env.fetch.mockResolvedValue([]);rerender();
 expect(result.current.unread).toHaveLength(0);
 await waitFor(()=>expect(result.current.isSuccess).toBe(true));
 expect(result.current.unread).toHaveLength(0);
});
it("does not query when disconnected",()=>{
 env.wallet.isConnected=false;
 const {result}=renderHook(useRnsIncomingTransfers,{wrapper});
 expect(env.fetch).not.toHaveBeenCalled();expect(result.current.unread).toHaveLength(0);
});
it("malformed saved state does not hide legitimate incoming names",async()=>{
 localStorage.setItem(`rns_incoming_ack_v1:4153:${wallet}`,"broken");
 const {result}=renderHook(useRnsIncomingTransfers,{wrapper});
 await waitFor(()=>expect(result.current.unread).toHaveLength(1));
});
it("does not claim acknowledgement if browser storage fails",async()=>{
 const {result}=renderHook(useRnsIncomingTransfers,{wrapper});
 await waitFor(()=>expect(result.current.unread).toHaveLength(1));
 const storage=vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error("denied");});
 act(()=>result.current.acknowledge(item.id));
 expect(result.current.unread).toHaveLength(1);expect(env.toast).toHaveBeenCalledOnce();storage.mockRestore();
});
