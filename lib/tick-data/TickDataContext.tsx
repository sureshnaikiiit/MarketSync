'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useTickStream } from './useTickStream';
import type { FeedType, OrderBook, Tick, TickStreamState } from './types';

interface TickDataContextValue extends TickStreamState {
  subscribe: (symbols: string[]) => void;
  unsubscribe: (symbols: string[]) => void;
  getTick: (code: string) => Tick | undefined;
  getOrderBook: (code: string) => OrderBook | undefined;
}

const TickDataContext = createContext<TickDataContextValue | null>(null);

interface TickDataProviderProps {
  children: ReactNode;
  /** AllTick API token. Falls back to NEXT_PUBLIC_ALLTICK_TOKEN env var. */
  token?: string;
  feedType?: FeedType;
  /** Symbol codes to subscribe on mount, e.g. ["AAPL.US", "BTC.USD"] */
  symbols?: string[];
  depthLevel?: number;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export function TickDataProvider({
  children,
  token = process.env.NEXT_PUBLIC_ALLTICK_TOKEN ?? '',
  feedType,
  symbols,
  depthLevel,
  reconnectDelay,
  maxReconnectAttempts,
}: TickDataProviderProps) {
  const stream = useTickStream({
    token,
    feedType,
    symbols,
    depthLevel,
    reconnectDelay,
    maxReconnectAttempts,
  });

  return (
    <TickDataContext.Provider
      value={{
        ...stream,
        getTick: (code) => stream.ticks[code],
        getOrderBook: (code) => stream.orderBooks[code],
      }}
    >
      {children}
    </TickDataContext.Provider>
  );
}

export function useTickData(): TickDataContextValue {
  const ctx = useContext(TickDataContext);
  if (!ctx) throw new Error('useTickData must be used inside <TickDataProvider>');
  return ctx;
}
