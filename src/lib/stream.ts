// Resilient WebSocket client for Cookie Chain Solana pubsub (wss://rpc.cookiescan.io).
// Verified live: slotSubscribe → {"jsonrpc":"2.0","result":39941,"id":1} in ~1.2 s (2026-09-04).
//
// WHY this endpoint: the explorer docs & bundle list WebSocket: wss://rpc.cookiescan.io. The old
// "wss://wss.cookiescan.io/stream" host is broken (vhost 301s to bakedbazaar.art, bad cert) and no
// `/stream` feed exists anywhere in the explorer app — see docs/evidence.md.
//
// Strategy: generic JSON-RPC pubsub with auto-reconnect (exp backoff + jitter). Subscriptions are
// replayed after every reconnect. If the WS cannot be established at all, the caller may fall back
// to REST polling mode (the app surfaces this in the ticker badge).

export type ChainStreamStatus = "idle" | "connecting" | "open" | "reconnecting" | "closed";

type Handler = (payload: unknown, subscription: number, method: string) => void;

interface Sub {
  method: string;
  params: unknown[];
  handler: Handler;
  subId?: number;
}

export class ChainStream {
  private ws: WebSocket | null = null;
  private subs = new Map<number, Sub>(); // key = request id while pending, subscription id once assigned
  private pending = new Map<number, Sub>(); // request id → sub awaiting ack
  private nextId = 1;
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private manualClose = false;
  private statusListeners = new Set<(s: ChainStreamStatus) => void>();
  private msgListeners = new Set<(msg: unknown) => void>();
  private _status: ChainStreamStatus = "idle";
  /** Count of notifications received (activity tick). */
  notifications = 0;

  constructor(
    private url: string,
    private opts: { maxAttempts?: number } = {},
  ) {}

  get status() {
    return this._status;
  }

  onStatus(fn: (s: ChainStreamStatus) => void): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }
  onMessage(fn: (msg: unknown) => void): () => void {
    this.msgListeners.add(fn);
    return () => this.msgListeners.delete(fn);
  }

  private setStatus(s: ChainStreamStatus) {
    this._status = s;
    for (const fn of this.statusListeners) fn(s);
  }

  connect() {
    this.manualClose = false;
    this.open();
  }

  private open() {
    this.setStatus(this.attempts === 0 ? "connecting" : "reconnecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.attempts = 0;
      this.setStatus("open");
      this.replaySubs();
    };
    ws.onmessage = (ev) => {
      let msg: unknown;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      this.handleMessage(msg);
    };
    ws.onerror = () => {
      /* close follows; errors alone are uninformative across runtimes */
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.manualClose) {
        this.setStatus("closed");
        return;
      }
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.manualClose) return;
    const max = this.opts.maxAttempts ?? 12;
    if (this.attempts >= max) {
      // Give up this cycle: surface "closed" (degraded mode) but keep probing every 45 s so a
      // recovered network reconnects without a page reload.
      this.setStatus("closed");
      this.timer = setTimeout(() => {
        this.attempts = 0;
        this.open();
      }, 45_000);
      return;
    }
    const base = Math.min(30_000, 1_000 * 2 ** Math.min(5, this.attempts));
    const jitter = Math.random() * 400;
    const delay = base + jitter;
    this.attempts += 1;
    this.timer = setTimeout(() => this.open(), delay);
  }

  private handleMessage(msg: unknown) {
    const m = msg as {
      id?: number;
      result?: unknown;
      method?: string;
      params?: { subscription?: number; result?: unknown };
      error?: { message?: string };
    };
    if (m.id !== undefined) {
      // Response to a subscribe/unsubscribe request.
      const sub = this.pending.get(m.id);
      if (!sub) return;
      this.pending.delete(m.id);
      if (m.error) {
        this.subs.delete(m.id);
        return;
      }
      const subId = Number(m.result);
      sub.subId = subId;
      // Move from request-keyed to subscription-keyed.
      this.subs.delete(m.id);
      this.subs.set(subId, sub);
      return;
    }
    // Notification
    if (m.method && m.params && m.params.subscription !== undefined) {
      this.notifications += 1;
      const sub = this.subs.get(m.params.subscription);
      if (sub) sub.handler(m.params.result, m.params.subscription, m.method);
      for (const fn of this.msgListeners) fn(msg);
    }
  }

  /** Subscribe to a pubsub method (slotSubscribe, accountSubscribe, logsSubscribe, …). */
  subscribe(method: string, params: unknown[], handler: Handler): number {
    const id = this.nextId++;
    const sub: Sub = { method, params, handler };
    this.pending.set(id, sub);
    if (this.ws?.readyState === WebSocket.OPEN) this.sendSub(id, sub);
    return id;
  }

  unsubscribe(id: number) {
    const sub = this.subs.get(id) ?? this.pending.get(id);
    if (!sub) return;
    this.subs.delete(id);
    this.pending.delete(id);
    if (sub.subId !== undefined && this.ws?.readyState === WebSocket.OPEN) {
      const method = sub.method.replace(/Subscribe$/, "Unsubscribe");
      this.ws.send(JSON.stringify({ jsonrpc: "2.0", id: this.nextId++, method, params: [sub.subId] }));
    }
  }

  private replaySubs() {
    for (const [id, sub] of this.subs) {
      // Only true subscriptions (with subId assigned) need replaying on reconnect.
      if (sub.subId !== undefined) this.sendSub(id, sub);
    }
  }

  private sendSub(id: number, sub: Sub) {
    this.ws?.send(JSON.stringify({ jsonrpc: "2.0", id, method: sub.method, params: sub.params }));
  }

  close() {
    this.manualClose = true;
    if (this.timer) clearTimeout(this.timer);
    this.ws?.close();
    this.ws = null;
    this.setStatus("closed");
  }
}

let _shared: ChainStream | null = null;
/** Process-wide shared stream (module singleton survives HMR poorly — callers use React refs; this is for scripts). */
export function sharedStream(url: string): ChainStream {
  if (!_shared) _shared = new ChainStream(url);
  return _shared;
}
