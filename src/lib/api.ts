// Typed fetchers for the cookiescan REST API (CORS-open, no auth — verified 2026-09-04).
// All endpoints echo access-control-allow-origin and answer OPTIONS preflight 204.

import { API_URL } from "./constants";
import type {
  ApiStatus,
  AssetsListResp,
  Asset,
  CookPriceResp,
  CuratedResp,
  Market,
  MarketsResp,
  PriceResp,
  RegistryToken,
  SearchResp,
  TokensResp,
  TrendingResp,
} from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public url: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getJson<T>(path: string, timeoutMs = 20_000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
  } catch (e) {
    clearTimeout(timer);
    const reason = e instanceof Error && e.name === "AbortError" ? "timeout" : "network";
    throw new ApiError(0, `fetch failed (${reason}): ${API_URL}${path}`, `${API_URL}${path}`);
  }
  clearTimeout(timer);
  if (!res.ok) {
    throw new ApiError(res.status, `HTTP ${res.status}: ${API_URL}${path}`, `${API_URL}${path}`);
  }
  return (await res.json()) as T;
}

// --- /api/status — tiny (≈200 B) heartbeat + canonical COOK USD price ---
export function fetchStatus(): Promise<ApiStatus> {
  return getJson<ApiStatus>("/api/status");
}

// --- /api/cook — COOK summary (note: data.mint = Solana-side sCOOK label 36Zr…) ---
export function fetchCook(): Promise<CookPriceResp> {
  return getJson<CookPriceResp>("/api/cook");
}

// --- /api/tokens — FULL registry (~6.5k tokens, ~4 MB). Fetch once, keep client-side. ---
export function fetchTokens(): Promise<TokensResp> {
  return getJson<TokensResp>("/api/tokens", 60_000);
}

// --- /api/tokens/search?q= — registry search ---
export function fetchTokenSearch(q: string): Promise<TokensResp> {
  return getJson<TokensResp>(`/api/tokens/search?q=${encodeURIComponent(q)}`);
}

// --- /api/price/:mintOrSymbol — per-token price detail (cheap, ideal for 5 s polling) ---
export function fetchPrice(key: string): Promise<PriceResp> {
  return getJson<PriceResp>(`/api/price/${encodeURIComponent(key)}`);
}

// --- /api/markets — all pools ---
export function fetchMarkets(): Promise<{ success: boolean; marketCount: number; markets: Market[] }> {
  return getJson<{ success: boolean; marketCount: number; markets: Market[] }>("/api/markets");
}

// --- /api/markets/:mintOrSymbol — pools for one token (resolves mint OR symbol) ---
export function fetchMarketsFor(key: string): Promise<MarketsResp> {
  return getJson<MarketsResp>(`/api/markets/${encodeURIComponent(key)}`);
}

// --- /v1/assets/trending — "what's hot" (3-ish items; occasionally 0 while the window recomputes) ---
export function fetchTrending(): Promise<TrendingResp> {
  return getJson<TrendingResp>("/v1/assets/trending");
}

// --- /v1/assets/search?q= ---
export function fetchAssetSearch(q: string): Promise<SearchResp> {
  return getJson<SearchResp>(`/v1/assets/search?q=${encodeURIComponent(q)}`);
}

// --- /v1/assets/curated?list=majors|lsts|memes ---
export function fetchCurated(list: string): Promise<CuratedResp> {
  return getJson<CuratedResp>(`/v1/assets/curated?list=${encodeURIComponent(list)}`);
}

// --- /v1/assets?limit&offset&sort=liquidity|volume24h|... (paged registry of assets) ---
export function fetchAssets(opts: { limit?: number; offset?: number; sort?: string } = {}): Promise<AssetsListResp> {
  const p = new URLSearchParams();
  if (opts.limit) p.set("limit", String(opts.limit));
  if (opts.offset) p.set("offset", String(opts.offset));
  if (opts.sort) p.set("sort", opts.sort);
  const qs = p.toString();
  return getJson<AssetsListResp>(`/v1/assets${qs ? `?${qs}` : ""}`);
}

/** Handy default universe for the heatmap: curated majors + memes + trending (deduped by assetId). */
export async function fetchHeatmapUniverse(): Promise<{
  assets: Asset[];
  source: string[];
}> {
  const sources: string[] = [];
  const byId = new Map<string, Asset>();
  try {
    const t = await fetchTrending();
    sources.push("trending");
    for (const a of t.trending) if (!byId.has(a.assetId)) byId.set(a.assetId, a);
  } catch {
    /* trending optional */
  }
  for (const list of ["majors", "lsts", "memes"] as const) {
    try {
      const c = await fetchCurated(list);
      sources.push(`curated:${list}`);
      for (const a of c.assets) if (!byId.has(a.assetId)) byId.set(a.assetId, a);
    } catch {
      /* curated list optional */
    }
  }
  // Trending first (ranked), then curated, deduped.
  return { assets: [...byId.values()], source: sources };
}

/** Build a mint→{symbol,usd} map from the registry for balance enrichment. */
export function indexRegistry(resp: TokensResp | null | undefined): Map<string, { symbol: string; usd: number }> {
  const m = new Map<string, { symbol: string; usd: number }>();
  if (!resp?.data) return m;
  for (const t of resp.data) {
    const sym = t.metadata?.symbol;
    const usd = typeof t.price?.usd === "number" && Number.isFinite(t.price.usd) ? (t.price.usd as number) : NaN;
    if (sym || Number.isFinite(usd)) m.set(t.mint, { symbol: sym ?? "?", usd });
  }
  return m;
}

let registryOnce: Promise<TokensResp> | null = null;
/** /api/tokens is ~4 MB — fetch it at most once per page session (for wallet symbol/price enrichment). */
export function tokensRegistryOnce(): Promise<TokensResp> {
  if (!registryOnce) {
    registryOnce = fetchTokens().catch((e) => {
      registryOnce = null;
      throw e;
    });
  }
  return registryOnce;
}

export type { RegistryToken };
