"use client";

// Connected-wallet panel: address, native COOK balance (lamports = COOK on this chain), SPL +
// Token-2022 positions enriched from the cookiescan registry, USD totals. User-initiated reads only.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { indexRegistry, tokensRegistryOnce } from "@/lib/api";
import { readPortfolio, type WalletPortfolio } from "@/lib/chain";
import { COOK_DECIMALS, COOK_SYMBOL, EXPLORER_URL } from "@/lib/constants";
import { fmtUsd, shortAddr } from "@/lib/format";
import { Card, EmptyState, ErrorState, LoadingRows, Skeleton } from "./ui";

type LoadState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "done"; portfolio: WalletPortfolio }
  | { phase: "error"; message: string };

export function WalletPanel({
  cookUsd,
  onOpenNightlySetup,
}: {
  cookUsd: number | null;
  onOpenNightlySetup: () => void;
}) {
  const { connection } = useConnection();
  const { connected, connecting, publicKey, disconnect, wallet } = useWallet();
  const [state, setState] = useState<LoadState>({ phase: "idle" });
  const [showAddr, setShowAddr] = useState(false);
  const runId = useRef(0);
  const address = publicKey?.toBase58() ?? null;

  const load = useCallback(async () => {
    if (!publicKey) {
      setState({ phase: "idle" });
      return;
    }
    const id = ++runId.current;
    setState({ phase: "loading" });
    try {
      const [registryResp] = await Promise.all([
        tokensRegistryOnce().catch(() => null), // registry failure degrades gracefully below
      ]);
      const registry = indexRegistry(registryResp);
      const portfolio = await readPortfolio(connection, publicKey, registry);
      // COOK price fallback: registry COOK row and /api/status agree; prefer live status price.
      const cookRow = registry.get("So11111111111111111111111111111111111111112");
      const usd = cookUsd ?? (cookRow && Number.isFinite(cookRow.usd) ? cookRow.usd : null);
      const cookUsdVal = usd != null ? portfolio.cook * usd : null;
      const tokensUsd = portfolio.tokensUsd;
      const totalUsd =
        cookUsdVal != null || tokensUsd != null ? (cookUsdVal ?? 0) + (tokensUsd ?? 0) : null;
      if (runId.current === id) {
        setState({
          phase: "done",
          portfolio: { ...portfolio, cookUsd: cookUsdVal, totalUsd },
        });
      }
    } catch (e) {
      if (runId.current === id) {
        setState({ phase: "error", message: e instanceof Error ? e.message : "balance read failed" });
      }
    }
  }, [publicKey, connection, cookUsd]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!connected) setState({ phase: "idle" });
  }, [connected]);

  const rows = useMemo(
    () => (state.phase === "done" ? state.portfolio.tokens.filter((t) => t.amount > 0) : []),
    [state],
  );
  const tokenCount = rows.length;

  return (
    <Card
      title="Portfolio"
      right={
        connected &&
        address && (
          <button
            onClick={() => setShowAddr((s) => !s)}
            className="font-mono text-xs text-zinc-400 hover:text-amber-300"
            title="toggle full address"
          >
            {showAddr ? address : shortAddr(address, 6, 6)}
          </button>
        )
      }
    >
      {!connected && !connecting && (
        <div className="p-5">
          <EmptyState
            message="No wallet connected"
            hint="Connect to see your COOK balance & positions. Reads are free; txs are only ever user-initiated."
          />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={onOpenNightlySetup}
              className="flex-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition hover:border-amber-400/60 hover:text-amber-300"
            >
              Set up Nightly wallet
            </button>
          </div>
        </div>
      )}
      {connecting && (
        <div className="p-4">
          <Skeleton className="h-5 w-40" />
          <LoadingRows rows={2} />
        </div>
      )}
      {state.phase === "loading" && connected && (
        <div className="p-4">
          <Skeleton className="h-6 w-36" />
          <LoadingRows rows={3} />
        </div>
      )}
      {state.phase === "error" && <ErrorState message={state.message} onRetry={() => void load()} />}
      {state.phase === "done" && address && (
        <div className="p-4">
          {showAddr && (
            <a
              href={`${EXPLORER_URL}/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="mb-2 block break-all font-mono text-[11px] text-zinc-500 hover:text-amber-300"
            >
              {address} ↗
            </a>
          )}
          <div className="flex items-baseline justify-between rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                {COOK_SYMBOL} · native balance
              </div>
              <div className="font-mono text-2xl font-bold text-amber-300">
                {state.portfolio.cook.toLocaleString("en-US", { maximumFractionDigits: COOK_DECIMALS })}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">≈ USD</div>
              <div className="font-mono text-sm text-zinc-300">
                {state.portfolio.cookUsd != null ? fmtUsd(state.portfolio.cookUsd) : "—"}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wider text-zinc-500">
              <span>SPL / Token-2022 positions {tokenCount ? `(${tokenCount})` : ""}</span>
              <span className="font-mono normal-case text-zinc-400">
                {state.portfolio.totalUsd != null ? fmtUsd(state.portfolio.totalUsd) : ""}
              </span>
            </div>
            {rows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-800 p-3 text-center text-xs text-zinc-600">
                No token accounts yet — this wallet is unfunded. Funding (bridge) is a later,
                owner-approved step.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {rows.map((r) => (
                  <li
                    key={r.mint}
                    className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-2.5 py-1.5 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-semibold text-zinc-200">{r.symbol ?? "?"}</span>
                      <span className="truncate font-mono text-[10px] text-zinc-600">
                        {`${r.mint.slice(0, 5)}…${r.mint.slice(-5)}`}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-zinc-200">
                        {r.amount.toLocaleString("en-US", { maximumFractionDigits: r.decimals })}
                      </div>
                      <div className="font-mono text-[10px] text-zinc-500">
                        {r.usd != null ? fmtUsd(r.usd) : "unpriced"}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-3 flex justify-between gap-2">
            <button
              onClick={() => void load()}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Refresh balances
            </button>
            <button
              onClick={() => void disconnect()}
              className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-300 transition hover:border-rose-400/70 hover:text-rose-200"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
