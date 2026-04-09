import { NextResponse } from 'next/server';

export function GET() {
  // With a static analytics token there is always an access token configured
  const configured = !!process.env.UPSTOX_ACCESS_TOKEN;
  return NextResponse.json({ authenticated: configured });
}
