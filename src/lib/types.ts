// Typed shapes — mapped 1:1 from live api.cookiescan.io responses (2026-09-04).
// Raw captured responses: /home/odroid/cookie-recon/*.json

export interface ApiStatus {
  status: string;
  cookUsd: number;
  /** Explorer's canonical-COOK label — 36Zr…, the Solana-side sCOOK identity. Not an on-chain Cookie mint. */
  cookMint: string;
  activeTokens: number;
  totalTokens: number;
  metadataCached: number;
  timestamp: number;
}

export interface CookPriceData {
  mint: string;
  name: string;
  symbol: string;
  priceUsd: number;
  lastUpdated: number;
}
export interface CookPriceResp {
  success: boolean;
  data: CookPriceData;
}

export interface TokenMetadata {
  name?: string;
  symbol?: string;
  logo?: string | null;
  decimals?: number;
  description?: string;
  updateAuthority?: string;
}
export interface TokenPrice {
  usd?: number;
  native?: number;
  change24h?: number;
}
export interface TokenMarketData {
  volume24h?: number;
  volumeChange24h?: number;
  liquidity?: number;
  marketCap?: number;
  supply?: number;
  holderCount?: number;
}
export interface RegistryToken {
  mint: string;
  metadata?: TokenMetadata;
  price?: TokenPrice;
  marketData?: TokenMarketData;
  lastUpdated?: string;
}
export interface TokensResp {
  success: boolean;
  cookUsd: number;
  count: number;
  data: RegistryToken[];
}

export interface PriceRespData {
  mint: string;
  metadata?: TokenMetadata;
  price?: TokenPrice;
  marketData?: TokenMarketData;
  lastUpdated?: string;
}
export interface PriceResp {
  success: boolean;
  data: PriceRespData;
}

export interface MarketSide {
  mint: string;
  symbol?: string;
  amount?: number;
  priceUsd?: number;
}
export interface Market {
  marketId: string;
  /** venue label, e.g. "COOKIEBOX DAMM", "COOKIESWAP BAMM", "COOKIESWAP CPAMM" */
  type: string;
  baseToken: MarketSide;
  quoteToken: MarketSide;
  liquidityUsd?: number;
  liquidityDisplay?: string;
}
export interface MarketsResp {
  success: boolean;
  mint?: string;
  resolvedAs?: "mint" | "symbol";
  symbol?: string;
  name?: string;
  cookUsd: number;
  marketCount: number;
  markets: Market[];
}

// --- /v1 assets (assetId-grouped, with variants + stats) ---
export interface AssetStats {
  price?: number | null;
  priceInCook?: number | null;
  liquidity?: number | null;
  volume24hUSD?: number | null;
  marketCap?: number | null;
  priceChange24hPercent?: number | null;
  holder?: number | null;
  supply?: number | null;
}
export interface AssetVariantMarket {
  source?: string;
  price?: number;
  priceInCook?: number;
  liquidity?: number;
  volume24hUSD?: number;
  volumeChange24hPercent?: number;
  marketCap?: number;
  priceChange24hPercent?: number;
  supply?: number;
  holder?: number;
  decimals?: number;
  logoURI?: string;
  poolCount?: number;
  lastFetchedAt?: number;
}
export interface AssetVariant {
  variantId: string;
  mint: string;
  symbol: string;
  name: string;
  kind?: string;
  tags?: string[];
  liquidityTier?: string;
  market?: AssetVariantMarket;
}
export interface Asset {
  rank?: number;
  assetId: string;
  name: string;
  symbol: string;
  category?: string | null;
  curated?: boolean;
  imageUrl?: string | null;
  description?: string | null;
  links?: { website?: string } | null;
  liquidityTier?: string;
  lists?: string[];
  stats: AssetStats;
  variantCount?: number;
  primaryVariant: AssetVariant;
  variants?: AssetVariant[];
}
export interface TrendingResp {
  count: number;
  trending: Asset[];
}
export interface SearchResp {
  query: string;
  category?: string | null;
  count: number;
  results: Asset[];
  denylisted?: string[];
}
export interface CuratedResp {
  listId: string;
  name: string;
  count: number;
  assets: Asset[];
}
export interface AssetsListResp {
  total: number;
  limit: number;
  offset: number;
  sort: string;
  assets: Asset[];
}
