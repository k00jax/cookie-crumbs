"use client";

// Pool/market explorer: total liquidity, liquidity by venue (recharts bars), searchable pool list.
// Data: /api/markets (full pool feed) polled every 20 s.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchMarkets } from "@/lib/api";
import { EXPLORER_URL } from "@/lib/constants";
import { fmtNum, fmtUsd } from "@/lib/format";
import type { Market } from "@/lib/types";
import { Card, ErrorState, LoadingRows } from "./ui";

export function PoolsExplorer({
  universeMints,
  onOpenAsset,
}: {
  universeMints: Map<string, string>; // mint -> assetId
  onOpenAsset: (assetId: string) => void;
}) {
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const loadingOnce = useRef(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetchMarkets();
        if (alive) {
          setMarkets(r.markets);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "markets fetch failed");
      } finally {
        loadingOnce.current = true;
      }
    };
    void load();
    const t = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const venueAgg = useMemo(() => {
    const m = new Map<string, { count: number; liquidityUsd: number }>();
    for (const mk of markets ?? []) {
      const rec = m.get(mk.type) ?? { count: 0, liquidityUsd: 0 };
      rec.count += 1;
      rec.liquidityUsd += mk.liquidityUsd ?? 0;
      m.set(mk.type, rec);
    }
    return [...m.entries()]
      .map(([venue, v]) => ({ venue, ...v }))
      .sort((a, b) => b.liquidityUsd - a.liquidityUsd);
  }, [markets]);

  const totalLiquidity = useMemo(
    () => (markets ?? []).reduce((s, mk) => s + (mk.liquidityUsd ?? 0), 0),
    [markets],
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = [...(markets ?? [])].sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0));
    if (!q) return list;
    return list.filter(
      (mk) =>
        mk.type.toLowerCase().includes(q) ||
        mk.baseToken.symbol?.toLowerCase().includes(q) ||
        mk.quoteToken.symbol?.toLowerCase().includes(q) ||
        mk.baseToken.mint.toLowerCase().includes(q),
    );
  }, [markets, filter]);

  const selected = selectedId ? (markets ?? []).find((mk) => mk.marketId === selectedId) ?? null : null;

  const tokenJump = (mint: string | undefined) => {
    if (!mint) return;
    const assetId = universeMints.get(mint);
    if (assetId) onOpenAsset(assetId);
  };

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
      <Card title="Liquidity by venue" className="xl:col-span-2">
        <div className="p-3">
          <div className="mb-2 flex items-baseline justify-between px-1 text-xs text-zinc-500">
            <span>
              {markets?.length ?? 0} markets · total{" "}
              <span className="font-mono text-zinc-300">{fmtUsd(totalLiquidity)}</span>
            </span>
            <span className="text-zinc-600">/api/markets</span>
          </div>
          <div className="h-56 w-full rounded-lg border border-zinc-800/70 bg-zinc-950/50 p-1">
            {!markets ? (
              <LoadingRows rows={3} />
            ) : venueAgg.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500">no market data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={venueAgg} layout="vertical" margin={{ top: 4, right: 10, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v: number) => `$${fmtNum(v)}`} />
                  <YAxis type="category" dataKey="venue" width={132} tick={{ fontSize: 9, fill: "#a1a1aa" }} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [fmtUsd(Number(v)), "liquidity"]}
                  />
                  <Bar dataKey="liquidityUsd" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <ul className="mt-2 space-y-1 px-1">
            {venueAgg.slice(0, 6).map((v) => (
              <li key={v.venue} className="flex items-center justify-between text-xs">
                <span className="truncate text-zinc-400">{v.venue}</span>
                <span className="shrink-0 font-mono text-zinc-300">
                  {v.count} · {fmtUsd(v.liquidityUsd)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card
        title="Pool explorer"
        className="xl:col-span-3"
        right={
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filter pools…"
            className="w-44 rounded-md border border-zinc-800 bg-zinc-950/80 px-2 py-1 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-amber-400/50"
          />
        }
      >
        {error && !markets ? (
          <ErrorState message={error} onRetry={() => setMarkets(null)} />
        ) : !markets ? (
          <LoadingRows rows={6} />
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-xs text-zinc-500">no pools match “{filter}”</div>
        ) : (
          <ul className="max-h-[420px] divide-y divide-zinc-800/60 overflow-y-auto">
            {filtered.slice(0, 60).map((mk) => (
              <li key={mk.marketId}>
                <button
                  onClick={() => setSelectedId(selectedId === mk.marketId ? null : mk.marketId)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition hover:bg-zinc-800/40"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] text-amber-300/90">{mk.type}</span>
                    <span className="truncate font-semibold text-zinc-200">
                      {mk.baseToken.symbol ?? "?"} <span className="text-zinc-600">⇄</span> {mk.quoteToken.symbol ?? "?"}
                    </span>
                    <span className="hidden truncate font-mono text-[10px] text-zinc-600 sm:inline">{mk.liquidityDisplay}</span>
                  </div>
                  <span className="shrink-0 font-mono text-zinc-200">{fmtUsd(mk.liquidityUsd)}</span>
                </button>
                {selectedId === mk.marketId && (
                  <div className="border-t border-zinc-800/50 bg-zinc-950/50 px-3 py-2.5 text-xs">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-zinc-500">{mk.marketId}</span>
                      <a
                        href={`${EXPLORER_URL}/address/${mk.marketId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-300/90 hover:underline"
                      >
                        explorer ↗
                      </a>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <PoolSide label="Base" side={mk.baseToken} onOpen={() => tokenJump(mk.baseToken.mint)} showJump={universeMints.has(mk.baseToken.mint ?? "")} />
                      <PoolSide label="Quote" side={mk.quoteToken} onOpen={() => tokenJump(mk.quoteToken.mint)} showJump={universeMints.has(mk.quoteToken.mint ?? "")} />
                    </div>
                    <div className="mt-2 text-[10px] text-zinc-500">{mk.liquidityDisplay}</div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function PoolSide({
  label,
  side,
  onOpen,
  showJump,
}: {
  label: string;
  side: Market["baseToken"];
  onOpen: () => void;
  showJump: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 p-2">
      <div className="text-[9px] uppercase tracking-wider text-zinc-600">{label}</div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-zinc-200">{side.symbol ?? "?"}</span>
        {showJump && (
          <button onClick={onOpen} className="text-[10px] text-amber-300/90 hover:underline">
            open in market view →
          </button>
        )}
      </div>
      <div className="font-mono text-[10px] text-zinc-500">
        {side.amount != null ? fmtNum(side.amount) : "—"} · {fmtUsd(side.priceUsd, 6)}
      </div>
    </div>
  );
}
