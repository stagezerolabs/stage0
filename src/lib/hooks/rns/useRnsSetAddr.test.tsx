import {renderHook,cleanup} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import {decodeFunctionData,encodeFunctionData,type Address} from "viem";
import {useRnsSetAddr} from "./useRnsActions";
import {RNSResolver} from "@/lib/contracts/generatedAbis";
import {rnsNamehash} from "@/lib/rns/utils";
const env=vi.hoisted(()=>({write:vi.fn(),tracked:vi.fn(),resolver:"0x1111111111111111111111111111111111111111" as Address}));
vi.mock("./useRnsContracts",()=>({useRnsContracts:()=>({resolver:env.resolver})}));
vi.mock("@/lib/hooks/useTrackedWriteContract",()=>({useTrackedWriteContract:(options:unknown)=>{env.tracked(options);return {writeContract:env.write};}}));
afterEach(cleanup);
it("submits only setAddr using the generated ABI, pinned wallet and chain",()=>{
 const wallet="0x2222222222222222222222222222222222222222" as Address;
 const {result}=renderHook(()=>useRnsSetAddr("Alice.rise",env.resolver,{chainId:4153,account:wallet}));
 result.current.setAddr({addr:wallet});
 expect(env.write).toHaveBeenCalledExactlyOnceWith({address:env.resolver,abi:RNSResolver,functionName:"setAddr",args:[rnsNamehash("alice"),wallet],chainId:4153,account:wallet});
 expect(env.tracked).toHaveBeenCalledWith({chainId:4153});
 const data=encodeFunctionData({abi:RNSResolver,functionName:"setAddr",args:[rnsNamehash("alice"),wallet]});
 expect(decodeFunctionData({abi:RNSResolver,data}).functionName).toBe("setAddr");
});
