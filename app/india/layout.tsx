import { UpstoxProvider } from '@/lib/upstox-tick-data';
import type { ReactNode } from 'react';

export default function IndiaLayout({ children }: { children: ReactNode }) {
  return (
    <UpstoxProvider>
      {children}
    </UpstoxProvider>
  );
}
