import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { expireDomainCheckout, fulfillDomainOrder } from '@/lib/domain-orders';
import { getStripe, getStripeWebhookSecret } from '@/lib/stripe';

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      getStripeWebhookSecret(),
    );
  } catch {
    return NextResponse.json(
      { error: 'Webhook verification failed.' },
      { status: 400 },
    );
  }

  try {
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      await fulfillDomainOrder(event.data.object);
    } else if (event.type === 'checkout.session.expired') {
      await expireDomainCheckout(event.data.object.id);
    }
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: 'Webhook processing failed.' },
      { status: 500 },
    );
  }
}
