import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'auburn-cr-session';

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = cookies().get(SESSION_COOKIE_NAME);

    if (!sessionCookie) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    // Verify the session token
    try {
      const sessionData = JSON.parse(
        Buffer.from(sessionCookie.value, 'base64').toString()
      );

      if (sessionData.authenticated) {
        return NextResponse.json(
          { authenticated: true },
          { status: 200 }
        );
      }
    } catch (error) {
      // Invalid session token
      console.error('Invalid session token:', error);
    }

    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    );
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { authenticated: false },
      { status: 500 }
    );
  }
}