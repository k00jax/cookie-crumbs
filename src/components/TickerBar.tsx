"use client";

import { fmtTime, fmtUsd } from "@/lib/format";
import type { TickerState } from "@/lib/hooks";
import type { ApiStatus } from "@/lib/types";

function WsDot({ ws, live }: { ws: TickerState["ws"]; live: boolean }) {
  const color =
    ws === "open" && live
      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
      : ws === "connecting" || ws === "reconnecting"
        ? "bg-amber-400 animate-pulse"
        : "bg-zinc-600";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-hidden />;
}

export function TickerBar({
  ticker,
  status,
}: {
  ticker: TickerState;
  status: ApiStatus | undefined;
}) {
  const wsLabel =
    ticker.ws === "open" && ticker.wsLive
      ? "LIVE"
      : ticker.ws === "reconnecting" || ticker.ws === "connecting"
        ? "WS reconnecting…"
        : ticker.ws === "closed"
          ? "REST poll"
          : "WS …";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
        <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
          <WsDot ws={ticker.ws} live={ticker.wsLive} />
          <span className={ticker.wsLive ? "text-emerald-300" : "text-zinc-300"}>{wsLabel}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-wider text-zinc-500">COOK</span>
          <span className="font-mono text-base font-semibold text-amber-300">
            {status ? fmtUsd(status.cookUsd, 6) : "—"}
          </span>
        </div>
        <div className="text-xs text-zinc-500">
          slot <span className="font-mono text-zinc-300">{ticker.lastSlot ? ticker.lastSlot.toLocaleString() : "…"}</span>
        </div>
        <div className="text-xs text-zinc-500">
          tokens <span className="font-mono text-zinc-300">{status?.activeTokens?.toLocaleString() ?? "…"}</span>
        </div>
        <div className="text-xs text-zinc-500">
          ticks <span className="font-mono text-zinc-300">{ticker.ticks}</span>
        </div>
        <div className="ml-auto font-mono text-xs text-zinc-600">
          {status ? fmtTime(status.timestamp) : ticker.lastWsAt ? fmtTime(ticker.lastWsAt) : "—"}
        </div>
      </div>
    </div>
  );
}
