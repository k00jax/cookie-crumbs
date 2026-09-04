"use client";

// Token heatmap: trending + curated universe, tiles colored by 24h change. Click = select detail.

import { useMemo, useState } from "react";
import type { Asset } from "@/lib/types";
import { changeColor, fmtCompact, fmtNum, fmtUsd, heatColor } from "@/lib/format";
import { Card, EmptyState, Skeleton } from "./ui";
import { TokenImage } from "./TokenImage";

export function Heatmap({
  assets,
  loading,
  error,
  selectedId,
  onSelect,
  onRetry,
}: {
  assets: Asset[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (a: Asset) => void;
  onRetry: () => void;
}) {
  const [order, setOrder] = useState<"rank" | "gainers" | "losers">("rank");

  const sorted = useMemo(() => {
    const list = [...assets];
    if (order === "gainers")
      list.sort((a, b) => (b.stats.priceChange24hPercent ?? -999) - (a.stats.priceChange24hPercent ?? -999));
    else if (order === "losers")
      list.sort((a, b) => (a.stats.priceChange24hPercent ?? 999) - (b.stats.priceChange24hPercent ?? 999));
    else list.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
    return list;
  }, [assets, order]);

  return (
    <Card
      title="Token heatmap"
      right={
        <div className="flex gap-1 text-[11px]">
          {(["rank", "gainers", "losers"] as const).map((o) => (
            <button
              key={o}
              onClick={() => setOrder(o)}
              className={`rounded px-2 py-0.5 capitalize transition ${
                order === o
                  ? "bg-amber-400/20 text-amber-300"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      }
    >
      {loading && assets.length === 0 ? (
        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : error && assets.length === 0 ? (
        <div className="p-2">
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-rose-300">
            {error}
          </div>
          <button onClick={onRetry} className="mt-2 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:text-white">
            Retry
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState message="Trend window is empty for a beat" hint="The API recomputes it — auto-refreshing every 10 s." />
      ) : (
        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 xl:grid-cols-4">
          {sorted.map((a) => {
            const chg = a.stats.priceChange24hPercent ?? null;
            const selected = a.assetId === selectedId;
            return (
              <button
                key={a.assetId}
                onClick={() => onSelect(a)}
                className={`group relative overflow-hidden rounded-lg border p-2.5 text-left transition ${
                  selected
                    ? "border-amber-400/80 ring-1 ring-amber-400/50"
                    : "border-zinc-800 hover:border-zinc-600"
                } ${heatColor(chg)}`}
                title={`${a.name} (${a.symbol})`}
              >
                {typeof a.rank === "number" && a.rank > 0 && (
                  <span className="absolute right-1.5 top-1.5 font-mono text-[10px] text-zinc-500">
                    #{a.rank}
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <TokenImage src={a.imageUrl} alt={a.symbol} className="h-4 w-4 rounded-full bg-zinc-800 object-cover" />
                  <span className="truncate text-sm font-semibold text-white">{a.symbol}</span>
                  <span className="truncate text-[10px] text-zinc-400">{a.category ?? ""}</span>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-1">
                  <span className="font-mono text-xs text-zinc-200">{fmtUsd(a.stats.price, 6)}</span>
                  <span className={`font-mono text-[11px] font-semibold ${changeColor(chg)}`}>
                    {chg === null || chg === undefined ? "—" : `${chg >= 0 ? "+" : ""}${chg.toFixed(1)}%`}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[10px] text-zinc-500">
                  <span>vol {fmtCompact(a.stats.volume24hUSD)}</span>
                  <span>{a.stats.holder != null ? `${fmtNum(a.stats.holder, 0)} hold` : ""}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
