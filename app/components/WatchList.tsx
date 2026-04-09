'use client';

import { useEffect, useRef } from 'react';
import { useTickData } from '@/lib/tick-data';
import TickRow from './TickRow';

// US stocks — format: "TICKER.US"
const DEFAULT_SYMBOLS = [
  'AAPL.US',  // Apple
  'MSFT.US',  // Microsoft
  'NVDA.US',  // Nvidia
  'TSLA.US',  // Tesla
  'AMZN.US',  // Amazon
  'GOOGL.US', // Alphabet
  'META.US',  // Meta
  'UNH.US',   // UnitedHealth
];

export default function WatchList() {
  const { orderBooks, subscribe } = useTickData();
  const prevMids = useRef<Record<string, number>>({});

  useEffect(() => {
    subscribe(DEFAULT_SYMBOLS);
  }, [subscribe]);

  const rows = DEFAULT_SYMBOLS
    .map(code => orderBooks[code])
    .filter(Boolean);

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-zinc-500">
            <th className="px-4 py-3 text-left">Symbol</th>
            <th className="px-4 py-3 text-right">Best Bid</th>
            <th className="px-4 py-3 text-right">Best Ask</th>
            <th className="px-4 py-3 text-right">Mid</th>
            <th className="px-4 py-3 text-right">Spread</th>
            <th className="px-4 py-3 text-right">Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-zinc-600 text-sm">
                Waiting for order book data…
              </td>
            </tr>
          ) : (
            rows.map(book => {
              const bestBid = book.bids[0];
              const bestAsk = book.asks[0];
              const mid = bestBid && bestAsk ? (bestBid.price + bestAsk.price) / 2 : null;
              const prev = prevMids.current[book.code] ?? null;
              if (mid !== null) prevMids.current[book.code] = mid;
              return <TickRow key={book.code} book={book} prevMid={prev} />;
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
