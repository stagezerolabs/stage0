import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import Header from "./Header";
import type {ReactNode} from "react";
const env=vi.hoisted(()=>({connected:false,unread:[] as {id:string}[]}));
vi.mock("wagmi",()=>({useAccount:()=>({isConnected:env.connected,address:env.connected?"0x1111111111111111111111111111111111111111":undefined}),useConnect:()=>({connect:()=>{}}),useConnectors:()=>[]}));
vi.mock("@/config",()=>({RISE_CONNECTOR_ID:"rise",riseMainnet:{id:4153}}));
vi.mock("@/lib/utils/admin",()=>({useIsAdmin:()=>({isAdmin:false})}));
vi.mock("@/lib/hooks/useUserDomain",()=>({useUserDomain:()=>({displayName:null})}));
vi.mock("@/lib/hooks/useRiseNetworkSwitch",()=>({useRiseNetworkSwitch:()=>({switchToRise:async()=>{}})}));
vi.mock("@/lib/hooks/rns/useRnsIncomingTransfers",()=>({useRnsIncomingTransfers:()=>({unread:env.unread})}));
vi.mock("@rainbow-me/rainbowkit",()=>({ConnectButton:{Custom:({children}:{children:(props:unknown)=>ReactNode})=>children({mounted:true,account:null,chain:null,openConnectModal:()=>{},openChainModal:()=>{},openAccountModal:()=>{}})}}));
beforeEach(()=>{env.connected=false;env.unread=[];});
afterEach(cleanup);
const tree=()=> <MemoryRouter><Header themeMode="dark" onToggleTheme={()=>{}}/></MemoryRouter>;
it.each([false,true])("Bridge is available in desktop and mobile navigation (connected=%s)",(connected)=>{
 env.connected=connected;render(tree());
 const bridge=screen.getByRole("link",{name:/^Bridge/});expect(bridge.getAttribute("href")).toBe("https://portal.risechain.com/bridge");expect(bridge.getAttribute("rel")).toContain("noopener");expect(bridge.getAttribute("target")).toBe("_blank");
 fireEvent.click(screen.getByRole("button",{name:"Toggle menu"}));expect(screen.getAllByRole("link",{name:/^Bridge/})).toHaveLength(2);
});
it.each([false,true])("NFT Marketplace is available in desktop and mobile navigation (connected=%s)",(connected)=>{
 env.connected=connected;render(tree());
 expect(screen.getByRole("link",{name:"NFT Marketplace"}).getAttribute("href")).toBe("/nft-marketplace");
 fireEvent.click(screen.getByRole("button",{name:"Toggle menu"}));
 expect(screen.getAllByRole("link",{name:"NFT Marketplace"})).toHaveLength(2);
});
it("shows an unread dot and directs users to received names, then removes it after acknowledgement",async()=>{
 env.connected=true;env.unread=[{id:"transfer-1"}];const view=render(tree());
 expect(screen.getByRole("img",{name:"1 unread received names"})).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:/Names/}));
 expect(screen.getByRole("menuitem",{name:/Received names/}).getAttribute("href")).toBe("/domains#incoming-names");
 env.unread=[];view.rerender(tree());
 await waitFor(()=>expect(screen.queryByRole("img",{name:/unread received names/})).toBeNull());
});
