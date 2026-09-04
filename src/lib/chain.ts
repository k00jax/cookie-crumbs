// On-chain helpers against rpc.cookiescan.io via @solana/web3.js v1.
// Native COOK = lamports (So1111… native-mint convention on Cookie Chain, 9 decimals).

import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import { COMMITMENT, COOK_DECIMALS, RPC_URL, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "./constants";

export function makeConnection(): Connection {
  return new Connection(RPC_URL, COMMITMENT);
}

export interface TokenBalanceRow {
  mint: string;
  symbol: string | null;
  /** UI amount */
  amount: number;
  decimals: number;
  /** null when the mint has no registry price */
  usd: number | null;
}

export interface WalletPortfolio {
  address: string;
  /** native COOK balance (lamports / 1e9) */
  cook: number;
  /** USD value of COOK, given cookUsd (null when no price) */
  cookUsd: number | null;
  tokens: TokenBalanceRow[];
  /** USD value of all tokens; null when nothing could be priced */
  tokensUsd: number | null;
  totalUsd: number | null;
}

interface ParsedInfo {
  mint?: string;
  tokenAmount?: { amount: string; decimals: number; uiAmount: number | null };
}

/**
 * Read native COOK + SPL/Token-2022 balances for a wallet and enrich with registry symbols/prices.
 * registry: mint → { symbol, usd } map built once from /api/tokens (see indexRegistry).
 */
export async function readPortfolio(
  connection: Connection,
  owner: PublicKey,
  registry: Map<string, { symbol: string; usd: number }>,
): Promise<WalletPortfolio> {
  const lamports = await connection.getBalance(owner, COMMITMENT);

  const [spl, t22] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(owner, { programId: new PublicKey(TOKEN_PROGRAM_ID) }, COMMITMENT),
    connection.getParsedTokenAccountsByOwner(owner, { programId: new PublicKey(TOKEN_2022_PROGRAM_ID) }, COMMITMENT),
  ]);

  const rows: TokenBalanceRow[] = [];
  for (const { account } of [...spl.value, ...t22.value]) {
    const info = (account.data as { parsed?: { info?: ParsedInfo } }).parsed?.info;
    const mint = info?.mint;
    const ta = info?.tokenAmount;
    if (!mint || !ta) continue;
    if (BigInt(ta.amount) === 0n) continue;
    // Native mint may also appear as an SPL "wCOOK" account — keep it as a token row too.
    const meta = registry.get(mint);
    rows.push({
      mint,
      symbol: meta?.symbol ?? null,
      amount: ta.uiAmount ?? Number(ta.amount) / 10 ** ta.decimals,
      decimals: ta.decimals,
      usd: meta && Number.isFinite(meta.usd) ? (ta.uiAmount ?? 0) * meta.usd : null,
    });
  }
  rows.sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));

  const cook = lamports / LAMPORTS_PER_SOL;
  const cookMeta = registry.get("So11111111111111111111111111111111111111112");
  const cookUsd = cookMeta && Number.isFinite(cookMeta.usd) ? cook * cookMeta.usd : null;
  const tokensUsd = rows.some((r) => r.usd !== null)
    ? rows.reduce((s, r) => s + (r.usd ?? 0), 0)
    : null;
  const priced = [cookUsd, tokensUsd].some((v) => v !== null);
  const totalUsd = priced
    ? (cookUsd ?? 0) + (tokensUsd ?? 0)
    : null;

  return { address: owner.toBase58(), cook, cookUsd, tokens: rows, tokensUsd, totalUsd };
}

export function cookUsdFromStatus(status: { cookUsd: number } | null | undefined): number | null {
  const v = status?.cookUsd;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

/** Registry symbol/price fallback when the big /api/tokens fetch is not wanted: price COOK from /api/status. */
export function uiCook(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: COOK_DECIMALS });
}
