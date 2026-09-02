import { NextResponse } from 'next/server';

import {
  AccountError,
  deleteSession,
  getAuthenticatedUser,
  getSessionCookieName,
  getSessionCookieOptions,
  signIn,
  signUp,
} from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    return NextResponse.json(
      { user },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { user: null },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function POST(request: Request) {
  let body: {
    mode?: unknown;
    name?: unknown;
    email?: unknown;
    password?: unknown;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: 'The account request was not valid.' },
      { status: 400 },
    );
  }

  const mode = body.mode === 'signin' ? 'signin' : 'signup';
  const name = typeof body.name === 'string' ? body.name : '';
  const email = typeof body.email === 'string' ? body.email : '';
  const password = typeof body.password === 'string' ? body.password : '';

  try {
    const result =
      mode === 'signin'
        ? await signIn({ email, password })
        : await signUp({ name, email, password });
    const response = NextResponse.json({ user: result.user });
    response.cookies.set(
      getSessionCookieName(),
      result.token,
      getSessionCookieOptions(result.expires),
    );
    return response;
  } catch (error) {
    if (error instanceof AccountError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: 'Accounts are temporarily unavailable. Please try again.' },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await deleteSession(request);
  } catch {
    // Clear the browser cookie even if the stored session is already gone.
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(getSessionCookieName(), '', {
    ...getSessionCookieOptions(new Date(0)),
    maxAge: 0,
  });
  return response;
}
