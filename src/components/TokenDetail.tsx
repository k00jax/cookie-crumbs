"use client";

// Token detail: live stats for the selected asset, a rolling 5 s price history (recharts), and its
// pool markets from /api/markets/:mint. Recharts renders client-side only.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchMarketsFor, fetchPrice } from "@/lib/api";
import { EXPLORER_URL } from "@/lib/constants";
import {
  changeColor,
  fmtCompact,
  fmtTime,
  fmtUsd,
} from "@/lib/format";
import type { Asset, Market } from "@/lib/types";
import { Card, ErrorState, LoadingRows, Skeleton } from "./ui";
import { TokenImage } from "./TokenImage";

const HISTORY_CAP = 90; // 5 s polls → 7.5 min window

interface Sample {
  t: string;
  price: number;
}

export function TokenDetail({
  asset,
  onSelectAsset,
}: {
  asset: Asset | null;
  onSelectAsset?: (a: Asset) => void;
}) {
  const mint = asset?.primaryVariant.mint ?? null;
  const [history, setHistory] = useState<Sample[]>([]);
  const [priceErr, setPriceErr] = useState<string | null>(null);
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [marketsErr, setMarketsErr] = useState<string | null>(null);
  const selectedMint = useRef<string | null>(null);

  // Reset history whenever the selected mint changes.
  useEffect(() => {
    if (selectedMint.current !== mint) {
      selectedMint.current = mint;
      setHistory([]);
    }
    if (!mint) return;
    let alive = true;
    let priceTimer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      try {
        const r = await fetchPrice(mint);
        const raw = r.data?.price?.usd;
        // NOTE: /api/price returns usd as a NUMBER for some mints and a STRING for others
        // (verified: GORBOY → "0.000000364660920632"). Normalize both.
        const usd = typeof raw === "string" ? Number.parseFloat(raw) : raw;
        if (alive && typeof usd === "number" && Number.isFinite(usd)) {
          setHistory((h) => {
            const next = [...h, { t: new Date().toLocaleTimeString("en-US", { hour12: false }), price: usd }];
            return next.length > HISTORY_CAP ? next.slice(next.length - HISTORY_CAP) : next;
          });
          setPriceErr(null);
        }
      } catch (e) {
        if (alive) setPriceErr(e instanceof Error ? e.message : "price poll failed");
      }
    };
    tick();
    priceTimer = setInterval(tick, 5_000);
    return () => {
      alive = false;
      if (priceTimer) clearInterval(priceTimer);
    };
  }, [mint]);

  // Markets for the mint (refreshed on selection + every 20 s while mounted).
  useEffect(() => {
    if (!mint) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await fetchMarketsFor(mint);
        if (alive) {
          const sorted = [...r.markets].sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0));
          setMarkets(sorted.slice(0, 6));
          setMarketsErr(null);
        }
      } catch (e) {
        if (alive) setMarketsErr(e instanceof Error ? e.message : "markets fetch failed");
      }
    };
    load();
    const t = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [mint]);

  if (!asset) {
    return (
      <Card title="Token detail">
        <div className="p-6 text-center text-sm text-zinc-500">
          Select a token from the heatmap — or connect a wallet to see its positions.
        </div>
      </Card>
    );
  }

  const st = asset.stats ?? {};
  const mkt = asset.primaryVariant.market ?? {};
  const last = history.length ? history[history.length - 1].price : st.price;
  const img = asset.imageUrl || mkt.logoURI;

  return (
    <Card
      title="Token detail"
      right={
        mint ? (
          <a
            href={`${EXPLORER_URL}/token/${mint}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-amber-300/90 underline-offset-2 hover:underline"
          >
            explorer ↗
          </a>
        ) : undefined
      }
    >
      <div className="p-4">
        <div className="flex items-center gap-3">
          <TokenImage
            src={img}
            alt={asset.symbol}
            className="h-10 w-10 rounded-xl bg-zinc-800 object-cover"
          />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h3 className="truncate text-lg font-bold text-white">{asset.name}</h3>
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-amber-300">{asset.symbol}</span>
            </div>
            <div className="truncate text-xs text-zinc-500">
              {asset.primaryVariant.variantId}
              {mint && <span className="ml-2 font-mono">{`${mint.slice(0, 5)}…${mint.slice(-5)}`}</span>}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Price USD" value={fmtUsd(last, 6)} big mono />
          <Stat
            label="Price (COOK)"
            value={
              st.priceInCook != null && st.priceInCook !== 0
                ? st.priceInCook.toPrecision(4)
                : mkt.priceInCook != null
                  ? mkt.priceInCook.toPrecision(4)
                  : "—"
            }
            mono
          />
          <Stat
            label="24h"
            value={
              st.priceChange24hPercent != null
                ? `${st.priceChange24hPercent >= 0 ? "+" : ""}${st.priceChange24hPercent.toFixed(2)}%`
                : "—"
            }
            cls={changeColor(st.priceChange24hPercent)}
          />
          <Stat label="Liquidity" value={fmtUsd(mkt.liquidity ?? st.liquidity)} />
          <Stat label="Vol 24h" value={fmtUsd(mkt.volume24hUSD ?? st.volume24hUSD)} />
          <Stat label="Holders" value={mkt.holder != null ? fmtCompact(mkt.holder) : fmtCompact(st.holder)} />
          <Stat label="Market cap" value={fmtUsd(mkt.marketCap ?? st.marketCap)} />
          <Stat label="Supply" value={mkt.supply != null ? fmtCompact(mkt.supply) : fmtCompact(st.supply)} />
          <Stat label="Pools" value={mkt.poolCount != null ? String(mkt.poolCount) : "—"} />
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wider text-zinc-500">
            <span>Price · 5 s polls · {history.length ? "live" : "first sample in ≤5 s"}</span>
            {history.length > 0 && (
              <span className="font-mono normal-case text-zinc-600">{fmtTime(Date.now())}</span>
            )}
          </div>
          <div className="h-36 w-full rounded-lg border border-zinc-800/70 bg-zinc-950/50 p-1">
            {history.length < 2 ? (
              <div className="flex h-full items-center justify-center gap-2 text-xs text-zinc-600">
                {priceErr ? <span className="text-rose-400">price feed error</span> : <Skeleton className="h-24 w-11/12" />}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" hide minTickGap={40} />
                  <YAxis
                    domain={["auto", "auto"]}
                    width={54}
                    tick={{ fontSize: 10, fill: "#71717a" }}
                    tickFormatter={(v: number) => fmtUsd(v, 6)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#a1a1aa" }}
                    formatter={(v) => [fmtUsd(Number(v), 6), asset.symbol]}
                  />
                  <Area type="monotone" dataKey="price" stroke="#fbbf24" strokeWidth={1.5} fill="url(#priceFill)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          {priceErr && !history.length && (
            <div className="mt-1 text-[11px] text-rose-400/80">{priceErr}</div>
          )}
        </div>

        <div className="mt-4">
          <div className="mb-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
            Top pools · /api/markets/:mint
          </div>
          {marketsErr && !markets ? (
            <ErrorState compact message={marketsErr} />
          ) : !markets ? (
            <LoadingRows rows={3} />
          ) : markets.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 p-3 text-xs text-zinc-500">
              No indexed pools for this mint yet.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {markets.map((m) => (
                <li
                  key={m.marketId}
                  className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-2.5 py-1.5 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] text-zinc-500">{m.type}</div>
                    <div className="truncate text-zinc-300">
                      <span className="font-semibold text-zinc-200">{m.baseToken.symbol ?? "?"}</span>
                      <span className="text-zinc-600"> ⇄ </span>
                      <span className="font-semibold text-zinc-200">{m.quoteToken.symbol ?? "?"}</span>
                      <span className="ml-1.5 text-zinc-600">{m.liquidityDisplay}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-zinc-200">{fmtUsd(m.liquidityUsd)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  cls = "text-zinc-100",
  mono = false,
  big = false,
}: {
  label: string;
  value: string;
  cls?: string;
  mono?: boolean;
  big?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`${mono ? "font-mono" : ""} ${big ? "text-base" : "text-sm"} font-semibold ${cls} truncate`}>
        {value}
      </div>
    </div>
  );
}
