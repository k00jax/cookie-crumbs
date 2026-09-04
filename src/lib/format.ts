// Small number/date formatters for the terminal UI.

export function fmtUsd(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n !== 0 && Math.abs(n) < 0.01) return `$${n.toPrecision(2)}`;
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: n >= 1000 ? 0 : digits,
  })}`;
}

export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n !== 0 && Math.abs(n) < 0.01) return n.toPrecision(3);
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function fmtCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(n);
}

export function fmtChange(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return "—";
  const s = pct > 0 ? "+" : "";
  return `${s}${pct.toFixed(2)}%`;
}

export function changeColor(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct) || pct === 0)
    return "text-zinc-400";
  return pct > 0 ? "text-emerald-400" : "text-rose-400";
}

export function fmtTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-US", { hour12: false });
}

export function shortAddr(addr: string, lead = 4, tail = 4): string {
  if (addr.length <= lead + tail + 1) return addr;
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`;
}

export async function copyText(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    return false;
  }
}

/** Color scale for heatmap tiles by 24h change %. Literal classes so Tailwind JIT keeps them. */
const HEAT_UP = [
  "bg-zinc-800/60", // 0
  "bg-emerald-900/25",
  "bg-emerald-800/35",
  "bg-emerald-700/45",
  "bg-emerald-600/55",
];
const HEAT_DOWN = [
  "bg-zinc-800/60", // 0
  "bg-rose-900/25",
  "bg-rose-800/35",
  "bg-rose-700/45",
  "bg-rose-600/55",
];
export function heatColor(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct) || pct === 0)
    return HEAT_UP[0];
  const mag = Math.min(1, Math.abs(pct) / 20); // 20%+ = full saturation
  const idx = 1 + Math.min(3, Math.floor(mag * 4));
  return pct > 0 ? HEAT_UP[idx] : HEAT_DOWN[idx];
}
