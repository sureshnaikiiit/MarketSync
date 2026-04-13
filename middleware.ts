import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';

const PUBLIC = ['/login', '/signup', '/api/auth'];
const SKIP   = ['/_next', '/favicon.ico', '/api/upstox', '/api/alerts/check'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow static assets and specific public APIs
  if (SKIP.some(p => pathname.startsWith(p))) return NextResponse.next();

  // Allow public pages and auth endpoints
  if (PUBLIC.some(p => pathname.startsWith(p))) {
    // If already logged in, redirect away from login/signup
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (token && (pathname === '/login' || pathname === '/signup')) {
      try {
        await verifyToken(token);
        return NextResponse.redirect(new URL('/india', req.url));
      } catch { /* invalid token, proceed to login */ }
    }
    return NextResponse.next();
  }

  // Protected: verify JWT
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.redirect(new URL('/login', req.url));

  try {
    await verifyToken(token);
    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
    return res;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
