'use client';

import { useEffect, useRef } from 'react';
import { useUpstox, DEFAULT_INSTRUMENT_KEYS, INSTRUMENT_LABEL } from '@/lib/upstox-tick-data';
import type { UpstoxTick } from '@/lib/upstox-tick-data';

function fmt(p: number) {
  return p.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtVol(v: number) {
  if (v >= 10_000_000) return `${(v / 10_000_000).toFixed(1)}Cr`;
  if (v >= 100_000)    return `${(v / 100_000).toFixed(1)}L`;
  if (v >= 1_000)      return `${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' });
}

function TickRow({ tick, prevLtp }: { tick: UpstoxTick; prevLtp: number | null }) {
  const up   = prevLtp !== null && tick.ltp > prevLtp;
  const down = prevLtp !== null && tick.ltp < prevLtp;
  const label = INSTRUMENT_LABEL[tick.instrumentKey] ?? tick.instrumentKey;

  const changePctColor =
    tick.changePct > 0 ? 'text-emerald-400' : tick.changePct < 0 ? 'text-red-400' : 'text-zinc-400';

  return (
    <tr className={`border-b border-white/5 transition-colors ${up ? 'flash-up' : down ? 'flash-down' : ''}`}>
      {/* Symbol */}
      <td className="px-4 py-3">
        <span className="font-mono font-semibold text-white tracking-wide">{label}</span>
      </td>

      {/* LTP */}
      <td className={`px-4 py-3 font-mono tabular-nums font-bold text-right ${up ? 'text-emerald-400' : down ? 'text-red-400' : 'text-white'}`}>
        ₹{fmt(tick.ltp)}
      </td>

      {/* Change % */}
      <td className={`px-4 py-3 font-mono tabular-nums text-right text-sm ${changePctColor}`}>
        {tick.changePct >= 0 ? '+' : ''}{tick.changePct.toFixed(2)}%
      </td>

      {/* Change abs */}
      <td className={`px-4 py-3 font-mono tabular-nums text-right text-sm ${changePctColor}`}>
        {tick.change >= 0 ? '+' : ''}{fmt(tick.change)}
      </td>

      {/* Volume */}
      <td className="px-4 py-3 font-mono tabular-nums text-right text-zinc-400 text-sm">
        {fmtVol(tick.vtt)}
      </td>

      {/* Updated */}
      <td className="px-4 py-3 text-right text-zinc-600 text-xs font-mono">
        {formatTime(tick.tickTime)}
      </td>
    </tr>
  );
}

export default function IndiaWatchList() {
  const { ticks, isAuthenticated, status, subscribe } = useUpstox();
  const prevLtps = useRef<Record<string, number>>({});

  useEffect(() => {
    if (isAuthenticated && status === 'connected') {
      subscribe(DEFAULT_INSTRUMENT_KEYS, 'full');
    }
  }, [isAuthenticated, status, subscribe]);

  if (!isAuthenticated) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-20 text-center">
        <p className="text-zinc-400 text-sm mb-2">Connect your Upstox account to see live NSE data</p>
        <p className="text-zinc-600 text-xs">Click "Connect Upstox" in the top-right corner</p>
      </div>
    );
  }

  if (status !== 'connected') {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-20 text-center">
        <p className="text-zinc-400 text-sm">
          {status === 'connecting' ? 'Connecting to NSE feed…' : 'Waiting for connection…'}
        </p>
      </div>
    );
  }

  const rows = DEFAULT_INSTRUMENT_KEYS
    .map(key => ticks[key])
    .filter((t): t is UpstoxTick => !!t);

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-zinc-500">
            <th className="px-4 py-3 text-left">Symbol</th>
            <th className="px-4 py-3 text-right">LTP (₹)</th>
            <th className="px-4 py-3 text-right">Change %</th>
            <th className="px-4 py-3 text-right">Change</th>
            <th className="px-4 py-3 text-right">Volume</th>
            <th className="px-4 py-3 text-right">Updated (IST)</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-zinc-600 text-sm">
                Waiting for tick data…
              </td>
            </tr>
          ) : (
            rows.map(tick => {
              const prev = prevLtps.current[tick.instrumentKey] ?? null;
              prevLtps.current[tick.instrumentKey] = tick.ltp;
              return <TickRow key={tick.instrumentKey} tick={tick} prevLtp={prev} />;
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
