import * as dotenv from "dotenv";
import { createPublicClient, http, formatEther, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
dotenv.config();

const xLayer = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.xlayer.tech"] } },
});

async function main() {
  const client = createPublicClient({ chain: xLayer, transport: http() });

  const USDT = "0x779ded0c9e1022225f8e0630b35a9b54be713736";

  const agenticWallet = process.env.AGENTIC_WALLET_ADDRESS ?? "";
  const pk = process.env.TEST_PAYER_PRIVATE_KEY ?? "";
  const payerAccount = privateKeyToAccount(pk as `0x${string}`);

  console.log("=== Agentic Wallet ===");
  console.log("Address:", agenticWallet);
  const bal1 = await client.getBalance({ address: agenticWallet as `0x${string}` });
  console.log("OKB:", formatEther(bal1));
  const usdt1 = await client.readContract({
    address: USDT as `0x${string}`,
    abi: [{ constant: true, inputs: [{ name: "_owner", type: "address" }], name: "balanceOf", outputs: [{ name: "balance", type: "uint256" }], type: "function" }],
    functionName: "balanceOf",
    args: [agenticWallet],
  });
  console.log("USDT:", formatUnits(usdt1 as bigint, 6));

  console.log("\n=== Test Payer Wallet ===");
  console.log("Address:", payerAccount.address);
  const bal2 = await client.getBalance({ address: payerAccount.address });
  console.log("OKB:", formatEther(bal2));
  const usdt2 = await client.readContract({
    address: USDT as `0x${string}`,
    abi: [{ constant: true, inputs: [{ name: "_owner", type: "address" }], name: "balanceOf", outputs: [{ name: "balance", type: "uint256" }], type: "function" }],
    functionName: "balanceOf",
    args: [payerAccount.address],
  });
  console.log("USDT:", formatUnits(usdt2 as bigint, 6));
}

main().catch((e) => { console.error(e); process.exit(1); });
