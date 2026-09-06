"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { fetchHeatmapUniverse } from "@/lib/api";
import { useChainTicker, useStatus } from "@/lib/hooks";
import type { Asset } from "@/lib/types";
import { Heatmap } from "./Heatmap";
import { NightlySetupModal } from "./NightlySetupModal";
import { PoolsExplorer } from "./PoolsExplorer";
import { SwapPanel } from "./SwapPanel";
import { TickerBar } from "./TickerBar";
import { TokenDetail } from "./TokenDetail";
import { WalletPanel } from "./WalletPanel";

type View = "market" | "pools" | "swap";

export function Dashboard() {
  const { status, error: statusError } = useStatus();
  const ticker = useChainTicker();
  const [universe, setUniverse] = useState<Asset[]>([]);
  const [uniLoading, setUniLoading] = useState(true);
  const [uniError, setUniError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nightlyOpen, setNightlyOpen] = useState(false);
  const [view, setView] = useState<View>("market");

  const loadUniverse = useCallback(async () => {
    try {
      const { assets } = await fetchHeatmapUniverse();
      setUniverse(assets);
      setUniError(null);
    } catch (e) {
      setUniError(e instanceof Error ? e.message : "heatmap fetch failed");
    } finally {
      setUniLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUniverse();
    const t = setInterval(() => void loadUniverse(), 30_000);
    return () => clearInterval(t);
  }, [loadUniverse]);

  // Keep the selected asset fresh as the universe updates (rank/price drift), preserving selection.
  const selected = useMemo(
    () => universe.find((a) => a.assetId === selectedId) ?? null,
    [universe, selectedId],
  );

  const onSelect = useCallback((a: Asset) => {
    setSelectedId(a.assetId);
    setView("market");
  }, []);

  const cookUsd = useMemo(
    () => (status && typeof status.cookUsd === "number" ? status.cookUsd : null),
    [status],
  );

  // mint -> assetId map for pool explorer "open in market view" jumps.
  const universeMints = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of universe) {
      const mint = a.primaryVariant?.mint;
      if (mint && a.assetId) m.set(mint, a.assetId);
    }
    return m;
  }, [universe]);

  const tabs: { id: View; label: string }[] = [
    { id: "market", label: "Market" },
    { id: "pools", label: "Pools" },
    { id: "swap", label: "Swap" },
  ];

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-3 py-3 sm:px-4">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-3xl" aria-hidden>🍪</span>
          <div>
            <h1 className="text-xl font-black leading-none tracking-tight text-white">
              CHIP
              <span className="ml-2 bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-sm font-bold text-transparent">
                market terminal
              </span>
            </h1>
            <p className="text-[11px] text-zinc-500">Cookie Chain · live analytics + portfolio</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setNightlyOpen(true)}
            className="hidden rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:border-amber-400/50 hover:text-amber-300 sm:block"
            title="Add Cookie Chain to Nightly / MetaMask"
          >
            ⚙ Network setup
          </button>
          <span className="wallet-adapter-button-wrap">
            <WalletMultiButton />
          </span>
        </div>
      </header>

      {/* Live ticker */}
      <TickerBar ticker={ticker} status={status} />
      {ticker.wsError && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
          <span aria-hidden>⚠</span>
          <span>
            Live WebSocket unreachable (<span className="font-mono">wss://rpc.cookiescan.io</span>) —
            ticker running on 5 s REST polls.
          </span>
        </div>
      )}
      {statusError && !status && (
        <div className="rounded-lg border border-rose-500/25 bg-rose-500/5 px-3 py-2 text-xs text-rose-300">
          /api/status unreachable — {statusError instanceof Error ? statusError.message : "check network"}
        </div>
      )}

      {/* View tabs */}
      <nav className="flex gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
              view === t.id
                ? "bg-amber-400 text-zinc-950"
                : "border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* View content */}
      <main>
        {view === "market" && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-3 lg:col-span-2">
              <Heatmap
                assets={universe}
                loading={uniLoading}
                error={uniError}
                selectedId={selected?.assetId ?? null}
                onSelect={onSelect}
                onRetry={() => void loadUniverse()}
              />
              <TokenDetail asset={selected} />
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <WalletPanel cookUsd={cookUsd} onOpenNightlySetup={() => setNightlyOpen(true)} />
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-[11px] leading-relaxed text-zinc-500">
                <div className="mb-1 font-semibold uppercase tracking-wider text-zinc-400">Chain notes</div>
                <ul className="list-inside space-y-1">
                  <li>• Native COOK on Cookie Chain = <span className="font-mono text-zinc-400">So1111…1112</span> (lamports, 9 dp).</li>
                  <li>• <span className="font-mono text-zinc-400">36Zr…</span> is the Solana-side sCOOK mint — absent on this chain (RPC: not found).</li>
                  <li>• RPC <span className="font-mono text-zinc-400">rpc.cookiescan.io</span> · WS <span className="font-mono text-zinc-400">wss://rpc.cookiescan.io</span>.</li>
                  <li>• Every tx is user-initiated and owner-approved — nothing auto-signs.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {view === "pools" && (
          <PoolsExplorer universeMints={universeMints} onOpenAsset={(assetId) => { setSelectedId(assetId); setView("market"); }} />
        )}

        {view === "swap" && <SwapPanel assets={universe} cookUsd={cookUsd} />}
      </main>

      <footer className="border-t border-zinc-800/70 pb-4 pt-3 text-center text-[10px] text-zinc-600">
        CHIP · chip.fonger.ai · data: api.cookiescan.io + rpc.cookiescan.io + agg.cookiebox.app ·
        wallet: Nightly / MetaMask · reads free, every tx owner-approved
      </footer>

      <NightlySetupModal open={nightlyOpen} onClose={() => setNightlyOpen(false)} />
    </div>
  );
}
