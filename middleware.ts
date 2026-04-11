import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/health',
  '/api/tools',
  '/api/resources',
];

const STATIC_PATHS = [
  '/_next',
  '/favicon.ico',
  '/images',
  '/fonts',
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return true;
  }
  if (STATIC_PATHS.some((p) => pathname.startsWith(p))) {
    return true;
  }
  if (pathname === '/' || pathname === '/chat') {
    return true;
  }
  return false;
}

function parseJwt(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function isTokenExpired(payload: any): boolean {
  if (!payload.exp) return false;
  return payload.exp * 1000 < Date.now();
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/chat', request.url));
  }

  if (pathname === '/register') {
    return NextResponse.redirect(new URL('/chat?register=1', request.url));
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '请先登录' },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/chat', request.url));
  }

  const payload = parseJwt(token);

  if (!payload || isTokenExpired(payload)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Token 无效或已过期' },
        { status: 401 }
      );
    }
    const response = NextResponse.redirect(new URL('/chat', request.url));
    response.cookies.delete('auth_token');
    response.cookies.delete('refresh_token');
    return response;
  }

  const response = NextResponse.next();
  response.headers.set('x-user-id', payload.userId);
  response.headers.set('x-username', payload.username);
  response.headers.set('x-user-role', payload.role);

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images|fonts).*)',
  ],
};
