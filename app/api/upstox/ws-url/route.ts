import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.UPSTOX_ACCESS_TOKEN;

  if (!token) {
    return NextResponse.json({ error: 'Upstox token not configured' }, { status: 500 });
  }

  const res = await fetch('https://api.upstox.com/v3/feed/market-data-feed/authorize', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept:        'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Upstox authorize failed: ${text}` }, { status: 502 });
  }

  const data = await res.json() as {
    data?: { authorizedRedirectUri?: string; authorized_redirect_uri?: string };
  };

  const url = data?.data?.authorizedRedirectUri ?? data?.data?.authorized_redirect_uri;

  if (!url) {
    return NextResponse.json({ error: 'No WebSocket URL in Upstox response' }, { status: 502 });
  }

  return NextResponse.json({ url });
}
