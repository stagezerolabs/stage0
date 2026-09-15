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
 const open=vi.fn();render(<MemoryRouter><IncomingNamesNotice onUseWallet={open}/></MemoryRouter>);
 expect(env.ack).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"Check address"}));expect(open).toHaveBeenCalledWith(env.unread[0]);expect(env.ack).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"Acknowledge alice.rise"}));expect(env.ack).toHaveBeenCalledWith("tx:1");
 expect(screen.getByRole("link",{name:"View transfer"}).getAttribute("href")).toBe("https://explorer.risechain.com/tx/0xabcd");
});
