import { NextResponse } from 'next/server';

import { getAuthenticatedUser } from '@/lib/auth';
import { searchDomain, searchDomainAlternatives } from '@/lib/domain-commerce';

const noStoreHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
};

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) {
    return NextResponse.json(
      { error: 'Sign in before searching for a domain.' },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const domain = new URL(request.url).searchParams.get('domain') || '';
  try {
    const result = await searchDomain(domain);
    const alternatives = await searchDomainAlternatives(result.domain).catch(
      () => [],
    );
    return NextResponse.json(
      { ...result, alternatives },
      {
        headers: noStoreHeaders,
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'This domain could not be checked.',
      },
      { status: 400, headers: noStoreHeaders },
    );
  }
}
