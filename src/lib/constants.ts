// CRUMBS — Cookie Chain market terminal. Chain/endpoint constants.
// All values verified live against Cookie Chain (2026-09-04). See docs/evidence.md.

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL?.trim() || "https://rpc.cookiescan.io";
// REAL WebSocket endpoint = Solana JSON-RPC pubsub on the RPC host (verified: slotSubscribe works).
// NOTE: the docs-era "wss://wss.cookiescan.io/stream" host is BROKEN — its vhost 301-redirects to
// bakedbazaar.art with a bakedbazaar cert. Never use it. See docs/evidence.md §WS.
export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL?.trim() || "wss://rpc.cookiescan.io";
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim() || "https://api.cookiescan.io";
export const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL?.trim() || "https://cookiescan.io";
export const BRIDGE_URL = "https://bridge.cookiescan.io";
export const NIGHTLY_URL = "https://nightly.app";

export const COMMITMENT = "confirmed" as const;

// --- COOK mint decision (evidence in docs/evidence.md §COOK mint) ---
// On Cookie Chain the NATIVE coin lives at Solana's NATIVE_MINT string (So1111…1112), a real
// Tokenkeg SPL mint with 9 decimals: lamports ARE COOK. cookie-mcp (reference client) agrees:
// config.ts COOK_MINT = So1111…, COOK_DECIMALS = 9. The registry prices it native=1.
export const COOK_MINT = "So11111111111111111111111111111111111111112";
export const COOK_DECIMALS = 9;
export const COOK_SYMBOL = "COOK";
export const WCOOK_SYMBOL = "wCOOK"; // registry label for the So1111 mint account

// 36Zr… is the SOLANA-MAINNET side of COOK (sCOOK, Token-2022, 6 dec) used by the Hyperlane warp.
// getAccountInfo(36Zr…) on rpc.cookiescan.io => null: it does NOT exist on Cookie Chain. Display
// only — never used for balances/transfers/swaps on this chain.
export const SPL_COOK_MINT_SOLANA = "36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1";

export const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export const POLL_STATUS_MS = 5_000; // /api/status (198 B — cheap live heartbeat + COOK price)
export const POLL_TRENDING_MS = 10_000; // /v1/assets/trending
export const POLL_DETAIL_MS = 5_000; // /api/price/:mint while a token is selected (price history)
export const POLL_MARKETS_MS = 20_000; // /api/markets/:mint

export function explorerTxUrl(sig: string) {
  return `${EXPLORER_URL}/tx/${sig}`;
}
export function explorerAddressUrl(addr: string) {
  return `${EXPLORER_URL}/address/${addr}`;
}
export function explorerTokenUrl(mint: string) {
  return `${EXPLORER_URL}/token/${mint}`;
}
