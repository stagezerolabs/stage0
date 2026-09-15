import {expect,it} from "vitest";
import {zeroAddress,type Address} from "viem";
import {resolverUpdateBlockReason} from "./resolver-update";
const wallet="0x1111111111111111111111111111111111111111" as Address;
const resolver="0x2222222222222222222222222222222222222222" as Address;
const valid={connected:true,supportedChain:true,wallet,owner:wallet,custody:"wallet" as const,expiry:9999999999n,now:100n,resolver,expectedResolver:resolver,resolvedAddress:zeroAddress};
it("allows an unexpired name owned directly by the connected wallet",()=>expect(resolverUpdateBlockReason(valid)).toBeNull());
it.each([
  [{connected:false},"Connect"], [{supportedChain:false},"Switch"], [{wallet:zeroAddress},"Connect"],
  [{owner:resolver},"no longer"], [{custody:"marketplace_listing" as const},"Cancel"],
  [{expiry:100n},"Renew"], [{resolver:zeroAddress},"configured separately"],
  [{resolvedAddress:wallet},"already points"], [{owner:undefined},"Checking"],
])("blocks unsafe/redundant update case %#",(patch,reason)=>expect(resolverUpdateBlockReason({...valid,...patch})).toContain(reason));
