# D0 evidence — CRUMBS (verified live 2026-09-04 on the ODROID dev box)

Raw response captures: `/home/odroid/cookie-recon/*.json` (status.json, cook.json, tokens.json,
markets.json, trending.json, search_cook.json, search_a.json, search_crumbs.json) and
`/home/odroid/cookie-recon/docs/`.

## 1. Environment

| Item | Result |
| --- | --- |
| Node | v26.7.0 (≥22 ✓) |
| npm | 11.19.0 |
| OS | Ubuntu 20.04-class (aarch64, **glibc 2.31**) |
| solana CLI | **Not installable on this host**: anza/agave releases (v1.18.26 → v4.2.2 latest) ship no
  `aarch64-unknown-linux-gnu` assets; `release.solana.com` is retired (TLS failure). Cookie Chain's
  own `cookie` CLI (`cookiechain/cookie-cli` v1.0.4) **does** ship arm64-linux, but its binaries
  require **glibc ≥ 2.32** → cannot execute here. → All on-chain verification done with
  `@solana/web3.js` (pure JS), which is what the app uses anyway. |
| cookie-mcp | Cloned `/home/odroid/cookie-mcp` (v0.4.0, MIT). Swap recipe: §4. |
| RPC | `https://rpc.cookiescan.io` live: solana-core **4.1.2**, slot ≈ 23.25M |
| WS | `wss://rpc.cookiescan.io` live: `slotSubscribe` → sub id 39941 in ~1.2 s (§WS) |

## 2. CORS verdict (api.cookiescan.io) — **OPEN for every endpoint**

GET with `Origin: http://localhost:3000` on `/api/status /api/cook /api/tokens /api/markets
/v1/assets/trending /v1/assets/search` → HTTP 200 + `access-control-allow-origin: http://localhost:3000`
(server mirrors the Origin). OPTIONS preflight → `204`, `access-control-allow-methods: GET,POST,OPTIONS`,
`allow-headers: Content-Type`, `max-age: 3600`. Client-side fetch works with no proxy.

## 3. Endpoint shapes (typed in `src/lib/types.ts`)

- `/api/status` → `{status, cookUsd, cookMint, activeTokens, totalTokens, metadataCached, timestamp}` (~200 B)
- `/api/cook` → `{success, data:{mint, name:"COOKIE", symbol:"COOK", priceUsd, lastUpdated}}`
- `/api/tokens` → `{success, cookUsd, count:6470, data:[{mint, metadata:{name,symbol,logo,decimals,description,updateAuthority}, price:{usd,native,change24h}, marketData:{volume24h,volumeChange24h,liquidity,marketCap,supply,holderCount}, lastUpdated}]}` (**~4 MB** — fetch once)
- `/api/tokens/search?q=` → same envelope, filtered
- `/api/price/:mint` → `{success, data:{mint, metadata, price:{usd,native,change24h}, marketData, lastUpdated}}` (also accepts `cook`)
- `/api/markets` → `{success, cookUsd, marketCount:160, markets:[{marketId,type(venue),baseToken:{mint,symbol,amount,priceUsd},quoteToken{…},liquidityUsd,liquidityDisplay}]}`
- `/api/markets/:mintOrSymbol` → `{success, mint, resolvedAs:"mint"|"symbol", symbol, name, cookUsd, marketCount, markets:[…]}` (So1111 → 144 pools)
- `/v1/assets/trending` → `{count, trending:[Asset]}` — **variable**: one probe returned `count:0`, moments later `count:3` (rank 1 = cookie-monster MON). Treat as possibly-empty window.
- `/v1/assets/search?q=` → `{query, count, results:[Asset], denylisted}`
- `/v1/assets/curated?list=majors|lsts|memes` → `{listId, name, count, assets:[Asset]}` (majors=5)
- `/v1/assets?limit&offset&sort` → `{total:6468, limit, offset, sort, assets:[Asset]}`
- `Asset` = `{assetId, name, symbol, category, curated, imageUrl, description, links, liquidityTier, lists, stats:{price, priceInCook, liquidity, volume24hUSD, marketCap, priceChange24hPercent, holder, supply}, variantCount, primaryVariant:{variantId, mint, symbol, name, kind, tags, market:{source,price,priceInCook,liquidity,volume24hUSD,volumeChange24hPercent,marketCap,priceChange24hPercent,supply,holder,decimals,logoURI,poolCount,lastFetchedAt}}}`

## 4. Swap recipe to reuse (from cookie-mcp src, MIT) + key files

Aggregator **Cookiebox** (`https://agg.cookiebox.app`, from `cookie-mcp/src/core/config.ts`):

- `GET /quote?inputMint&outputMint&amount&slippageBps[&owner]` → `{route: AggQuote}`;
  AggQuote = `{inAmount, outAmount, feePct, feeAmount, netOutAmount, minOutAmount,
  priceImpactPct, path[], isSplit, isMultiHop, segments:[{pool,venue,inputMint,outputMint,
  inAmount,outAmount,percentage?,hopIndex}]}`. 404 = no route.
- `POST /swap-tx` body `{inputMint, outputMint, amount, slippageBps, owner}` → `{transactionBase64
  (unsigned v0), blockhash, lastValidBlockHeight, route}`. Server re-quotes + simulates; can lazily
  extend a server-owned lookup table with sequential send+confirm txs → **60 s timeout**.
