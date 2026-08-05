import * as dotenv from "dotenv";
import { createPublicClient, createWalletClient, http, defineChain, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
dotenv.config();

const xLayer = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.xlayer.tech"] } },
});

const USDT = "0x779ded0c9e1022225f8e0630b35a9b54be713736" as const;
const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

const [, , toArg, amtArg, pkEnv] = process.argv;
if (!toArg || !amtArg) { console.error("usage: transfer-usdt.ts <to> <amount> [pk_env_var]"); process.exit(1); }

const pk = (process.env[pkEnv ?? "TEST_PAYER_PRIVATE_KEY"] ?? "") as `0x${string}`;
if (!pk) { console.error("missing private key env"); process.exit(1); }

const account = privateKeyToAccount(pk);
const pub = createPublicClient({ chain: xLayer, transport: http() });
const wallet = createWalletClient({ account, chain: xLayer, transport: http() });

async function main() {
  const amt = BigInt(Math.round(Number(amtArg) * 1e6));
  const bal = await pub.readContract({ address: USDT, abi: ERC20_ABI, functionName: "balanceOf", args: [account.address] });
  console.log(`from ${account.address} usdt=${formatUnits(bal, 6)} → ${toArg} ${amtArg}`);

  const hash = await wallet.writeContract({
    address: USDT,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [toArg as `0x${string}`, amt],
    gasPrice: 0n,
    gas: 100000n,
  });
  console.log("tx:", hash);
  await pub.waitForTransactionReceipt({ hash });
  const bal2 = await pub.readContract({ address: USDT, abi: ERC20_ABI, functionName: "balanceOf", args: [account.address] });
  console.log(`done. from usdt=${formatUnits(bal2, 6)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
