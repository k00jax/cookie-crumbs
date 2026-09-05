"use client";

// Swap panel — sell native COOK for any Cookie Chain token via the Cookiebox aggregator.
// Quotes are pure reads (CORS-open) and work unfunded. Building/signing the tx only happens for a
// connected wallet with a COOK balance and is always user-initiated (no auto-sign).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { AggNoRouteError, buildAggSwapTx, fetchAggQuote, fetchTokenSearch } from "@/lib/api";
import { BRIDGE_URL, COOK_DECIMALS, COOK_MINT, EXPLORER_URL } from "@/lib/constants";
import { fmtNum, fmtUsd } from "@/lib/format";
import type { AggQuote, Asset, RegistryToken } from "@/lib/types";
import { Card, ErrorState, Skeleton } from "./ui";
import { TokenImage } from "./TokenImage";

const SLIPPAGE_OPTIONS_PCT = [0.5, 1, 2, 5];

interface OutputToken {
  mint: string;
  symbol: string;
  name?: string;
  decimals: number;
  logo?: string | null;
  usd?: number | null;
}

function parseUsd(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toOutputToken(r: RegistryToken): OutputToken | null {
  if (!r.mint || !r.metadata?.decimals) return null;
  if (r.mint === COOK_MINT) return null; // can't swap COOK -> COOK
  return {
    mint: r.mint,
    symbol: r.metadata.symbol ?? r.mint.slice(0, 6),
    name: r.metadata.name,
    decimals: r.metadata.decimals,
    logo: r.metadata.logo ?? null,
    usd: parseUsd(r.price?.usd),
  };
}

function rawToUi(raw: string, decimals: number): number {
  try {
    return Number(BigInt(raw)) / 10 ** decimals;
  } catch {
    return 0;
  }
}

type QuoteState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ok"; quote: AggQuote }
  | { phase: "noroute" }
  | { phase: "error"; message: string };

type TxState =
  | { phase: "idle" }
  | { phase: "building" }
  | { phase: "signing" }
  | { phase: "confirming"; sig: string }
  | { phase: "done"; sig: string }
  | { phase: "error"; message: string };

export function SwapPanel({ assets, cookUsd }: { assets: Asset[]; cookUsd: number | null }) {
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [cookBalance, setCookBalance] = useState<number | null>(null);
  const [output, setOutput] = useState<OutputToken | null>(null);
  const [amount, setAmount] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OutputToken[]>([]);
  const [searching, setSearching] = useState(false);
  const [slippagePct, setSlippagePct] = useState(1);
  const [quote, setQuote] = useState<QuoteState>({ phase: "idle" });
  const [tx, setTx] = useState<TxState>({ phase: "idle" });
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pub = publicKey?.toBase58() ?? null;

  // Wallet COOK balance (native lamports).
  useEffect(() => {
    let alive = true;
    if (!publicKey) {
      setCookBalance(null);
      return;
    }
    const load = async () => {
      try {
        const bal = await connection.getBalance(publicKey, "confirmed");
        if (alive) setCookBalance(bal / 1e9);
      } catch {
        if (alive) setCookBalance(null);
      }
    };
    void load();
    const t = setInterval(load, 5_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [publicKey, connection]);

  // Debounced registry search for the output token.
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetchTokenSearch(query.trim());
        const out = (r.data ?? []).map(toOutputToken).filter((x): x is OutputToken => x !== null).slice(0, 10);
        setResults(out);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const quickPicks = useMemo(() => assets.slice(0, 12), [assets]);

  const amountNum = Number.parseFloat(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const rawAmount = amountValid ? BigInt(Math.floor(amountNum * 10 ** COOK_DECIMALS)).toString() : null;

  const fetchQuoteNow = useCallback(async () => {
    if (!output || !rawAmount) {
      setQuote({ phase: "idle" });
      return;
    }
    setQuote({ phase: "loading" });
    try {
      const q = await fetchAggQuote({
        inputMint: COOK_MINT,
        outputMint: output.mint,
        amount: rawAmount,
        slippageBps: Math.round(slippagePct * 100),
        owner: pub,
      });
      setQuote({ phase: "ok", quote: q });
    } catch (e) {
      if (e instanceof AggNoRouteError) setQuote({ phase: "noroute" });
      else setQuote({ phase: "error", message: e instanceof Error ? e.message : "quote failed" });
    }
  }, [output, rawAmount, slippagePct, pub]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void fetchQuoteNow(), output && rawAmount ? 450 : 0);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [fetchQuoteNow, output, rawAmount]);

  const insufficient = connected && cookBalance !== null && amountValid && amountNum > cookBalance;
  const canExecute =
    connected && cookBalance !== null && cookBalance > 0 && amountValid && !insufficient && quote.phase === "ok";

  const executeSwap = async () => {
    if (!canExecute || !output || !rawAmount || !pub || quote.phase !== "ok") return;
    setTx({ phase: "building" });
    try {
      const built = await buildAggSwapTx({
        inputMint: COOK_MINT,
        outputMint: output.mint,
        amount: rawAmount,
        slippageBps: Math.round(slippagePct * 100),
        owner: pub,
      });
      const raw = Buffer.from(built.transactionBase64, "base64");
      let txAny: Transaction | VersionedTransaction;
      try {
        txAny = Transaction.from(raw);
      } catch {
        txAny = VersionedTransaction.deserialize(raw);
      }
      setTx({ phase: "signing" });
      const signature = await sendTransaction(txAny, connection, { skipPreflight: false });
      setTx({ phase: "confirming", sig: signature });
      await connection.confirmTransaction({ signature, blockhash: built.blockhash, lastValidBlockHeight: built.lastValidBlockHeight }, "confirmed");
      setTx({ phase: "done", sig: signature });
    } catch (e) {
      setTx({ phase: "error", message: e instanceof Error ? e.message : "transaction failed" });
    }
  };

  const quoteOk = quote.phase === "ok" ? quote.quote : null;
  const outUsd =
    quoteOk && output ? rawToUi(quoteOk.netOutAmount, output.decimals) * (output.usd ?? 0) : null;

  return (
    <Card title="Swap · sell COOK" right={<span className="text-xs text-zinc-500">Cookiebox aggregator · quotes are live</span>}>
      <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-2">
        {/* Left: inputs */}
        <div className="space-y-3">
          {/* You pay */}
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="uppercase tracking-wider text-zinc-500">You pay</span>
              <span className="text-zinc-400">
                balance{" "}
                <span className={insufficient ? "text-rose-400" : "font-mono text-zinc-200"}>
                  {connected && cookBalance !== null ? cookBalance.toLocaleString("en-US", { maximumFractionDigits: 6 }) : "—"}
                </span>{" "}
                COOK
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="w-full bg-transparent font-mono text-2xl font-bold text-white outline-none placeholder:text-zinc-700"
              />
              <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-800 px-2.5 py-1.5 text-sm font-semibold text-amber-300">
                <span aria-hidden>🍪</span> COOK
              </span>
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-zinc-500">
              <span>≈ {amountValid && cookUsd ? fmtUsd(amountNum * cookUsd) : "—"}</span>
              {connected && cookBalance !== null && amountValid && (
                <button
                  onClick={() => setAmount(String(cookBalance))}
                  className="text-amber-300/80 hover:text-amber-200"
                >
                  max
                </button>
              )}
            </div>
          </div>

          {/* You receive */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="uppercase tracking-wider text-zinc-500">You receive</span>
              {output && (
                <button onClick={() => setOutput(null)} className="text-[11px] text-zinc-500 hover:text-rose-300">
                  ✕ clear
                </button>
              )}
            </div>
            {output ? (
              <div className="flex items-center gap-2">
                <TokenImage src={output.logo} alt={output.symbol} className="h-8 w-8 rounded-full bg-zinc-800 object-cover" />
                <div className="min-w-0">
                  <div className="font-mono text-2xl font-bold text-white">
                    {quoteOk ? rawToUi(quoteOk.netOutAmount, output.decimals).toLocaleString("en-US", { maximumFractionDigits: output.decimals > 6 ? 6 : output.decimals }) : "—"}
                  </div>
                  <div className="truncate text-xs text-zinc-500">
                    {output.symbol} · {output.name ?? output.mint.slice(0, 12)}…
                  </div>
                </div>
                <div className="ml-auto text-right text-xs text-zinc-500">
                  <div>≈ {quoteOk && output.usd != null ? fmtUsd(outUsd) : "—"}</div>
                  <div className="font-mono text-[10px]">{`${output.mint.slice(0, 5)}…${output.mint.slice(-5)}`}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-zinc-600">
                search a token to buy ↓
              </div>
            )}
          </div>

          {/* Token search */}
          <div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search token (symbol or name)…"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-amber-400/50"
            />
            {!query && quickPicks.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {quickPicks.map((a) => (
                  <button
                    key={a.assetId}
                    onClick={() => {
                      setQuery(a.symbol);
                    }}
                    className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-400 transition hover:border-amber-400/40 hover:text-amber-300"
                  >
                    {a.symbol}
                  </button>
                ))}
              </div>
            )}
            {searching && <div className="mt-2 text-xs text-zinc-600">searching…</div>}
            {!searching && results.length > 0 && (
              <ul className="mt-2 max-h-44 divide-y divide-zinc-800/60 overflow-y-auto rounded-lg border border-zinc-800/70 bg-zinc-950/70">
                {results.map((r) => (
                  <li key={r.mint}>
                    <button
                      onClick={() => {
                        setOutput(r);
                        setQuery("");
                        setResults([]);
                      }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition hover:bg-zinc-800/50"
                    >
                      <TokenImage src={r.logo} alt={r.symbol} className="h-5 w-5 rounded-full bg-zinc-800 object-cover" />
                      <span className="font-semibold text-zinc-200">{r.symbol}</span>
                      <span className="truncate text-zinc-500">{r.name}</span>
                      <span className="ml-auto font-mono text-[10px] text-zinc-600">{r.decimals} dp</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Slippage */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="mr-1 uppercase tracking-wider text-zinc-500">Slippage</span>
            {SLIPPAGE_OPTIONS_PCT.map((p) => (
              <button
                key={p}
                onClick={() => setSlippagePct(p)}
                className={`rounded-md border px-2 py-1 font-mono transition ${
                  slippagePct === p
                    ? "border-amber-400/70 bg-amber-400/10 text-amber-300"
                    : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>

        {/* Right: route + execute */}
        <div className="space-y-3">
          {quote.phase === "loading" && <Skeleton className="h-28 w-full rounded-xl" />}
          {quote.phase === "idle" && (
            <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-600">
              Enter an amount and pick a token — quotes are live &amp; free.
            </div>
          )}
          {quote.phase === "noroute" && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-xs text-amber-200/90">
              No route found for COOK → {output?.symbol ?? "token"} right now. Try another token or amount.
            </div>
          )}
          {quote.phase === "error" && <ErrorState compact message={quote.message} onRetry={() => void fetchQuoteNow()} />}
          {quoteOk && output && (
            <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
              <div className="flex items-baseline justify-between">
                <span className="text-zinc-500">Est. receive</span>
                <span className="font-mono text-base font-bold text-emerald-300">
                  {rawToUi(quoteOk.netOutAmount, output.decimals).toLocaleString("en-US", { maximumFractionDigits: 6 })} {output.symbol}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-zinc-500">Rate</span>
                <span className="font-mono text-zinc-300">
                  1 COOK ≈{" "}
                  {rawAmount && BigInt(rawAmount) > 0n
                    ? (rawToUi(quoteOk.netOutAmount, output.decimals) / (Number(BigInt(rawAmount)) / 10 ** COOK_DECIMALS)).toPrecision(5)
                    : "—"}{" "}
                  {output.symbol}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-zinc-500">Min receive ({slippagePct}% slip)</span>
                <span className="font-mono text-zinc-300">
                  {rawToUi(quoteOk.minOutAmount, output.decimals).toLocaleString("en-US", { maximumFractionDigits: 6 })} {output.symbol}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-zinc-500">Price impact</span>
                <span className="font-mono text-zinc-300">
                  {quoteOk.priceImpactPct != null && Number.isFinite(quoteOk.priceImpactPct)
                    ? `${quoteOk.priceImpactPct.toFixed(2)}%`
                    : "—"}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-zinc-500">Fee</span>
                <span className="font-mono text-zinc-300">{quoteOk.feePct > 0 ? `${quoteOk.feePct}%` : "0%"}</span>
              </div>
              {quoteOk.isMultiHop && (
                <div className="rounded bg-zinc-900 px-2 py-1 text-[10px] text-amber-300/80">multi-hop route</div>
              )}
              <div className="border-t border-zinc-800/70 pt-2">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-600">Route</div>
                <ul className="space-y-1">
                  {quoteOk.segments.map((s, i) => (
                    <li key={`${s.pool}-${i}`} className="flex items-center justify-between font-mono text-[10px] text-zinc-500">
                      <span>
                        {s.venue}
                        {s.percentage != null && s.percentage > 0 ? ` ${s.percentage}%` : ""}
                      </span>
                      <span className="truncate pl-2 text-zinc-600">{s.pool.slice(0, 8)}…{s.pool.slice(-6)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Execute area */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
            {tx.phase === "done" && (
              <div className="mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-300">
                ✅ Transaction confirmed —{" "}
                <a href={`${EXPLORER_URL}/tx/${tx.sig}`} target="_blank" rel="noreferrer" className="underline">
                  view on cookiescan.io ↗
                </a>
              </div>
            )}
            {tx.phase === "error" && (
              <div className="mb-2 rounded-lg border border-rose-500/25 bg-rose-500/5 p-2 text-xs text-rose-300">{tx.message}</div>
            )}
            {!connected ? (
              <div className="text-center text-xs text-zinc-500">Connect a wallet to swap — reads stay free.</div>
            ) : connected && cookBalance !== null && cookBalance <= 0 ? (
              <div className="text-center text-xs text-amber-200/90">
                Wallet balance is 0 COOK — bridge a little to test (no faucet exists).{" "}
                <a href={BRIDGE_URL} target="_blank" rel="noreferrer" className="underline">
                  bridge.cookiescan.io ↗
                </a>
              </div>
            ) : insufficient ? (
              <div className="text-center text-xs text-rose-300">Amount exceeds your COOK balance.</div>
            ) : (
              <button
                onClick={() => void executeSwap()}
                disabled={!canExecute || tx.phase === "building" || tx.phase === "signing" || tx.phase === "confirming"}
                className="w-full rounded-lg bg-amber-400 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {tx.phase === "building"
                  ? "Building tx…"
                  : tx.phase === "signing"
                    ? "Sign in wallet…"
                    : tx.phase === "confirming"
                      ? "Confirming on-chain…"
                      : canExecute
                        ? `Swap ${amountNum ? fmtNum(amountNum) : ""} COOK → ${output?.symbol ?? ""}`
                        : "Enter amount + pick a token"}
              </button>
            )}
            {connected && cookBalance !== null && cookBalance > 0 && !amountValid && (
              <p className="mt-1.5 text-center text-[10px] text-zinc-600">
                Enter an amount above. Every tx is user-initiated and signed only by you.
              </p>
            )}
          </div>

          <p className="text-center text-[10px] leading-relaxed text-zinc-600">
            Quotes from Cookiebox aggregator (agg.cookiebox.app). Simulation, signing, and sending all
            happen in your wallet on your tap — nothing auto-signs, no keys on this server.
          </p>
        </div>
      </div>
    </Card>
  );
}
