import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'auburn-cr-session';

// List of paths that don't require authentication
const publicPaths = [
  '/api/auth/login',
  '/api/auth/check',
  '/auburn-logo.svg', // Allow logo to load on login screen
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for API routes
  if (pathname.startsWith('/api/')) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
    
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    try {
      const sessionData = JSON.parse(
        Buffer.from(sessionCookie.value, 'base64').toString()
      );

      if (!sessionData.authenticated) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all API routes except auth endpoints
    '/api/((?!auth/).*)',
    // You can add more patterns here if needed
  ],
};