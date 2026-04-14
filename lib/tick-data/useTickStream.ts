'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  FeedType,
  OrderBook,
  OrderBookData,
  PricePoint,
  ServerResponse,
  Tick,
  TickQuoteData,
  TickStreamOptions,
  TickStreamState,
} from './types';

const CMD_HEARTBEAT_REQ  = 22000;
const CMD_HEARTBEAT_RESP = 22001;
const CMD_SUBSCRIBE      = 22002;
const CMD_TICK_QUOTE     = 22998;
const CMD_ORDER_BOOK     = 22999;

const HEARTBEAT_INTERVAL_MS  = 10_000;
const DEFAULT_RECONNECT_MS   = 3_000;
const MAX_RECONNECT_MS       = 30_000; // cap backoff at 30 s
const DEFAULT_MAX_ATTEMPTS   = 8;      // give up after 8 tries
const DEFAULT_DEPTH          = 5;
const MAX_HISTORY            = 300; // points per symbol

function buildUrl(token: string, feedType: FeedType): string {
  const base =
    feedType === 'stocks'
      ? 'wss://quote.alltick.co/quote-stock-b-ws-api'
      : 'wss://quote.alltick.co/quote-b-ws-api';
  return `${base}?token=${encodeURIComponent(token)}`;
}

let seqCounter = 1;
function nextSeq() { return seqCounter++; }
function makeTrace() { return `ms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

export function useTickStream(options: TickStreamOptions): TickStreamState & {
  subscribe: (symbols: string[]) => void;
  unsubscribe: (symbols: string[]) => void;
} {
  const {
    token,
    feedType = 'forex-crypto',
    symbols = [],
    depthLevel = DEFAULT_DEPTH,
    reconnectDelay = DEFAULT_RECONNECT_MS,
    maxReconnectAttempts = DEFAULT_MAX_ATTEMPTS,
  } = options;

  const [ticks, setTicks]           = useState<Record<string, Tick>>({});
  const [orderBooks, setOrderBooks] = useState<Record<string, OrderBook>>({});
  const [history, setHistory]       = useState<Record<string, PricePoint[]>>({});
  const [status, setStatus]         = useState<TickStreamState['status']>('disconnected');
  const [error, setError]           = useState<string | null>(null);

  const wsRef             = useRef<WebSocket | null>(null);
  const heartbeatRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const isMounted         = useRef(true);
  const subscribedSymbols = useRef<Set<string>>(new Set(symbols));

  const sendRaw = useCallback((payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const sendHeartbeat = useCallback(() => {
    sendRaw({ cmd_id: CMD_HEARTBEAT_REQ, seq_id: nextSeq(), trace: makeTrace(), data: {} });
  }, [sendRaw]);

  const sendSubscription = useCallback((syms: string[]) => {
    if (syms.length === 0) return;
    sendRaw({
      cmd_id: CMD_SUBSCRIBE,
      seq_id: nextSeq(),
      trace: makeTrace(),
      data: { symbol_list: syms.map(code => ({ code, depth_level: depthLevel })) },
    });
  }, [sendRaw, depthLevel]);

  const subscribe = useCallback((syms: string[]) => {
    syms.forEach(s => subscribedSymbols.current.add(s));
    sendSubscription(syms);
  }, [sendSubscription]);

  const unsubscribe = useCallback((syms: string[]) => {
    syms.forEach(s => subscribedSymbols.current.delete(s));
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    let msg: ServerResponse;
    try { msg = JSON.parse(event.data as string) as ServerResponse; }
    catch { return; }
    if (msg.ret !== 200 && msg.ret !== undefined) return;

    switch (msg.cmd_id) {
      case CMD_HEARTBEAT_RESP: break;

      case CMD_TICK_QUOTE: {
        const d = msg.data as TickQuoteData;
        const price = parseFloat(d.price);
        const tickTime = parseInt(d.tick_time, 10);
        const tick: Tick = {
          code: d.code, price, volume: parseFloat(d.volume),
          turnover: d.turnover != null ? parseFloat(d.turnover) : null,
          tradeDirection: d.trade_direction, tickTime,
        };
        setTicks(prev => ({ ...prev, [d.code]: tick }));
        setHistory(prev => {
          const pts = prev[d.code] ?? [];
          const next = [...pts, { time: tickTime, value: price }];
          return { ...prev, [d.code]: next.slice(-MAX_HISTORY) };
        });
        break;
      }

      case CMD_ORDER_BOOK: {
        const d = msg.data as OrderBookData;
        const tickTime = parseInt(d.tick_time, 10);
        const book: OrderBook = {
          code: d.code,
          bids: d.bids.map(l => ({ price: parseFloat(l.price), volume: parseFloat(l.volume) })),
          asks: d.asks.map(l => ({ price: parseFloat(l.price), volume: parseFloat(l.volume) })),
          tickTime,
        };
        // Track mid-price history from order book
        if (book.bids[0] && book.asks[0]) {
          const mid = (book.bids[0].price + book.asks[0].price) / 2;
          setHistory(prev => {
            const pts = prev[d.code] ?? [];
            const next = [...pts, { time: tickTime, value: mid }];
            return { ...prev, [d.code]: next.slice(-MAX_HISTORY) };
          });
        }
        setOrderBooks(prev => ({ ...prev, [d.code]: book }));
        break;
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;

    function stopHeartbeat() {
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    }

    function connect() {
      if (!isMounted.current) return;
      setStatus('connecting');
      setError(null);
      const ws = new WebSocket(buildUrl(token, feedType));
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted.current) { ws.close(); return; }
        reconnectAttempts.current = 0;
        setStatus('connected');
        if (subscribedSymbols.current.size > 0) sendSubscription([...subscribedSymbols.current]);
        stopHeartbeat();
        heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
      };
      ws.onmessage = handleMessage;
      ws.onerror = () => { if (!isMounted.current) return; setStatus('error'); setError('WebSocket connection error'); };
      ws.onclose = () => {
        stopHeartbeat();
        if (!isMounted.current) return;
        const exhausted = maxReconnectAttempts > 0 && reconnectAttempts.current >= maxReconnectAttempts;
        if (exhausted) { setStatus('disconnected'); return; }
        // Exponential backoff: 3s → 6s → 12s → 24s → 30s (capped)
        const delay = Math.min(reconnectDelay * Math.pow(2, reconnectAttempts.current), MAX_RECONNECT_MS);
        reconnectAttempts.current += 1;
        setStatus('connecting');
        reconnectTimer.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      isMounted.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      stopHeartbeat();
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, feedType, reconnectDelay, maxReconnectAttempts]);

  return { ticks, orderBooks, history, status, error, subscribe, unsubscribe };
}
