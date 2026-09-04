"use client";

// Small shared UI atoms: card, skeleton, error/empty states.

export function Card({
  children,
  className = "",
  title,
  right,
}: {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur ${className}`}
    >
      {(title || right) && (
        <header className="flex items-center justify-between gap-2 border-b border-zinc-800/80 px-4 py-2.5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-zinc-800/80 ${className}`} />;
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  compact = false,
}: {
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-start gap-2 p-4 text-sm ${compact ? "text-xs" : ""}`}>
      <div className="flex items-center gap-2 text-rose-400">
        <span aria-hidden>⚠</span>
        <span className="font-medium">Data error</span>
      </div>
      <p className="text-zinc-400 break-words">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 p-6 text-center">
      <div className="text-2xl" aria-hidden>🍪</div>
      <p className="text-sm text-zinc-300">{message}</p>
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