- Post-build flow (from `trade.ts`/`confirm.ts`): simulate on own RPC → sign locally → send →
  confirm with returned `{blockhash, lastValidBlockHeight}` (poll w/ backoff) → explorer link.
- Native COOK transfer (guaranteed fallback tx) = `SystemProgram.transfer` lamports
  (`transfer.ts`; `isNativeTransfer` when mint undefined or = COOK_MINT So1111…).
- Balance recipe (`balances.ts`): `getBalance` (native COOK) + `getParsedTokenAccountsByOwner` for
  Tokenkeg **and** Token-2022, joined to registry `/api/tokens` for symbol + usd.

Key source files: `src/core/cookiebox.ts` (agg quote/swap-tx), `candyshop.ts` (alt agg
`https://swap.cookiescan.io/api`), `trade.ts`, `transfer.ts`, `confirm.ts`, `balances.ts`,
`config.ts` (URLs + program ids + bridge), `cookiescan.ts` (REST client), `rpc.ts`.

## 5. WS reality — important correction to the recon plan

- Plan assumption "WS `wss://wss.cookiescan.io`, `/stream` 5 s ticks" is **wrong on both counts**.
- `wss://wss.cookiescan.io` (A record 95.217.193.241, shared with `rpc.cookiescan.io`): its nginx
  vhost **301-redirects every path to `https://bakedbazaar.art/…`** with a bakedbazaar.art TLS cert
  (curl `subject: CN=bakedbazaar.art`) → browsers abort (code 1006). It is not a Cookie Chain WS.
- No `/stream` (or SSE) endpoint exists anywhere in the cookiescan.io explorer bundle
  (`/assets/index-F0keJHJO.js`, 1.8 MB — grepped: zero `/stream` hits) nor on `api.cookiescan.io`
  (returns the DAS SPA HTML; no WS upgrade).
- The **real WS endpoint is `wss://rpc.cookiescan.io`** — standard Solana JSON-RPC pubsub, exactly as
  the explorer's own docs/developer-guide state ("WebSocket: wss://rpc.cookiescan.io"). Verified:
  connect in 1.18 s; `slotSubscribe` → `{"jsonrpc":"2.0","result":39941,"id":1}`. Suitable methods:
  `slotSubscribe`, `accountSubscribe`, `logsSubscribe`, `programSubscribe`.
- CRUMBS therefore ticks live via `slotSubscribe` on `wss://rpc.cookiescan.io` (auto-reconnect, sub
  replay) and keeps prices warm with 5 s REST polls; WS URL is env-overridable in case Cookie Chain
  ever ships a dedicated feed. Documented in README + Nightly modal (warning against the dead host).

## 6. COOK mint ambiguity — RESOLVED (evidence)

| Surface | Reports |
| --- | --- |
| `rpc.cookiescan.io getAccountInfo(So1111…1112)` | **exists**: Tokenkeg SPL mint, 9 decimals, mintAuthority null |
| `rpc.cookiescan.io getTokenSupply(So1111…1112)` | ok (9 dp; native supply tracked as lamports) |
| `rpc.cookiescan.io getAccountInfo(36Zr…)` | **null — does not exist on Cookie Chain** |
| `/api/tokens` registry | So1111 → "Wrapped COOK" `wCOOK`, `price.native: 1`, usd = cookUsd; 36Zr **absent** |
| `/api/markets` + `/api/markets/:mint` | every pool quotes the So1111 side as `wCOOK`/priceUsd=cookUsd |
| `/v1/assets` + search "cook" | assetId `cook`, primaryVariant mint = **So1111** (wCOOK), priceInCook 1 |
| `/api/cook`, `/api/price/cook`, `/api/status.cookMint` | label mint = **36Zr** (COOKIE, 9 dp) — the Solana-side canonical sCOOK identity |
| cookie-mcp `config.ts:74` | `COOK_MINT = So1111…` (comment: "Native/wrapped COOK is Solana's NATIVE_MINT, 9 decimals"); `:131` warns mint string alone is ambiguous across chains; `:169` | `36Zr` = `BRIDGE.solana.splMint` (Solana mainnet sCOOK, Token-2022, **6 dp**) |
| Solana mainnet | 36Zr sCOOK is a Token-2022 6-dp mint there (bridge collateral) |

**Decision (adopted by CRUMBS):** native COOK on Cookie Chain = **So1111…1112**, 9 decimals;
lamport balance = COOK balance; all swaps/transfers key COOK as So1111 (matches cookie-mcp, the
reference client). **36Zr… is display/documentation only** — the Solana-side bridge mint; never used
for on-chain ops on Cookie Chain. USD price = cookUsd (identical across `/api/status`,
`/api/cook`, registry So1111 row, `/api/price/cook`).

## 7. Funding note (NOT executed — owner-gated)

No tokens bridged or purchased. Verified instead: keypair generation + RPC balance reads against an
empty account (see `scripts/verify-wallet.mjs`). Funding path documented for the owner:
Solana mainnet SOL → Jupiter swap to sCOOK (mint 36Zr, Token-2022, 6 dp) → 1:1 Hyperlane warp at
**https://bridge.cookiescan.io** (community m-of-n multisig; docs: deposits/withdrawals authorized
by community signer set; airdrops disabled) → verify with `cookie balance` / the app.
Note: `cookie` CLI needs glibc ≥ 2.32 (not available on this ODROID's glibc 2.31) — run on any
x86_64/glibc≥2.32 machine or use the browser wallet.
