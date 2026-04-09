'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from 'lightweight-charts';

const INTERVALS_US    = ['1m', '5m', '15m', '1h', '1d'] as const;
const INTERVALS_INDIA = ['1m', '5m', '15m', '30m', '1h', '1d'] as const;

type USInterval    = typeof INTERVALS_US[number];
type IndiaInterval = typeof INTERVALS_INDIA[number];

interface Props {
  market: 'us' | 'india';
  code: string;      // AllTick code (US) or Upstox instrument key (India)
  label: string;     // Short ticker: "AAPL", "RELIANCE"
  name: string;      // Full company name
  livePrice?: number | null;
  onClose: () => void;
}

interface Candle {
  time: number; // Unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function toCandlestickData(c: Candle): CandlestickData<Time> {
  return { time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close };
}

export default function CandleChartModal({ market, code, label, name, livePrice, onClose }: Props) {
  const intervals = (market === 'us' ? INTERVALS_US : INTERVALS_INDIA) as readonly string[];
  const defaultInterval = market === 'us' ? '5m' : '1d';

  const [interval, setInterval] = useState<string>(defaultInterval);
  const [candles, setCandles]   = useState<Candle[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRef    = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lastCandleRef = useRef<Candle | null>(null);

  // ── Create chart once ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: 420,
      layout: {
        background: { color: '#09090b' },
        textColor:  '#a1a1aa',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor:         '#34d399',
      downColor:       '#f87171',
      borderUpColor:   '#34d399',
      borderDownColor: '#f87171',
      wickUpColor:     '#34d399',
      wickDownColor:   '#f87171',
    });

    chartRef.current  = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current  = null;
      seriesRef.current = null;
    };
  }, []);

  // ── Fetch historical candles ───────────────────────────────────
  const fetchCandles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url: string;
      if (market === 'us') {
        url = `/api/us/kline?code=${encodeURIComponent(code)}&interval=${interval}&limit=300`;
      } else {
        url = `/api/india/kline?instrumentKey=${encodeURIComponent(code)}&interval=${interval}`;
      }

      const res  = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      let data: Candle[];

      if (market === 'us') {
        // AllTick passes through its native JSON. Expected shape:
        // { data: { kline_list: [{ timestamp, open_price, close_price, high_price, low_price, volume }] } }
        const list: Record<string, string>[] = json?.data?.kline_list ?? [];
        data = list.map(k => {
          const ts = parseInt(k.timestamp, 10);
          return {
            // AllTick timestamps may be seconds or ms; normalize to seconds
            time:   ts > 1e12 ? Math.floor(ts / 1000) : ts,
            open:   parseFloat(k.open_price),
            high:   parseFloat(k.high_price),
            low:    parseFloat(k.low_price),
            close:  parseFloat(k.close_price),
            volume: parseFloat(k.volume ?? '0'),
          };
        }).filter(c => c.time > 0 && c.open > 0);
      } else {
        // India route already returns normalized candles
        data = json?.candles ?? [];
      }

      setCandles(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load candles');
    } finally {
      setLoading(false);
    }
  }, [market, code, interval]);

  useEffect(() => { fetchCandles(); }, [fetchCandles]);

  // Reset interval when market/code changes
  useEffect(() => { setInterval(defaultInterval); }, [market, code]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Feed candles to chart ──────────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current) return;
    if (candles.length === 0) {
      seriesRef.current.setData([]);
      lastCandleRef.current = null;
      return;
    }

    const seen = new Set<number>();
    const pts = candles
      .filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; })
      .sort((a, b) => a.time - b.time);

    lastCandleRef.current = pts[pts.length - 1] ?? null;
    seriesRef.current.setData(pts.map(toCandlestickData));
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // ── Live price → update last candle ───────────────────────────
  useEffect(() => {
    if (!seriesRef.current || livePrice == null || lastCandleRef.current === null) return;

    const last = lastCandleRef.current;
    const updated: Candle = {
      ...last,
      high:  Math.max(last.high, livePrice),
      low:   Math.min(last.low,  livePrice),
      close: livePrice,
    };
    lastCandleRef.current = updated;
    seriesRef.current.update(toCandlestickData(updated));
  }, [livePrice]);

  // ── ESC key closes modal ───────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="relative w-full max-w-5xl mx-4 rounded-2xl border border-white/[0.08] bg-zinc-950 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div>
              <span className="font-mono font-bold text-white text-lg">{label}</span>
              <span className="ml-2 text-zinc-500 text-sm">{name}</span>
            </div>
            {livePrice != null && (
              <span className="font-mono text-sm text-emerald-400 tabular-nums">
                {market === 'india' ? '₹' : '$'}{livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Interval pills */}
            <div className="flex gap-1 p-1 rounded-lg bg-white/[0.04]">
              {intervals.map(iv => (
                <button
                  key={iv}
                  onClick={() => setInterval(iv)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors ${
                    interval === iv
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {iv}
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              aria-label="Close"
              className="flex items-center justify-center w-7 h-7 rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-colors text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Chart / states */}
        <div className="relative">
          {/* Always render container so chart can attach */}
          <div ref={containerRef} className="w-full" />

          {/* Overlay: loading */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
              <div className="shimmer text-zinc-500 text-sm">Loading candles…</div>
            </div>
          )}

          {/* Overlay: error */}
          {!loading && error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 gap-2">
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={fetchCandles}
                className="text-xs text-zinc-400 underline hover:text-white"
              >
                Retry
              </button>
            </div>
          )}

          {/* Overlay: no data */}
          {!loading && !error && candles.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
              <p className="text-zinc-500 text-sm">No candle data available for this interval</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
