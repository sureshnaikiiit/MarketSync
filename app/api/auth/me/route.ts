import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/session';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  return NextResponse.json({ id: user.id, name: user.name, email: user.email, balance: user.balance });
}
