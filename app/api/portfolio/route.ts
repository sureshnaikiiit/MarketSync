import https from 'node:https';
import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/session';
import { readCandles } from '@/lib/timescale';

// Reuse the same TLS-bypass agent as india-preview
const upstoxAgent = new https.Agent({ rejectUnauthorized: false });

/** Batch-fetch Last Traded Prices for India instruments from Upstox. */
function fetchUpstoxLtps(instrumentKeys: string[]): Promise<Record<string, number>> {
  const token = (process.env.UPSTOX_ACCESS_TOKEN ?? '').trim();
  if (!token || instrumentKeys.length === 0) return Promise.resolve({});

  const keyParam = instrumentKeys.map(k => encodeURIComponent(k)).join('%2C');
  const url = `https://api.upstox.com/v2/market-quote/ltp?instrument_key=${keyParam}`;

  return new Promise((resolve) => {
    const u = new URL(url);
    https.get(
      {
        hostname: u.hostname,
        path:     u.pathname + u.search,
        headers:  { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        agent:    upstoxAgent,
        rejectUnauthorized: false,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk: string) => { body += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body) as {
              status: string;
              data: Record<string, { last_price: number }>;
            };
            if (parsed.status !== 'success') { resolve({}); return; }
            const result: Record<string, number> = {};
            for (const [key, val] of Object.entries(parsed.data)) {
              result[key] = val.last_price;
            }
            resolve(result);
          } catch { resolve({}); }
        });
      },
    ).on('error', () => resolve({}));
  });
}

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorizedResponse();

  // ── Positions ────────────────────────────────────────────────────────────
  const positions = await prisma.position.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  });

  // Batch-fetch live LTPs for all India positions in one Upstox call
  const indiaSymbols = positions
    .filter(p => p.market === 'india')
    .map(p => p.symbol);
  const indiaLtps = await fetchUpstoxLtps(indiaSymbols);

  // For each position, use live LTP (India) or latest candle close (US/HK)
  const enriched = await Promise.all(positions.map(async (pos) => {
    let currentPrice = pos.avgCost;
    if (pos.market === 'india' && indiaLtps[pos.symbol]) {
      currentPrice = indiaLtps[pos.symbol];
    } else {
      try {
        const candles = await readCandles(pos.market, pos.symbol, '1d', 1);
        if (candles.length > 0) currentPrice = candles[candles.length - 1].close;
      } catch { /* fall back to avgCost */ }
    }
    const marketValue   = currentPrice * pos.quantity;
    const costValue     = pos.avgCost  * pos.quantity;
    const unrealizedPnl = marketValue - costValue;
    const unrealizedPct = costValue > 0 ? (unrealizedPnl / costValue) * 100 : 0;

    return { ...pos, currentPrice, marketValue, unrealizedPnl, unrealizedPct };
  }));

  // ── Realized P&L ─────────────────────────────────────────────────────────
  const pnlEntries = await prisma.pnlEntry.findMany({
    where:   { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  const totalRealizedPnl = pnlEntries.reduce((sum, e) => sum + e.realizedPnl, 0);

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalMarketValue   = enriched.reduce((s, p) => s + p.marketValue, 0);
  const totalCostBasis     = enriched.reduce((s, p) => s + p.avgCost * p.quantity, 0);
  const totalUnrealizedPnl = enriched.reduce((s, p) => s + p.unrealizedPnl, 0);
  const totalPortfolioValue = user.balance + totalMarketValue;

  return NextResponse.json({
    user: { id: user.id, name: user.name, balance: user.balance },
    summary: {
      cash:              user.balance,
      marketValue:       totalMarketValue,
      totalValue:        totalPortfolioValue,
      costBasis:         totalCostBasis,
      unrealizedPnl:     totalUnrealizedPnl,
      realizedPnl:       totalRealizedPnl,
      totalPnl:          totalUnrealizedPnl + totalRealizedPnl,
    },
    positions: enriched,
    pnlEntries,
  });
}
