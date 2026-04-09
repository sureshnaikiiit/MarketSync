'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useUpstoxStream } from './useUpstoxStream';
import type { SubscriptionMode, UpstoxStreamState, UpstoxTick } from './types';

interface UpstoxContextValue extends UpstoxStreamState {
  subscribe: (keys: string[], mode?: SubscriptionMode) => void;
  unsubscribe: (keys: string[]) => void;
  connect: () => void;
  getTick: (key: string) => UpstoxTick | undefined;
}

const UpstoxContext = createContext<UpstoxContextValue | null>(null);

interface UpstoxProviderProps {
  children: ReactNode;
  instrumentKeys?: string[];
  mode?: SubscriptionMode;
}

export function UpstoxProvider({ children, instrumentKeys, mode }: UpstoxProviderProps) {
  const stream = useUpstoxStream({ instrumentKeys, mode });

  return (
    <UpstoxContext.Provider
      value={{ ...stream, getTick: (key) => stream.ticks[key] }}
    >
      {children}
    </UpstoxContext.Provider>
  );
}

export function useUpstox(): UpstoxContextValue {
  const ctx = useContext(UpstoxContext);
  if (!ctx) throw new Error('useUpstox must be used inside <UpstoxProvider>');
  return ctx;
}
