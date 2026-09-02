import { NextResponse } from 'next/server';

import { getAuthenticatedUser } from '@/lib/auth';
import { searchDomain } from '@/lib/domain-commerce';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) {
    return NextResponse.json(
      { error: 'Sign in before searching for a domain.' },
      { status: 401 },
    );
  }

  const domain = new URL(request.url).searchParams.get('domain') || '';
  try {
    return NextResponse.json(await searchDomain(domain));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'This domain could not be checked.',
      },
      { status: 400 },
    );
  }
}
