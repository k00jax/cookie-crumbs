"use client";

// "Set up Nightly" helper modal — exact Cookie Chain network values (from the explorer's own docs,
// verified 2026-09-04). Nightly must be pointed at the custom SVM network before the app can send
// user-initiated txs (reads need no wallet at all).

import { useEffect, useState } from "react";
import {
  BRIDGE_URL,
  EXPLORER_URL,
  NIGHTLY_URL,
  RPC_URL,
  WS_URL,
} from "@/lib/constants";
import { copyText } from "@/lib/format";

function CopyRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
        <div className={`truncate text-sm text-zinc-200 ${mono ? "font-mono" : ""}`}>{value}</div>
      </div>
      <button
        onClick={async () => {
          if (await copyText(value)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }
        }}
        className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition hover:border-zinc-500 hover:text-white"
      >
        {copied ? "✓ copied" : "copy"}
      </button>
    </div>
  );
}

export function NightlySetupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Set up Nightly wallet for Cookie Chain"
    >
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Connect Nightly to Cookie Chain</h2>
            <p className="text-sm text-zinc-400">
              Cookie Chain is an SVM with no chain id — wallets pick the network by RPC URL. Add it
              as a custom network inside Nightly (Settings → Networks).
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-zinc-700 px-2 py-0.5 text-zinc-400 transition hover:text-white"
          >
            ✕
          </button>
        </div>

        <ol className="mt-4 space-y-3 text-sm text-zinc-300">
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/15 font-mono text-xs font-bold text-amber-300">1</span>
            <span>
              Install <a className="text-amber-300 underline underline-offset-2 hover:text-amber-200" href={NIGHTLY_URL} target="_blank" rel="noreferrer">Nightly</a> and create / import the wallet you&apos;ll fund.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/15 font-mono text-xs font-bold text-amber-300">2</span>
            <span>Add the network below, then switch Nightly to it.</span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/15 font-mono text-xs font-bold text-amber-300">3</span>
            <span>Connect here. Balances load over RPC; swaps (later phase) are signed only on your tap.</span>
          </li>
        </ol>

        <div className="mt-4 space-y-2">
          <CopyRow label="Network name" value="Cookie Chain" mono={false} />
          <CopyRow label="RPC (HTTP)" value={RPC_URL} />
          <CopyRow label="WebSocket" value={WS_URL} />
          <CopyRow label="Symbol / decimals" value="COOK / 9" mono={false} />
          <CopyRow label="Explorer" value={EXPLORER_URL} />
          <CopyRow label="Bridge (funding)" value={BRIDGE_URL} />
        </div>

        <div className="mt-3 rounded-lg border border-zinc-700/70 bg-zinc-800/40 px-3 py-2 text-xs text-zinc-400">
          Tip: Cookie Chain&apos;s network WebSocket is <span className="font-mono">wss://rpc.cookiescan.io</span>.
          The older <span className="font-mono">wss://wss.cookiescan.io</span> hostname is no longer valid, so use the value above.
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <a
            href={BRIDGE_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Fund via bridge →
          </a>
          <button
            onClick={onClose}
            className="rounded-lg bg-amber-400 px-4 py-1.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
