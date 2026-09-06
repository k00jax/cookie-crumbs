# CHIP — Cookie Chain Market Terminal 🍪

Live analytics terminal + portfolio tracker for [Cookie Chain](https://cookiescan.io) (independent
SVM/Agave). Real-time market heatmap, token detail with rolling price history, pool explorer, live
Cookiebox swap quotes, and a connected-wallet portfolio.

**Status: LIVE at [https://chip.fonger.ai](https://chip.fonger.ai)** — submitted to the Cookie Chain
cApp bounty (Superteam Earn, 1,000 USDC pool, deadline 2026-09-22). Every transaction is
user-initiated; nothing auto-signs; no keys server-side.

> Engineered by the Trivance Council (dev-3 agent) for k00jax.

## Bounty rubric coverage

| Requirement | Where |
| --- | --- |
| Connect a wallet (Nightly required) | `src/components/WalletProvider.tsx` — Nightly adapter + Wallet-Standard auto-detect (MetaMask also works) |
| Display connected wallet address | Portfolio header, expandable full address + cookiescan explorer link |
| Read on-chain balances | `getBalance` (native COOK) + `getParsedTokenAccountsByOwner` (SPL + Token-2022), registry-enriched USD |
| Transaction execution | Swap pipeline wired: Cookiebox quote → build unsigned v0 tx → wallet `sendTransaction` → confirm (`blockhash`/`lastValidBlockHeight`) → explorer link. Executes when the wallet holds COOK (gas); no faucet exists on Cookie Chain — see `docs/qa-demo.md` |
| Transaction confirmation handling | `confirmTransaction("confirmed")` + status states (building → signing → confirming → done/error) with explorer link |
| Error handling + user feedback | No-route / quote error / insufficient-balance / reject states, error boundary (`app/error.tsx`), skeletons + retry everywhere |
| Analytics, charts, dashboards | Heatmap (trending + curated), token detail w/ rolling recharts chart, pools explorer w/ liquidity-by-venue chart |
| Use Cookie Chain programs/APIs | api.cookiescan.io (REST + DAS-style feeds), rpc.cookiescan.io pubsub ticker, Cookiebox aggregator (agg.cookiebox.app), recipe from cookie-mcp (MIT) |
| Live data / activity | WS slotSubscribe ticker + 5 s REST polls |
| Deployed + publicly accessible | https://chip.fonger.ai (Cloudflare tunnel → ODROID static export) |
| Open source + README | This repo, MIT license |
| X thread demo + bridge guide | https://x.com/blackf1re/status/2096708732902093125 (bridge guide in post 5) |

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Optional env (`next.config` reads `NEXT_PUBLIC_*`; all values default to live Cookie Chain endpoints):

| Var | Default |
| --- | --- |
| `NEXT_PUBLIC_RPC_URL` | `https://rpc.cookiescan.io` |
| `NEXT_PUBLIC_WS_URL` | `wss://rpc.cookiescan.io` |
| `NEXT_PUBLIC_API_URL` | `https://api.cookiescan.io` |
| `NEXT_PUBLIC_EXPLORER_URL` | `https://cookiescan.io` |

## What's in this build (D0–D7)

- **D0 environment**: Node 26 verified; RPC/WS/API endpoints live-probed; api.cookiescan.io CORS
  verified open (echo `access-control-allow-origin`, preflight 204); cookie-mcp (MIT reference
  client) cloned at `../cookie-mcp`; aggregator swap recipe located (see below).
- **Wallet**: `@solana/wallet-adapter-react` + `-react-ui` + Nightly (`0.1.20`), ConnectionProvider
  → `rpc.cookiescan.io`, commitment `confirmed`. Connect/disconnect shows address + native COOK
  balance (`getBalance` = lamports) + SPL/Token-2022 positions via `getTokenAccountsByOwner`,
  enriched with registry symbols/prices.
- **"Set up Nightly" modal**: exact network values (RPC/WS/symbol/decimals/explorer/bridge) with
  copy buttons, plus a warning that the legacy `wss://wss.cookiescan.io` host is dead.
- **Data**: typed fetchers for `/api/status`, `/api/cook`, `/api/tokens(+search)`, `/api/price/:mint`,
  `/api/markets`, `/api/markets/:mint`, `/v1/assets/trending`, `/v1/assets/search`,
  `/v1/assets/curated?list=…`, `/v1/assets` — all mapped from live responses.
- **Live ticker**: Solana pubsub `slotSubscribe` on `wss://rpc.cookiescan.io` with auto-reconnect
  (exp backoff, sub replay, 45 s re-probe after give-up) + 5 s REST fallback heartbeat. Degraded
  mode is surfaced in the UI, never silent.
- **Dashboard grid**: token heatmap (trending + curated majors/lsts/memes, colored by 24h change),
  token detail (stats grid, recharts price history from 5 s polls, top pools), wallet portfolio.
  Loading skeletons / error-with-retry / empty states throughout.

## COOK mint decision (short)

**Native COOK on Cookie Chain = `So11111111111111111111111111111111111111112`** (9 decimals;
lamports *are* COOK; registry prices it `native: 1`). **`36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1`
does NOT exist on Cookie Chain** (RPC `getAccountInfo` → null) — it is the Solana-mainnet sCOOK
mint (Token-2022, 6 dp) used by the Hyperlane warp. The explorer APIs report it as COOK&apos;s
canonical label in `/api/cook` + `/api/status`, but every on-chain surface (registry, markets,
v1-assets) keys COOK by the So1111 mint. Evidence + full reasoning: `docs/evidence.md`.

## Swap recipe for the next phase (from cookie-mcp, MIT)

- Aggregator: **Cookiebox** `https://agg.cookiebox.app`
  - `GET /quote?inputMint&outputMint&amount&slippageBps[&owner]` → `{ route: AggQuote }`
  - `POST /swap-tx` `{inputMint, outputMint, amount, slippageBps, owner}` → `{ transactionBase64,
    blockhash, lastValidBlockHeight, route }` (unsigned **v0** tx; server re-quotes + simulates; may
    lazily extend a lookup table — allow 60 s)
  - Flow: quote → build → simulate on own RPC → sign locally → sendRawTransaction → confirm with
    `{blockhash, lastValidBlockHeight}` → explorer link `https://cookiescan.io/tx/<sig>`
- Reference source: `cookie-mcp/src/core/cookiebox.ts`, `src/core/trade.ts`,
  `src/core/transfer.ts`, `src/core/confirm.ts`, `src/core/balances.ts`
  (repo: https://github.com/cookiechain/cookie-mcp, MIT, v0.4.0)
- Fallback guaranteed-tx path: native COOK transfer = `SystemProgram.transfer` (lamports).

## Architecture notes

- Client-only data (all APIs CORS-open, no keys server-side) → static-export deployable later.
- Wallet reads: `getBalance` + `getParsedTokenAccountsByOwner` for Tokenkeg **and** Token-2022,
  joined against the once-per-session `/api/tokens` registry index.
- Poll cadence: status 5 s · trending 10 s · detail price 5 s · pools 20 s · universe 30 s.

## Roadmap (later phases)

- **D4–D6**: full analytics (pools explorer, volume curves), portfolio PnL, WS account/logs subs.
- **D7–D8**: one-click Cookiebox swap + native transfer with confirmations + error surfacing.
- **D9–D10**: AI insights pane (DeepSeek over fetched data, tap-to-execute only), polish, demo,
  public deploy + submission.
