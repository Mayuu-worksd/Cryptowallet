import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';

// Sign a session token with ADMIN_SECRET so it can't be forged
function signToken(token: string): string {
  const secret = process.env.ADMIN_SECRET || 'cw_admin_fallback_secret_change_me';
  const sig = createHash('sha256').update(token + secret).digest('hex').slice(0, 16);
  return `${token}.${sig}`;
}

export function verifyToken(signed: string): boolean {
  const parts = signed.split('.');
  if (parts.length !== 2) return false;
  const [token, sig] = parts;
  const secret = process.env.ADMIN_SECRET || 'cw_admin_fallback_secret_change_me';
  const expected = createHash('sha256').update(token + secret).digest('hex').slice(0, 16);
  return sig === expected;
}

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    const expectedUsername = process.env.ADMIN_USERNAME;
    const expectedPassword = process.env.ADMIN_PASSWORD;

    if (!expectedUsername || !expectedPassword) {
      return NextResponse.json(
        { success: false, message: 'Admin credentials not configured' },
        { status: 500 }
      );
    }

    if (username === expectedUsername && password === expectedPassword) {
      const token = randomBytes(32).toString('hex');
      const signed = signToken(token);

      const response = NextResponse.json({ success: true, message: 'Authenticated successfully' });
      response.cookies.set({
        name: 'admin_session',
        value: signed,
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 8,
        sameSite: 'strict',
      });
      return response;
    }

    return NextResponse.json(
      { success: false, message: 'Invalid username or password' },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Authentication error' },
      { status: 500 }
    );
  }
}
