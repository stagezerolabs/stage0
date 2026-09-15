import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {zeroAddress,type Address,type Hex,type TransactionReceipt} from "viem";
import ResolveNameDialog from "./ResolveNameDialog";
import {rnsNamehash} from "@/lib/rns/utils";
import type {TransferNameSelection} from "./TransferNameDialog";
const env=vi.hoisted(()=>({
 wallet:"0x1111111111111111111111111111111111111111" as Address,
 resolver:"0x2222222222222222222222222222222222222222" as Address,
 other:"0x3333333333333333333333333333333333333333" as Address,
 account:{address:"0x1111111111111111111111111111111111111111" as Address,isConnected:true,chainId:4153},
 owner:"" as Address,resolving:"" as Address,currentResolver:"" as Address,expiry:9999999999n,
 read:vi.fn(),block:vi.fn(),simulate:vi.fn(),getReceipt:vi.fn(),write:vi.fn(),refreshApi:vi.fn(),
 tx:{hash:undefined as Hex|undefined,receipt:undefined as TransactionReceipt|undefined,error:null as Error|null,isConfirming:false},client:{} as Record<string,unknown>,
}));
vi.mock("@/config",()=>({riseMainnet:{id:4153}}));
vi.mock("wagmi",()=>({useAccount:()=>env.account,useConfig:()=>({}),usePublicClient:()=>env.client}));
vi.mock("@wagmi/core",()=>({getAccount:()=>env.account}));
vi.mock("@/lib/hooks/rns/useRnsContracts",()=>({useRnsContracts:()=>({chainId:4153,registry:env.resolver,registrar:env.resolver,resolver:env.resolver,explorerUrl:"https://explorer.risechain.com"})}));
vi.mock("@/lib/hooks/rns/useRnsActions",()=>({useRnsSetAddr:()=>({...env.tx,node:rnsNamehash("alice"),setAddr:env.write,reset:()=>{env.tx.hash=undefined;env.tx.receipt=undefined;env.tx.error=null;}})}));
vi.mock("@/lib/api/rns",()=>({fetchRnsNameResolution:env.refreshApi}));
let client:QueryClient;let updated:ReturnType<typeof vi.fn<() => void>>;let closed:ReturnType<typeof vi.fn<() => void>>;
const hash=`0x${"a".repeat(64)}` as Hex;
beforeEach(()=>{
 vi.resetAllMocks();
 Object.defineProperty(window,"matchMedia",{writable:true,value:()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})});
 env.account={address:env.wallet,isConnected:true,chainId:4153};env.owner=env.wallet;env.resolving=env.other;env.currentResolver=env.resolver;env.expiry=9999999999n;
 env.tx={hash:undefined,receipt:undefined,error:null,isConfirming:false};
 env.block.mockResolvedValue({number:100n,timestamp:1000n});
 env.read.mockImplementation(async({functionName}:{functionName:string})=>functionName==="owner"?env.owner:functionName==="resolver"?env.currentResolver:functionName==="addr"?env.resolving:env.expiry);
 env.simulate.mockResolvedValue({});env.refreshApi.mockResolvedValue({});
 env.client={getBlock:env.block,readContract:env.read,simulateContract:env.simulate,getTransactionReceipt:env.getReceipt};
 client=new QueryClient({defaultOptions:{queries:{retry:false}}});updated=vi.fn();closed=vi.fn();
});
afterEach(()=>{cleanup();client.clear();});
function mount(patch:Partial<TransferNameSelection>={}){
 const selection={label:"alice",node:rnsNamehash("alice"),sender:env.wallet,custody:"wallet" as const,...patch};
 const tree=()=> <QueryClientProvider client={client}><ResolveNameDialog selection={selection} onUpdated={updated} onClose={closed}/></QueryClientProvider>;
 const view=render(tree());return ()=>view.rerender(tree());
}
const button=()=>screen.getByRole("button",{name:"Accept domain"}) as HTMLButtonElement;
async function submit(){await waitFor(()=>expect(button().disabled).toBe(false));fireEvent.click(button());await waitFor(()=>expect(env.write).toHaveBeenCalledOnce());}
const receipt=(status:"success"|"reverted"="success")=>({status,transactionHash:hash,blockNumber:101n} as TransactionReceipt);

