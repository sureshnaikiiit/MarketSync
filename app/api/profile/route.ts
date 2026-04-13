import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/session';
import { signToken, COOKIE_NAME } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorizedResponse();

  const [orderCount, positionCount, alertCount] = await Promise.all([
    prisma.order.count({ where: { userId: user.id } }),
    prisma.position.count({ where: { userId: user.id } }),
    prisma.priceAlert.count({ where: { userId: user.id, status: 'ACTIVE' } }),
  ]);

  return NextResponse.json({
    id:         user.id,
    name:       user.name,
    email:      user.email,
    balance:    user.balance,
    createdAt:  user.createdAt,
    stats: { orderCount, positionCount, alertCount },
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorizedResponse();

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { name, currentPassword, newPassword } = body;
  const updates: Record<string, string> = {};

  // ── Name update ──────────────────────────────────────────────────────────────
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    updates.name = trimmed;
  }

  // ── Password change ───────────────────────────────────────────────────────────
  if (newPassword !== undefined) {
    if (!currentPassword)
      return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
    if (String(newPassword).length < 6)
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
    if (!user.passwordHash)
      return NextResponse.json({ error: 'No password set on this account' }, { status: 400 });

    const valid = await bcrypt.compare(String(currentPassword), user.passwordHash);
    if (!valid)
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });

    updates.passwordHash = await bcrypt.hash(String(newPassword), 10);
  }

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const updated = await prisma.user.update({ where: { id: user.id }, data: updates });

  // Re-issue JWT if name changed so NavBar reflects it immediately
  const response = NextResponse.json({
    id:    updated.id,
    name:  updated.name,
    email: updated.email,
  });

  if (updates.name) {
    const token = await signToken({ sub: updated.id, email: updated.email, name: updated.name });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path:     '/',
      maxAge:   60 * 60 * 24 * 7,
    });
  }

  return response;
}
