'use client';

import { useEffect, useRef, useState } from 'react';
import { useTickData } from '@/lib/tick-data';
import type { OrderBook } from '@/lib/tick-data';
import MiniChart from './MiniChart';
import CandleChartModal from './CandleChartModal';

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

const SYMBOL_NAMES: Record<string, string> = {
  'AAPL.US': 'Apple', 'MSFT.US': 'Microsoft', 'NVDA.US': 'Nvidia',
  'TSLA.US': 'Tesla', 'AMZN.US': 'Amazon',    'GOOGL.US': 'Alphabet',
  'META.US': 'Meta',  'UNH.US':  'UnitedHealth',
};

function fmt(p: number) {
  return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}
function fmtVol(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}
function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString('en-US', { hour12: false });
}

function TickRow({
  book, prevMid, history, onClick,
}: {
  book: OrderBook;
  prevMid: number | null;
  history: { time: number; value: number }[];
  onClick: () => void;
}) {
  const bestBid = book.bids[0];
  const bestAsk = book.asks[0];
  const mid     = bestBid && bestAsk ? (bestBid.price + bestAsk.price) / 2 : null;
  const spread  = bestBid && bestAsk ? bestAsk.price - bestBid.price : null;
  const up      = mid !== null && prevMid !== null && mid > prevMid;
  const down    = mid !== null && prevMid !== null && mid < prevMid;
  const ticker  = book.code.replace('.US', '');
  const name    = SYMBOL_NAMES[book.code] ?? '';

  return (
    <tr
      onClick={onClick}
      className={`group border-b border-white/[0.04] transition-colors cursor-pointer hover:bg-white/[0.03] ${up ? 'flash-up' : down ? 'flash-down' : ''}`}
    >
      {/* Symbol */}
      <td className="px-5 py-3">
        <div className="font-mono font-bold text-white text-sm">{ticker}</div>
        <div className="text-xs text-zinc-600 mt-0.5">{name}</div>
      </td>

      {/* Bid */}
      <td className="px-4 py-3 font-mono tabular-nums text-right">
        <div className="text-emerald-400 font-semibold text-sm">{bestBid ? fmt(bestBid.price) : '—'}</div>
        {bestBid && <div className="text-xs text-emerald-700 mt-0.5">{fmtVol(bestBid.volume)}</div>}
      </td>

      {/* Ask */}
      <td className="px-4 py-3 font-mono tabular-nums text-right">
        <div className="text-red-400 font-semibold text-sm">{bestAsk ? fmt(bestAsk.price) : '—'}</div>
        {bestAsk && <div className="text-xs text-red-700 mt-0.5">{fmtVol(bestAsk.volume)}</div>}
      </td>

      {/* Mid */}
      <td className={`px-4 py-3 font-mono tabular-nums text-right font-bold text-sm ${up ? 'text-emerald-400' : down ? 'text-red-400' : 'text-white'}`}>
        {mid !== null ? fmt(mid) : '—'}
      </td>

      {/* Spread */}
      <td className="px-4 py-3 font-mono tabular-nums text-right text-zinc-500 text-xs">
        {spread !== null ? spread.toFixed(3) : '—'}
      </td>

      {/* Sparkline */}
      <td className="px-4 py-3 w-32">
        {history.length >= 2
          ? <MiniChart data={history} positive={!down} />
          : <div className="h-[52px] shimmer rounded bg-white/5" />}
      </td>

      {/* Updated */}
      <td className="px-5 py-3 text-right text-zinc-600 text-xs font-mono">
        {formatTime(book.tickTime)}
      </td>
    </tr>
  );
}

interface SelectedSymbol {
  code: string;
  label: string;
  name: string;
  livePrice: number | null;
}

export default function WatchList() {
  const { orderBooks, getHistory, subscribe } = useTickData();
  const prevMids = useRef<Record<string, number>>({});
  const [selected, setSelected] = useState<SelectedSymbol | null>(null);

  useEffect(() => { subscribe(DEFAULT_SYMBOLS); }, [subscribe]);

  const rows = DEFAULT_SYMBOLS.map(code => orderBooks[code]).filter(Boolean);

  // Keep live price fresh in modal without re-opening it
  const livePrice = selected
    ? (() => {
        const book = orderBooks[selected.code];
        const b = book?.bids[0]; const a = book?.asks[0];
        return b && a ? (b.price + a.price) / 2 : null;
      })()
    : null;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] shadow-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {['Symbol', 'Best Bid', 'Best Ask', 'Mid', 'Spread', 'Chart', 'Updated'].map((h, i) => (
                <th
                  key={h}
                  className={`px-${i === 0 || i === 6 ? 5 : 4} py-3 text-xs font-medium uppercase tracking-widest text-zinc-600 ${i === 0 ? 'text-left' : 'text-right'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center">
                  <div className="text-zinc-600 text-sm">Waiting for market data…</div>
                  <div className="text-zinc-700 text-xs mt-1">US market hours: 9:30 AM – 4:00 PM ET</div>
                </td>
              </tr>
            ) : (
              rows.map(book => {
                const bestBid = book.bids[0];
                const bestAsk = book.asks[0];
                const mid = bestBid && bestAsk ? (bestBid.price + bestAsk.price) / 2 : null;
                const prev = prevMids.current[book.code] ?? null;
                if (mid !== null) prevMids.current[book.code] = mid;
                return (
                  <TickRow
                    key={book.code}
                    book={book}
                    prevMid={prev}
                    history={getHistory(book.code)}
                    onClick={() => setSelected({
                      code:      book.code,
                      label:     book.code.replace('.US', ''),
                      name:      SYMBOL_NAMES[book.code] ?? '',
                      livePrice: mid,
                    })}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <CandleChartModal
          market="us"
          code={selected.code}
          label={selected.label}
          name={selected.name}
          livePrice={livePrice}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
