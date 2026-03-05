// middleware.js — ochrona hasłem całej aplikacji (poza /api/proxy)
import { NextResponse } from 'next/server';

const USERNAME = process.env.BASIC_AUTH_USER || 'angloville';
const PASSWORD = process.env.BASIC_AUTH_PASS || 'mailing2025';

export function middleware(request) {
  // Przepuść API bez hasła
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const encoded = authHeader.split(' ')[1];
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const [user, pass] = decoded.split(':');
    if (user === USERNAME && pass === PASSWORD) {
      return NextResponse.next();
    }
  }

  return new NextResponse('Brak dostępu', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Angloville Mailing Generator"' },
  });
}

export const config = { matcher: ['/((?!api/).*)'] };
