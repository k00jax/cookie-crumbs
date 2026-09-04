"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { POLL_STATUS_MS, POLL_TRENDING_MS, WS_URL } from "./constants";
import { ChainStream, type ChainStreamStatus } from "./stream";
import type { ApiStatus, Asset, TrendingResp } from "./types";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return (await res.json()) as T;
}

/** /api/status on 5 s cadence — heartbeat + COOK USD price. */
export function useStatus() {
  const { data, error, mutate } = useSWR<ApiStatus>(
    "https://api.cookiescan.io/api/status",
    fetcher,
    { refreshInterval: POLL_STATUS_MS, revalidateOnFocus: false },
  );
  return { status: data, error, mutate };
}

/** /v1/assets/trending on 10 s cadence (window can be empty for a beat — callers handle it). */
export function useTrending() {
  const { data, error, mutate } = useSWR<TrendingResp>(
    "https://api.cookiescan.io/v1/assets/trending",
    fetcher,
    { refreshInterval: POLL_TRENDING_MS, revalidateOnFocus: false },
  );
  return { trending: data, error, mutate };
}

export interface TickerState {
  /** WS link status */
  ws: ChainStreamStatus;
  /** true once a WS message has ever arrived (WS genuinely live) */
  wsLive: boolean;
  /** most recent slot from slotSubscribe (0 until first tick) */
  lastSlot: number;
  /** notifications received (activity counter) */
  ticks: number;
  /** epoch ms of last WS tick */
  lastWsAt: number | null;
  /** fallback REST cadence tick (ms) — increments every status poll; drives UI when WS is down */
  restTick: number;
  wsError: boolean;
}

/**
 * Live ticker: Solana pubsub slotSubscribe on wss://rpc.cookiescan.io with auto-reconnect.
 * If the WS never opens (blocked network / broken endpoint), the hook keeps ticking from the REST
 * poll cadence so the UI stays alive; `wsError`/`ws==="closed"` flag the degraded mode.
 */
export function useChainTicker(): TickerState {
  const [state, setState] = useState<TickerState>({
    ws: "idle",
    wsLive: false,
    lastSlot: 0,
    ticks: 0,
    lastWsAt: null,
    restTick: 0,
    wsError: false,
  });
  const streamRef = useRef<ChainStream | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const patch = useCallback((p: Partial<TickerState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  useEffect(() => {
    const stream = new ChainStream(WS_URL);
    streamRef.current = stream;

    const offStatus = stream.onStatus((ws) => {
      // "closed" = WS unreachable after a full backoff cycle → REST-poll fallback UI (degraded, not dead)
      patch({ ws, wsError: ws === "closed" });
    });
    stream.onMessage(() => {
      patch({ ticks: stateRef.current.ticks + 1, lastWsAt: Date.now(), wsLive: true });
    });

    stream.subscribe("slotSubscribe", [], (slot) => {
      const s = typeof slot === "object" && slot !== null ? (slot as { slot?: number }).slot : undefined;
      if (typeof s === "number") patch({ lastSlot: s, wsLive: true, lastWsAt: Date.now() });
    });

    stream.connect();
    const restTimer = setInterval(() => {
      patch({ restTick: stateRef.current.restTick + 1 });
    }, POLL_STATUS_MS);

    return () => {
      clearInterval(restTimer);
      offStatus();
      stream.close();
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

/** assets list for heatmap: cache trending separately; caller merges curated via api.ts. */
export function useHeatmapAssets(trending: TrendingResp | undefined): Asset[] {
  return useMemoAssets(trending);
}

function useMemoAssets(trending: TrendingResp | undefined): Asset[] {
  const [assets, setAssets] = useState<Asset[]>([]);
  useEffect(() => {
    if (!trending) return;
    setAssets((prev) => {
      const byId = new Map<string, Asset>(prev.map((a) => [a.assetId, a]));
      for (const a of trending.trending) if (a.assetId) byId.set(a.assetId, a);
      return [...byId.values()].sort((a, b) => (b.rank ?? 99) - (a.rank ?? 99)).reverse();
    });
  }, [trending]);
  return assets;
}

export { fetcher };
