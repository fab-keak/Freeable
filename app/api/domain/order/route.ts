import { NextResponse } from 'next/server';

import { getAuthenticatedUser } from '@/lib/auth';
import {
  getDomainOrderForUser,
  serializeDomainOrder,
} from '@/lib/domain-orders';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) {
    return NextResponse.json(
      { error: 'Sign in to view this domain order.' },
      { status: 401 },
    );
  }

  const sessionId = new URL(request.url).searchParams.get('session_id') || '';
  if (!sessionId.startsWith('cs_')) {
    return NextResponse.json(
      { error: 'The domain order link is not valid.' },
      { status: 400 },
    );
  }

  try {
    const order = await getDomainOrderForUser({ sessionId, userId: user.id });
    if (!order) {
      return NextResponse.json(
        { error: 'This domain order could not be found.' },
        { status: 404 },
      );
    }
    return NextResponse.json(serializeDomainOrder(order));
  } catch {
    return NextResponse.json(
      { error: 'The domain order is still processing. Try again shortly.' },
      { status: 503 },
    );
  }
}
