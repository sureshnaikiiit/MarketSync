'use client';

import { useEffect, useRef } from 'react';
import { createChart, LineSeries, type IChartApi, type ISeriesApi, type LineData } from 'lightweight-charts';

interface Props {
  data: { time: number; value: number }[];
  positive: boolean;
}

export default function MiniChart({ data, positive }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRef    = useRef<ISeriesApi<'Line'> | null>(null);

  const color = positive ? '#34d399' : '#f87171';

  // Create chart on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: 52,
      layout: {
        background: { color: 'transparent' },
        textColor:  'transparent',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair:    { horzLine: { visible: false }, vertLine: { visible: false } },
      rightPriceScale: { visible: false },
      leftPriceScale:  { visible: false },
      timeScale:       { visible: false, borderVisible: false },
      handleScroll:    false,
      handleScale:     false,
    });

    const series = chart.addSeries(LineSeries, {
      color,
      lineWidth:      2,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });

    chartRef.current  = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current  = null;
      seriesRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update color when trend changes
  useEffect(() => {
    seriesRef.current?.applyOptions({ color });
  }, [color]);

  // Feed data
  useEffect(() => {
    if (!seriesRef.current || data.length === 0) return;

    // lightweight-charts requires time in seconds and unique ascending
    const seen = new Set<number>();
    const pts: LineData[] = [];
    for (const d of data) {
      const t = Math.floor(d.time / 1000);
      if (!seen.has(t)) { seen.add(t); pts.push({ time: t as LineData['time'], value: d.value }); }
    }
    if (pts.length < 2) return;

    seriesRef.current.setData(pts);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return <div ref={containerRef} className="w-full" />;
}
