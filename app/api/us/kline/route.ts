import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// AllTick kline intervals → period string
const INTERVAL_MAP: Record<string, string> = {
  '1m':  '1',
  '5m':  '5',
  '15m': '15',
  '30m': '30',
  '1h':  '60',
  '4h':  '240',
  '1d':  '1D',
};

// How long cached data is considered fresh (ms)
const STALE_MS: Record<string, number> = {
  '1m':  1  * 60 * 1000,
  '5m':  5  * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h':  60 * 60 * 1000,
  '4h':  4  * 60 * 60 * 1000,
  '1d':  12 * 60 * 60 * 1000,
};

interface Candle {
  time: number; open: number; high: number; low: number; close: number; volume: number;
}

async function fetchFromAlltick(code: string, interval: string, limit: number): Promise<Candle[]> {
  const token  = process.env.NEXT_PUBLIC_ALLTICK_TOKEN ?? '';
  const period = INTERVAL_MAP[interval] ?? '5';

  const query = encodeURIComponent(JSON.stringify({
    trace: `kline-${Date.now()}`,
    data: {
      code,
      kline_type: /^\d+$/.test(period) ? parseInt(period, 10) : period,
      kline_timestamp_end: 0,
      query_kline_num: limit,
      adjust_type: 0,
    },
  }));

  const url = `https://quote.alltick.co/quote-stock-b-api/kline?token=${token}&query=${query}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`AllTick HTTP ${res.status}`);

  const json = await res.json();
  const list: Record<string, string>[] = json?.data?.kline_list ?? [];

  return list.map(k => {
    const ts = parseInt(k.timestamp, 10);
    return {
      time:   ts > 1e12 ? Math.floor(ts / 1000) : ts,
      open:   parseFloat(k.open_price),
      high:   parseFloat(k.high_price),
      low:    parseFloat(k.low_price),
      close:  parseFloat(k.close_price),
      volume: parseFloat(k.volume ?? '0'),
    };
  }).filter(c => c.time > 0 && c.open > 0);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code     = searchParams.get('code');
  const interval = searchParams.get('interval') ?? '5m';
  const limit    = parseInt(searchParams.get('limit') ?? '300', 10);

  if (!code) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 });
  }

  const staleness = STALE_MS[interval] ?? STALE_MS['5m'];

  // ── Check DB cache ────────────────────────────────────────────
  try {
    const newest = await prisma.candle.findFirst({
      where: { market: 'us', symbol: code, interval },
      orderBy: { fetchedAt: 'desc' },
      select: { fetchedAt: true },
    });

    const isFresh = newest && (Date.now() - newest.fetchedAt.getTime()) < staleness;

    if (isFresh) {
      const rows = await prisma.candle.findMany({
        where: { market: 'us', symbol: code, interval },
        orderBy: { time: 'asc' },
        take: limit,
        select: { time: true, open: true, high: true, low: true, close: true, volume: true },
      });
      return NextResponse.json({ candles: rows, source: 'db' });
    }
  } catch (e) {
    console.error('[US kline] DB read error:', e);
  }

  // ── Fetch from AllTick ────────────────────────────────────────
  let candles: Candle[];
  try {
    candles = await fetchFromAlltick(code, interval, limit);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }

  if (candles.length === 0) {
    return NextResponse.json({ candles: [] });
  }

  // ── Persist to DB ─────────────────────────────────────────────
  try {
    const result = await prisma.candle.createMany({
      data: candles.map(c => ({ market: 'us', symbol: code, interval, ...c })),
      skipDuplicates: true,
    });
    console.log(`[US kline] Inserted ${result.count} new candles for ${code}/${interval}`);
  } catch (e) {
    console.error('[US kline] DB write error:', e);
  }

  return NextResponse.json({ candles, source: 'live' });
}
