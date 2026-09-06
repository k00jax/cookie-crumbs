"use client";

// Client error boundary — renders the actual error instead of a blank tree.

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("CHIP error boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-zinc-100">
      <div className="max-w-md rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6">
        <div className="text-2xl" aria-hidden>🍪💥</div>
        <h1 className="mt-2 text-lg font-bold text-rose-300">Something crumbled</h1>
        <p className="mt-2 break-words font-mono text-xs text-zinc-400">{error.message}</p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={reset}
            className="rounded-lg bg-amber-400 px-4 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-amber-300"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
