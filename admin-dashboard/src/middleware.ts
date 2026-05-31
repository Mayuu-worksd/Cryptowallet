import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createHash } from 'crypto';

function verifyToken(signed: string): boolean {
  if (!signed) return false;
  const parts = signed.split('.');
  if (parts.length !== 2) return false;
  const [token, sig] = parts;
  const secret = process.env.ADMIN_SECRET || 'cw_admin_fallback_secret_change_me';
  const expected = createHash('sha256').update(token + secret).digest('hex').slice(0, 16);
  return sig === expected;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('admin_session')?.value ?? '';
  const isAuthenticated = verifyToken(sessionCookie);

  const isAuthPage = pathname.startsWith('/login');
  const isDashboardPage = pathname.startsWith('/dashboard') || pathname === '/';

  if (isDashboardPage && !isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (pathname === '/' && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
