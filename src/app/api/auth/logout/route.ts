import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'auburn-cr-session';

export async function POST(request: NextRequest) {
  try {
    // Clear the session cookie
    cookies().delete(SESSION_COOKIE_NAME);

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'An error occurred during logout' },
      { status: 500 }
    );
  }
}