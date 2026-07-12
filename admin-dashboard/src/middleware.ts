import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

async function verifyToken(signed: string): Promise<boolean> {
  if (!signed) return false;
  const parts = signed.split('.');
  if (parts.length !== 2) return false;
  const [token, sig] = parts;
  const secret = process.env.ADMIN_SECRET || 'cw_admin_fallback_secret_change_me';
  
  const encoder = new TextEncoder();
  const data = encoder.encode(token + secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const expected = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  
  return sig === expected;
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Strip ?card_id from /card/* URLs — redirect to clean URL
  if (pathname.startsWith('/card/') && searchParams.has('card_id')) {
    const cleanUrl = new URL(pathname, request.url);
    return NextResponse.redirect(cleanUrl);
  }

  const sessionCookie = request.cookies.get('admin_session')?.value ?? '';
  const isAuthenticated = await verifyToken(sessionCookie);

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
