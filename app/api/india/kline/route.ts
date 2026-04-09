import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const HISTORICAL_INTERVAL_MAP: Record<string, string> = {
  '1d':  'day',
  '1w':  'week',
  '1mo': 'month',
};

const INTRADAY_INTERVAL_MAP: Record<string, string> = {
  '1m':  '1minute',
  '5m':  '5minute',
  '15m': '15minute',
  '30m': '30minute',
  '1h':  '60minute',
};

const STALE_MS: Record<string, number> = {
  '1m':  1  * 60 * 1000,
  '5m':  5  * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h':  60 * 60 * 1000,
  '1d':  12 * 60 * 60 * 1000,
};

interface Candle {
  time: number; open: number; high: number; low: number; close: number; volume: number;
}

type UpstoxRawCandle = [string, number, number, number, number, number, number];

function toDate(d: Date) {
  return d.toISOString().split('T')[0];
}

async function fetchFromUpstox(instrumentKey: string, interval: string): Promise<Candle[]> {
  const token   = process.env.UPSTOX_ACCESS_TOKEN ?? '';
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const encoded = encodeURIComponent(instrumentKey);

  let url: string;
  if (HISTORICAL_INTERVAL_MAP[interval]) {
    const unit     = HISTORICAL_INTERVAL_MAP[interval];
    const toDate_  = toDate(new Date());
    const fromDate = toDate(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));
    url = `https://api.upstox.com/v2/historical-candle/${encoded}/${unit}/${toDate_}/${fromDate}`;
  } else if (INTRADAY_INTERVAL_MAP[interval]) {
    const unit = INTRADAY_INTERVAL_MAP[interval];
    url = `https://api.upstox.com/v2/historical-candle/intraday/${encoded}/${unit}`;
  } else {
    throw new Error(`Unsupported interval: ${interval}`);
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upstox HTTP ${res.status}: ${text}`);
  }

  const raw = await res.json() as { status: string; data: { candles: UpstoxRawCandle[] } };
  if (raw.status !== 'success') throw new Error('Upstox returned error status');

  // Upstox returns newest-first → reverse to ascending
  return [...raw.data.candles].reverse().map(([ts, open, high, low, close, volume]) => ({
    time:   Math.floor(new Date(ts).getTime() / 1000),
    open, high, low, close, volume,
  }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const instrumentKey = searchParams.get('instrumentKey');
  const interval      = searchParams.get('interval') ?? '1d';

  if (!instrumentKey) {
    return NextResponse.json({ error: 'instrumentKey is required' }, { status: 400 });
  }

  const staleness = STALE_MS[interval] ?? STALE_MS['1d'];

  // ── Check DB cache ────────────────────────────────────────────
  try {
    const newest = await prisma.candle.findFirst({
      where: { market: 'india', symbol: instrumentKey, interval },
      orderBy: { fetchedAt: 'desc' },
      select: { fetchedAt: true },
    });

    const isFresh = newest && (Date.now() - newest.fetchedAt.getTime()) < staleness;

    if (isFresh) {
      const rows = await prisma.candle.findMany({
        where: { market: 'india', symbol: instrumentKey, interval },
        orderBy: { time: 'asc' },
        select: { time: true, open: true, high: true, low: true, close: true, volume: true },
      });
      return NextResponse.json({ candles: rows, source: 'db' });
    }
  } catch (e) {
    console.error('[India kline] DB read error:', e);
  }

  // ── Fetch from Upstox ─────────────────────────────────────────
  let candles: Candle[];
  try {
    candles = await fetchFromUpstox(instrumentKey, interval);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }

  if (candles.length === 0) {
    return NextResponse.json({ candles: [] });
  }

  // ── Persist to DB ─────────────────────────────────────────────
  try {
    const result = await prisma.candle.createMany({
      data: candles.map(c => ({ market: 'india', symbol: instrumentKey, interval, ...c })),
      skipDuplicates: true,
    });
    console.log(`[India kline] Inserted ${result.count} new candles for ${instrumentKey}/${interval}`);
  } catch (e) {
    console.error('[India kline] DB write error:', e);
  }

  return NextResponse.json({ candles, source: 'live' });
}
