import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { verifyToken, COOKIE_NAME } from './auth';
import { prisma } from './prisma';

/** Use inside Server Components / Route Handlers (reads from cookie store) */
export async function getSessionUser() {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const payload = await verifyToken(token);
    return prisma.user.findUnique({ where: { id: payload.sub } });
  } catch {
    return null;
  }
}

/** Use inside Route Handlers where you have the NextRequest object */
export async function getUserFromRequest(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const payload = await verifyToken(token);
    return prisma.user.findUnique({ where: { id: payload.sub } });
  } catch {
    return null;
  }
}

export function unauthorizedResponse() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
