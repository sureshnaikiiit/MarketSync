'use client';

import { useEffect, useRef, useState } from 'react';
import type { OrderBook } from '@/lib/tick-data';

interface Props {
  book: OrderBook;
  prevMid: number | null;
}

function fmt(p: number): string {
  return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function fmtVol(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour12: false });
}

export default function TickRow({ book, prevMid }: Props) {
  const bestBid = book.bids[0];
  const bestAsk = book.asks[0];
  const mid     = bestBid && bestAsk ? (bestBid.price + bestAsk.price) / 2 : null;
  const spread  = bestBid && bestAsk ? bestAsk.price - bestBid.price : null;

  const [flashClass, setFlashClass] = useState('');
  const animKey = useRef(0);

  useEffect(() => {
    if (mid === null || prevMid === null || mid === prevMid) return;
    const cls = mid > prevMid ? 'flash-up' : 'flash-down';
    animKey.current += 1;
    setFlashClass('');
    requestAnimationFrame(() => setFlashClass(cls));
  }, [mid, prevMid]);

  const midColor =
    mid === null || prevMid === null || mid === prevMid
      ? 'text-white'
      : mid > prevMid ? 'text-emerald-400' : 'text-red-400';

  return (
    <tr className={`border-b border-white/5 ${flashClass}`}>
      {/* Symbol */}
      <td className="px-4 py-3 font-mono font-semibold text-white tracking-wide">
        {book.code}
      </td>

      {/* Best Bid */}
      <td className="px-4 py-3 font-mono tabular-nums text-right text-emerald-400 font-medium">
        {bestBid ? fmt(bestBid.price) : '—'}
        {bestBid && (
          <span className="ml-1.5 text-xs text-emerald-600">{fmtVol(bestBid.volume)}</span>
        )}
      </td>

      {/* Best Ask */}
      <td className="px-4 py-3 font-mono tabular-nums text-right text-red-400 font-medium">
        {bestAsk ? fmt(bestAsk.price) : '—'}
        {bestAsk && (
          <span className="ml-1.5 text-xs text-red-600">{fmtVol(bestAsk.volume)}</span>
        )}
      </td>

      {/* Mid */}
      <td className={`px-4 py-3 font-mono tabular-nums text-right font-bold ${midColor}`}>
        {mid !== null ? fmt(mid) : '—'}
      </td>

      {/* Spread */}
      <td className="px-4 py-3 font-mono tabular-nums text-right text-zinc-500 text-sm">
        {spread !== null ? spread.toFixed(3) : '—'}
      </td>

      {/* Updated */}
      <td className="px-4 py-3 text-right text-zinc-600 text-xs font-mono">
        {formatTime(book.tickTime)}
      </td>
    </tr>
  );
}
