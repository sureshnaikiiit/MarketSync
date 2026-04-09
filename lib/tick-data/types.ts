// ─── AllTick API types ────────────────────────────────────────────────────────
// Docs: https://en.apis.alltick.co

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/** Asset class determines which AllTick endpoint to use */
export type FeedType = 'stocks' | 'forex-crypto';

// ─── Outgoing messages (client → server) ─────────────────────────────────────

export interface AllTickEnvelope<T = unknown> {
  cmd_id: number;
  seq_id: number;
  trace: string;
  data: T;
}

export interface SubscribeSymbol {
  code: string;
  /** Market depth levels to receive (5 or 10) */
  depth_level: number;
}

export type HeartbeatRequest = AllTickEnvelope<Record<string, never>>;

export type SubscribeRequest = AllTickEnvelope<{ symbol_list: SubscribeSymbol[] }>;

// ─── Incoming messages (server → client) ─────────────────────────────────────

/** cmd_id 22998 — real-time last-trade tick */
export interface TickQuoteData {
  code: string;
  seq: string;
  /** Unix timestamp in milliseconds (as string) */
  tick_time: string;
  /** Last transaction price (as string) */
  price: string;
  /** Last trade volume (as string) */
  volume: string;
  /** Turnover amount; may be absent for forex/metals */
  turnover?: string;
  /** 0 = unknown, 1 = buy, 2 = sell */
  trade_direction: 0 | 1 | 2;
}

/** cmd_id 22999 — order book (best bid/ask depth) */
export interface OrderBookLevel {
  price: string;
  volume: string;
}

export interface OrderBookData {
  code: string;
  seq: string;
  tick_time: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

/** Generic server response envelope */
export interface ServerResponse<T = unknown> {
  ret: number;
  msg: string;
  cmd_id: number;
  seq_id: number;
  trace: string;
  data: T;
}

// ─── App-level state ──────────────────────────────────────────────────────────

/** Normalised tick held in state (prices converted to numbers) */
export interface Tick {
  code: string;
  price: number;
  volume: number;
  turnover: number | null;
  tradeDirection: 0 | 1 | 2;
  tickTime: number; // Unix ms
}

export interface OrderBook {
  code: string;
  bids: { price: number; volume: number }[];
  asks: { price: number; volume: number }[];
  tickTime: number;
}

export interface PricePoint {
  time: number;  // Unix ms
  value: number;
}

export interface TickStreamState {
  ticks: Record<string, Tick>;
  orderBooks: Record<string, OrderBook>;
  history: Record<string, PricePoint[]>;
  status: ConnectionStatus;
  error: string | null;
}

export interface TickStreamOptions {
  token: string;
  feedType?: FeedType;
  symbols?: string[];
  /** Depth levels for order book (default: 5) */
  depthLevel?: number;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}
