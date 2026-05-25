import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
    const expectedPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (username === expectedUsername && password === expectedPassword) {
      const response = NextResponse.json({ success: true, message: 'Authenticated successfully' });
      
      // Set the session cookie.
      response.cookies.set({
        name: 'admin_session',
        value: 'true',
        path: '/',
        httpOnly: false, // Accessible in middleware & client for route checking
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24, // 1 day
        sameSite: 'lax',
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
