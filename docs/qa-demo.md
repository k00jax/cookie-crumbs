# QA + demo evidence — CHIP (Cookie Chain market terminal)

Verified 2026-09-06 on the ODROID build (headless Chromium via CDP + puppeteer-core, 1440x900,
against the live static export served from `out/`). Zero console errors, zero page errors, zero
React error-boundary hits across every view.

## Automated walkthrough (mock tests)

Script: `/tmp/cdp-qa/chip-demo.mjs`. Frames: `/tmp/chip-demo/*.png`. Video:
`/tmp/chip-demo/chip-demo.mp4` (also `/home/odroid/chip-demo.mp4`).

| Step | What it proves | Result |
|---|---|---|
| 1. Market overview | Heatmap + ticker + portfolio load from live APIs | PASS |
| 2. Token detail (MON) | Detail stats, 5 s price-poll history → recharts chart, no crash (regression: GORBOY mcap ≥$1,000 fmtUsd RangeError is fixed) | PASS |
| 3. Pools explorer | /api/markets load, venue TVL chart, pool list render | PASS |
| 4. Swap (sell 5 COOK → MON) | Live Cookiebox aggregator quote: Est. receive, Rate, Min receive (slippage), route breakdown | PASS |

Also verified earlier: prices never print as e-notation (`$0.000000107758` style); ipfs logos
degrade to placeholder instead of broken icons; fmtUsd handles values ≥$1,000 (no RangeError).

## Honest boundaries (mock vs real)

- **Mock tests cover the full read + quote + UI path** (everything above).
- The **sign/send/confirm code path is implemented** (build swap-tx → decode → wallet
  sendTransaction → confirm → explorer link) but is **gated on a wallet with a COOK balance** and
  has not executed on-chain yet: Cookie Chain has no faucet, community gas was requested on the
  listing (Przem Sas, 2026-09-04) but not yet received, and no funds have been spent.
- No fabricated transactions, fake explorer links, or simulated confirmations are presented as real
  on-chain activity anywhere in this app or repo. The UI's wallet-gating copy states exactly that
  ("bridge a little to test", "reads stay free").
- To close the loop: fund the wallet (community tip or bridge), execute one real swap, capture the
  confirmed tx + cookiescan.io link, and re-record the final demo frame.

## Live artifacts

- Live: https://chip.fonger.ai
- Repo: https://github.com/k00jax/chip (public, MIT)
- Submission: Superteam Earn "Create an App on Cookie Chain" (1,000 USDC pool, deadline 2026-09-22)
