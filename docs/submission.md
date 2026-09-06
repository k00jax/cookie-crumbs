# CHIP — Superteam submission record

Cookie Chain cApp bounty ("Create an App on Cookie Chain"), Superteam Earn.
Pool: 1,000 USDC (1st 500 / 2nd 500). Deadline: 2026-09-22. Winners: 2026-09-28.

## Submitted links

- **Submission link:** https://chip.fonger.ai
- **Tweet link:** https://x.com/blackf1re/status/2096708732902093125
- **Live application URL:** https://chip.fonger.ai
- **GitHub repository:** https://github.com/k00jax/chip
- **Contracts:** none deployed — API/aggregator-integrated app (api.cookiescan.io, rpc.cookiescan.io, agg.cookiebox.app)

## Status log

- 2026-09-04: Recon + D0–D3 build; environment/WS/mint evidence; repo + public URL shipped.
- 2026-09-04/05: QA bug fixes (fmtUsd RangeError, e-notation prices, token images); Market/Pools/Swap views.
- 2026-09-05: Renamed CRUMBS → **CHIP** (differentiate from same-contest "Crumbs" clicker). Live at chip.fonger.ai; repo k00jax/chip.
- 2026-09-06: Mock-test QA harness + demo video (`docs/qa-demo.md`); X thread published from @blackf1re (7 posts, @trivanceai credit in closer); Superteam submission entered (editable until deadline).
- Pending: real on-chain swap demo — wallet gas requested from Przem Sas (listing comments) + Discord admin. No faucet on Cookie Chain; no funds spent.

## Honest boundaries

No fabricated transactions or simulated confirmations are presented as real on-chain activity.
The swap execute path is implemented and gated on a wallet with a COOK balance (see
`docs/qa-demo.md`). When gas lands, run one real swap, capture confirmed tx + cookiescan.io link,
and update this record + the submission.