it("shows the old and new addresses, simulates, then submits exactly one resolver update",async()=>{
 mount();await submit();
 expect(env.write).toHaveBeenCalledWith({addr:env.wallet});expect(env.simulate).toHaveBeenCalledOnce();
 expect(screen.getByText("A network fee applies. Your domain’s expiry stays the same.")).toBeTruthy();
 expect(screen.queryByText(/Making this your primary name/)).toBeNull();
 expect(screen.getByText("Awaiting wallet confirmation")).toBeTruthy();
 expect(button().disabled).toBe(true);fireEvent.click(button());expect(env.write).toHaveBeenCalledOnce();expect(updated).not.toHaveBeenCalled();
});
it.each(["non-owner","expired","custom resolver","already correct","wrong network","disconnected","escrow","wrong node"])("blocks %s",async(kind)=>{
 let patch:Partial<TransferNameSelection>={};
 if(kind==="non-owner")env.owner=env.other;
 if(kind==="expired")env.expiry=1n;
 if(kind==="custom resolver")env.currentResolver=zeroAddress;
 if(kind==="already correct")env.resolving=env.wallet;
 if(kind==="wrong network")env.account.chainId=1;
 if(kind==="disconnected")env.account.isConnected=false;
 if(kind==="escrow")patch={custody:"marketplace_listing"};
 if(kind==="wrong node")patch={node:rnsNamehash("bob")};
 mount(patch);
 const expected:Record<string,RegExp>={"non-owner":/no longer the registry owner/,"expired":/Renew this name/,"custom resolver":/configured separately/,"already correct":/already points/,"wrong network":/Switch to RISE/,"disconnected":/Connect the wallet/,"escrow":/Cancel the marketplace/,"wrong node":/Cannot verify the resolver/};
 await screen.findByText(expected[kind],{}, {timeout:4000});
 if(kind==="already correct")expect(screen.queryByRole("button",{name:"Accept domain"})).toBeNull();
 else {expect(button().disabled).toBe(true);fireEvent.click(button());}
 expect(env.write).not.toHaveBeenCalled();
});
it("rechecks ownership immediately before submission",async()=>{
 mount();await waitFor(()=>expect(button().disabled).toBe(false));env.owner=env.other;fireEvent.click(button());
 await screen.findByText("This wallet is no longer the registry owner.");expect(env.write).not.toHaveBeenCalled();
});
it("aborts when the wallet changes during simulation",async()=>{
 env.simulate.mockImplementation(async()=>{env.account.address=env.other;return {};});
 mount();await waitFor(()=>expect(button().disabled).toBe(false));fireEvent.click(button());
 await screen.findByText("Your wallet changed. Reopen this dialog.");expect(env.write).not.toHaveBeenCalled();
});
it("a hash alone is not success; verified receipt refreshes API and caches",async()=>{
 const invalidate=vi.spyOn(client,"invalidateQueries");const rerender=mount();await submit();
 env.tx.hash=hash;env.tx.isConfirming=true;rerender();expect(updated).not.toHaveBeenCalled();
 env.tx.receipt=receipt();env.resolving=env.wallet;rerender();
 await screen.findByText("Domain accepted");await waitFor(()=>expect(updated).toHaveBeenCalledOnce());
 expect(env.refreshApi).toHaveBeenCalledWith({name:"alice",chainId:4153});expect(invalidate).toHaveBeenCalled();expect(screen.getByRole("link",{name:"View transaction"}).getAttribute("href")).toContain(hash);
});
it.each(["rejected","reverted"])("does not refresh or claim success for a %s update",async(kind)=>{
 const rerender=mount();await submit();
 if(kind==="rejected")env.tx.error=new Error("Rejected");else {env.tx.hash=hash;env.tx.receipt=receipt("reverted");}
 rerender();await screen.findByText("Update failed or rejected");expect(updated).not.toHaveBeenCalled();expect(env.refreshApi).not.toHaveBeenCalled();
});
it("unverified receipt blocks duplicate submission and permits verification-only retry",async()=>{
 const rerender=mount();await submit();env.tx.hash=hash;env.tx.receipt=receipt();rerender();
 await screen.findByText("Update not yet verified");expect(screen.queryByRole("button",{name:"Accept domain"})).toBeNull();
 env.resolving=env.wallet;fireEvent.click(screen.getByRole("button",{name:"Retry verification"}));
 await screen.findByText("Domain accepted");expect(env.write).toHaveBeenCalledOnce();
});
it("recovers a receipt after RPC polling failure without resubmitting",async()=>{
 const rerender=mount();await submit();env.tx.hash=hash;env.tx.error=new Error("RPC timeout");env.resolving=env.wallet;env.getReceipt.mockResolvedValue(receipt());rerender();
 await screen.findByText("Domain accepted");expect(env.write).toHaveBeenCalledOnce();
});
