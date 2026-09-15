import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import IncomingNamesNotice from "./IncomingNamesNotice";
const env=vi.hoisted(()=>({ack:vi.fn(),unread:[{id:"tx:1",label:"alice",node:"0x1234",name:"alice.rise",transactionHash:"0xabcd",blockNumber:"100"}]}));
vi.mock("@/config",()=>({riseMainnet:{id:4153},getExplorerUrl:()=>"https://explorer.risechain.com"}));
vi.mock("@/lib/hooks/rns/useRnsIncomingTransfers",()=>({useRnsIncomingTransfers:()=>({unread:env.unread,acknowledge:env.ack})}));
afterEach(cleanup);
beforeEach(()=>{env.ack.mockClear();});
it("does not acknowledge merely viewing or checking a name; Got it explicitly dismisses",()=>{
 const open=vi.fn();render(<MemoryRouter><IncomingNamesNotice needsWalletAddressUpdate={new Set(["0x1234"])} onUseWallet={open}/></MemoryRouter>);
 expect(env.ack).not.toHaveBeenCalled();
 expect(screen.queryByText(/clears this notice for this wallet/)).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Accept domain"}));expect(open).toHaveBeenCalledWith(env.unread[0]);expect(env.ack).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"Acknowledge alice.rise"}));expect(env.ack).toHaveBeenCalledWith("tx:1");
 expect(screen.getByRole("link",{name:"View transfer"}).getAttribute("href")).toBe("https://explorer.risechain.com/tx/0xabcd");
});
it("keeps the receipt and acknowledgement but hides unnecessary address actions",()=>{
 const open=vi.fn();const tree=(needed:ReadonlySet<string>)=><MemoryRouter><IncomingNamesNotice needsWalletAddressUpdate={needed} onUseWallet={open}/></MemoryRouter>;
 const view=render(tree(new Set()));
 expect(screen.queryByRole("button",{name:"Accept domain"})).toBeNull();
 expect(screen.getByRole("button",{name:"Acknowledge alice.rise"})).toBeTruthy();
 view.rerender(tree(new Set(["0x1234"])));
 expect(screen.getByRole("button",{name:"Accept domain"})).toBeTruthy();
 view.rerender(tree(new Set()));
 expect(screen.queryByRole("button",{name:"Accept domain"})).toBeNull();
 expect(env.ack).not.toHaveBeenCalled();expect(open).not.toHaveBeenCalled();
});
