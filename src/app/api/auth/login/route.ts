import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ACCESS_PASSWORD = 'Auburn2025';
const SESSION_COOKIE_NAME = 'auburn-cr-session';
const SESSION_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    if (password !== ACCESS_PASSWORD) {
      return NextResponse.json(
        { error: 'Invalid password. Please try again.' },
        { status: 401 }
      );
    }

    // Create session token (in production, use a proper token/JWT)
    const sessionToken = Buffer.from(
      JSON.stringify({
        authenticated: true,
        timestamp: Date.now(),
      })
    ).toString('base64');

    // Set cookie with 1 hour expiration
    cookies().set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_DURATION / 1000, // maxAge is in seconds
      path: '/',
    });

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during authentication' },
      { status: 500 }
    );
  }
}