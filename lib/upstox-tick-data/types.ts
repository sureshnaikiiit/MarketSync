// ─── Upstox Market Data Feed V3 types ────────────────────────────────────────
// Docs: https://upstox.com/developer/api-documentation/v3/get-market-data-feed

export type UpstoxConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export type SubscriptionMode = 'ltpc' | 'full' | 'option_greeks' | 'full_d30';

// ─── Decoded protobuf shapes ──────────────────────────────────────────────────

export interface UpstoxLTPC {
  ltp: number;   // Last Traded Price
  ltt: number;   // Last Traded Time (ms)
  ltq: number;   // Last Traded Quantity
  cp: number;    // Close Price
}

export interface UpstoxQuote {
  bidQ: number;
  bidP: number;
  askQ: number;
  askP: number;
}

export interface UpstoxMarketFullFeed {
  ltpc: UpstoxLTPC;
  marketLevel?: { bidAskQuote: UpstoxQuote[] };
  atp?: number;   // Average Traded Price
  vtt?: number;   // Volume Traded Today
  oi?: number;    // Open Interest
  tbq?: number;   // Total Bid Quantity
  tsq?: number;   // Total Sell Quantity
}

export interface UpstoxFeed {
  ltpc?: UpstoxLTPC;
  fullFeed?: {
    marketFF?: UpstoxMarketFullFeed;
    indexFF?: { ltpc: UpstoxLTPC };
  };
}

export interface UpstoxFeedResponse {
  type: number;         // 0=initial_feed, 1=live_feed, 2=market_info
  feeds: Record<string, UpstoxFeed>;
  currentTs: number;
}

// ─── App-level normalised state ───────────────────────────────────────────────

export interface UpstoxTick {
  instrumentKey: string;
  ltp: number;           // Last Traded Price
  cp: number;            // Previous Close Price
  change: number;        // ltp - cp
  changePct: number;     // % change from close
  bids: { price: number; volume: number }[];
  asks: { price: number; volume: number }[];
  vtt: number;           // Volume
  atp: number;           // Avg Traded Price
  tickTime: number;      // ms timestamp
}

export interface UpstoxStreamState {
  ticks: Record<string, UpstoxTick>;
  status: UpstoxConnectionStatus;
  error: string | null;
  isAuthenticated: boolean;
}

export interface UpstoxStreamOptions {
  instrumentKeys?: string[];
  mode?: SubscriptionMode;
}

// ─── WebSocket subscription messages ─────────────────────────────────────────

export interface UpstoxSubscribeMessage {
  guid: string;
  method: 'sub' | 'unsub' | 'change_mode';
  data: {
    mode: SubscriptionMode;
    instrumentKeys: string[];
  };
}
