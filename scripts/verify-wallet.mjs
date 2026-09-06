// D0 funding/wallet verification helper (NO funds spent, NOTHING stored on disk).
// Usage:  node scripts/verify-wallet.mjs
// - Generates an in-memory throwaway keypair (never persisted)
// - Queries its COOK balance + token accounts against rpc.cookiescan.io
// - Prints the exact commands the wallet owner (Kyle) runs later to fund it.

import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

const RPC = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.cookiescan.io";
const COOK_MINT = "So11111111111111111111111111111111111111112";
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

const kp = Keypair.generate();
const conn = new Connection(RPC, "confirmed");

const bal = await conn.getBalance(kp.publicKey);
const accts = await Promise.all([
  conn.getParsedTokenAccountsByOwner(kp.publicKey, { programId: TOKEN_PROGRAM }, "confirmed"),
  conn.getParsedTokenAccountsByOwner(kp.publicKey, { programId: TOKEN_2022 }, "confirmed"),
]);
const tokenCount = accts[0].value.length + accts[1].value.length;

const ver = await conn.getVersion();
const slot = await conn.getSlot();

console.log("=== CHIP wallet verification (empty throwaway account — no funds) ===");
console.log("RPC        :", RPC, `(version ${JSON.stringify(ver)})`);
console.log("slot       :", slot.toLocaleString());
console.log("keypair    : generated in-memory, NOT persisted");
console.log("address    :", kp.publicKey.toBase58());
console.log("COOK (native, lamports/1e9):", (bal / LAMPORTS_PER_SOL).toFixed(9));
console.log("token accts:", tokenCount, "(expect 0)");
console.log("");

console.log("=== Commands the wallet owner runs later (funding is owner-approved, not spent here) ===");
console.log("1) On Solana mainnet: swap SOL -> sCOOK (Jupiter), sCOOK mint = 36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1 (Token-2022, 6 dp)");
console.log("2) Bridge 1:1 at https://bridge.cookiescan.io  (community 6/10 multisig Hyperlane warp)");
console.log("3) Verify on Cookie Chain with the 'cookie' CLI (cookiechain/cookie-cli):");
console.log("     cookie config set --url https://rpc.cookiescan.io");
console.log("     cookie-keygen new --outfile ~/.config/cookie/id.json   # real funded wallet");
console.log("     cookie address");
console.log("     cookie balance");
console.log("   NOTE: cookie CLI needs glibc >= 2.32 — the ODROID dev box runs glibc 2.31, so run it on");
console.log("   an x86_64/glibc>=2.32 machine or in the browser wallet; the app itself needs no CLI.");
console.log("");
console.log("Gas on Cookie Chain is paid in COOK (native = So1111...1112 mint, 9 dp). Keep ~$20-30 total.");
