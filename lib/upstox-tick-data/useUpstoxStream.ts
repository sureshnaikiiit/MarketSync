'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getDecoder } from './proto';
import type {
  SubscriptionMode,
  UpstoxConnectionStatus,
  UpstoxFeedResponse,
  UpstoxStreamOptions,
  UpstoxTick,
} from './types';

function makeGuid() {
  return `ms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sendBinary(ws: WebSocket, payload: unknown) {
  const buf = new TextEncoder().encode(JSON.stringify(payload));
  ws.send(buf);
}

function normaliseFeed(
  instrumentKey: string,
  feed: UpstoxFeedResponse['feeds'][string],
  currentTs: number,
): UpstoxTick | null {
  // LTPC-only mode
  if (feed.ltpc) {
    const { ltp, cp, ltt } = feed.ltpc;
    return {
      instrumentKey,
      ltp, cp,
      change: ltp - cp,
      changePct: cp !== 0 ? ((ltp - cp) / cp) * 100 : 0,
      bids: [], asks: [],
      vtt: 0, atp: 0,
      tickTime: Number(ltt) || currentTs,
    };
  }

  // Full feed mode
  const mff = feed.fullFeed?.marketFF;
  if (mff?.ltpc) {
    const { ltp, cp, ltt } = mff.ltpc;
    const quotes = mff.marketLevel?.bidAskQuote ?? [];
    return {
      instrumentKey,
      ltp, cp,
      change: ltp - cp,
      changePct: cp !== 0 ? ((ltp - cp) / cp) * 100 : 0,
      bids: quotes.map(q => ({ price: q.bidP, volume: Number(q.bidQ) })),
      asks: quotes.map(q => ({ price: q.askP, volume: Number(q.askQ) })),
      vtt: Number(mff.vtt ?? 0),
      atp: mff.atp ?? 0,
      tickTime: Number(ltt) || currentTs,
    };
  }

  // Index feed
  const iff = feed.fullFeed?.indexFF;
  if (iff?.ltpc) {
    const { ltp, cp, ltt } = iff.ltpc;
    return {
      instrumentKey,
      ltp, cp,
      change: ltp - cp,
      changePct: cp !== 0 ? ((ltp - cp) / cp) * 100 : 0,
      bids: [], asks: [],
      vtt: 0, atp: 0,
      tickTime: Number(ltt) || currentTs,
    };
  }

  return null;
}

export function useUpstoxStream(options: UpstoxStreamOptions = {}) {
  const { instrumentKeys = [], mode = 'full' } = options;

  const [ticks, setTicks]                   = useState<Record<string, UpstoxTick>>({});
  const [status, setStatus]                 = useState<UpstoxConnectionStatus>('idle');
  const [error, setError]                   = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const wsRef             = useRef<WebSocket | null>(null);
  const reconnectTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted         = useRef(true);
  const subscribedKeys    = useRef<Set<string>>(new Set(instrumentKeys));
  const currentMode       = useRef<SubscriptionMode>(mode);
  const decoderRef        = useRef<((buf: Uint8Array) => unknown) | null>(null);

  // ─── Check auth on mount ────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/upstox/status')
      .then(r => r.json())
      .then((d: { authenticated: boolean }) => {
        if (isMounted.current) setIsAuthenticated(d.authenticated);
      })
      .catch(() => { /* not critical */ });
  }, []);

  // ─── Subscribe / unsubscribe imperatively ───────────────────────────────────
  const subscribe = useCallback((keys: string[], m?: SubscriptionMode) => {
    keys.forEach(k => subscribedKeys.current.add(k));
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      sendBinary(wsRef.current, {
        guid: makeGuid(),
        method: 'sub',
        data: { mode: m ?? currentMode.current, instrumentKeys: keys },
      });
    }
  }, []);

  const unsubscribe = useCallback((keys: string[]) => {
    keys.forEach(k => subscribedKeys.current.delete(k));
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      sendBinary(wsRef.current, {
        guid: makeGuid(),
        method: 'unsub',
        data: { mode: currentMode.current, instrumentKeys: keys },
      });
    }
  }, []);

  // ─── Connect ────────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!isMounted.current) return;

    setStatus('connecting');
    setError(null);

    try {
      // 1. Get authorized WebSocket URL from our server
      const res = await fetch('/api/upstox/ws-url');
      if (!res.ok) {
        const { error: msg } = await res.json() as { error: string };
        throw new Error(msg ?? 'Failed to get WebSocket URL');
      }
      const { url } = await res.json() as { url: string };

      // 2. Lazy-load protobuf decoder
      if (!decoderRef.current) {
        decoderRef.current = await getDecoder();
      }

      // 3. Open WebSocket
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        if (!isMounted.current) { ws.close(); return; }
        setStatus('connected');

        if (subscribedKeys.current.size > 0) {
          sendBinary(ws, {
            guid: makeGuid(),
            method: 'sub',
            data: {
              mode: currentMode.current,
              instrumentKeys: [...subscribedKeys.current],
            },
          });
        }
      };

      ws.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (!isMounted.current || !decoderRef.current) return;
        try {
          const buf = new Uint8Array(event.data);
          const response = decoderRef.current(buf) as UpstoxFeedResponse;

          if (response.type === 2) return; // market_info — ignore for now

          const updates: Record<string, UpstoxTick> = {};
          for (const [key, feed] of Object.entries(response.feeds ?? {})) {
            const tick = normaliseFeed(key, feed, Number(response.currentTs));
            if (tick) updates[key] = tick;
          }

          if (Object.keys(updates).length > 0) {
            setTicks(prev => ({ ...prev, ...updates }));
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onerror = () => {
        if (!isMounted.current) return;
        setStatus('error');
        setError('WebSocket error');
      };

      ws.onclose = () => {
        if (!isMounted.current) return;
        setStatus('disconnected');
        // Reconnect after 5 s
        reconnectTimer.current = setTimeout(() => {
          if (isMounted.current && isAuthenticated) connect();
        }, 5000);
      };
    } catch (err) {
      if (!isMounted.current) return;
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // ─── Auto-connect when authenticated ───────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;

    if (isAuthenticated) connect();

    return () => {
      isMounted.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isAuthenticated, connect]);

  return { ticks, status, error, isAuthenticated, subscribe, unsubscribe, connect };
}
