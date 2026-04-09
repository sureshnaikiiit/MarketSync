'use client';

import { TickDataProvider } from '@/lib/tick-data';
import type { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <TickDataProvider feedType="stocks">
      {children}
    </TickDataProvider>
  );
}
