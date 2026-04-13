import { SignJWT, jwtVerify } from 'jose';

export const COOKIE_NAME = 'ms_token';
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'marketsync-super-secret-jwt-key-2026'
);

export async function signToken(payload: { sub: string; email: string; name: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyToken(token: string): Promise<{ sub: string; email: string; name: string }> {
  const { payload } = await jwtVerify(token, secret);
  return payload as { sub: string; email: string; name: string };
}
