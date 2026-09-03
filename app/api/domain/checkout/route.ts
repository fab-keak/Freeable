import { NextResponse } from 'next/server';

import { getAuthenticatedUser } from '@/lib/auth';
import { normalizeDomain, searchDomain } from '@/lib/domain-commerce';
import { getPublishedSitesDatabase } from '@/lib/published-sites';
import { getStripe } from '@/lib/stripe';

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DOMAIN_CHECKOUT_ENABLED !== 'true') {
    return NextResponse.json(
      { error: 'Domain checkout is not available yet.' },
      { status: 503 },
    );
  }

  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) {
    return NextResponse.json(
      { error: 'Sign in before buying a domain.' },
      { status: 401 },
    );
  }

  let body: { domain?: unknown; siteSlug?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: 'The domain purchase request was not valid.' },
      { status: 400 },
    );
  }

  const domain = normalizeDomain(
    typeof body.domain === 'string' ? body.domain : '',
  );
  const siteSlug =
    typeof body.siteSlug === 'string' ? body.siteSlug.trim() : '';

  try {
    const database = await getPublishedSitesDatabase();
    const sites = await database`
      SELECT slug, title FROM published_sites
      WHERE slug = ${siteSlug} AND user_id = ${user.id}
      LIMIT 1
    `;
    if (!sites[0]) {
      return NextResponse.json(
        { error: 'Publish your website before buying its domain.' },
        { status: 404 },
      );
    }

    const existing = await database`
      SELECT status, user_id, stripe_session_id FROM domain_orders
      WHERE domain = ${domain}
        AND status IN ('checkout_pending', 'paid', 'purchasing', 'purchase_pending', 'connection_pending', 'purchased')
        AND (status <> 'checkout_pending' OR stripe_session_id IS NOT NULL)
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (existing[0]) {
      const order = existing[0] as {
        status: string;
        user_id: string;
        stripe_session_id: string | null;
      };
      if (
        order.user_id === user.id &&
        order.status === 'checkout_pending' &&
        order.stripe_session_id
      ) {
        const pendingSession = await getStripe().checkout.sessions.retrieve(
          order.stripe_session_id,
        );
        if (pendingSession.status === 'open' && pendingSession.url) {
          return NextResponse.json({ checkoutUrl: pendingSession.url });
        }
        await database`
          UPDATE domain_orders SET status = 'failed', updated_at = ${Date.now()}
          WHERE stripe_session_id = ${order.stripe_session_id}
        `;
      } else {
        return NextResponse.json(
          { error: 'A purchase for this domain is already in progress.' },
          { status: 409 },
        );
      }
    }

    const result = await searchDomain(domain);
    if (!result.available) {
      return NextResponse.json(
        {
          error:
            'This domain is not available to register. Search for another domain.',
        },
        { status: 409 },
      );
    }
    if (!result.purchaseSupported) {
      return NextResponse.json(
        {
          error:
            'This domain extension needs extra registration details and cannot be purchased in Freeable yet.',
        },
        { status: 400 },
      );
    }

    const orderId = crypto.randomUUID();
    const amountCents = Math.round(result.purchasePrice * 100);
    const renewalPriceCents = Math.round(result.renewalPrice * 100);
    const now = Date.now();
    const stripe = getStripe();
    await database`
      INSERT INTO domain_orders
        (id, user_id, site_slug, domain, amount_cents, renewal_price_cents, currency,
         years, status, created_at, updated_at)
      VALUES
        (${orderId}, ${user.id}, ${siteSlug}, ${domain}, ${amountCents}, ${renewalPriceCents},
         'usd', ${result.years}, 'checkout_pending', ${now}, ${now})
    `;

    const origin = (
      process.env.NEXT_PUBLIC_SITE_ORIGIN || 'https://www.freeable.ai'
    ).replace(/\/$/, '');
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        customer_email: user.email,
        billing_address_collection: 'required',
        phone_number_collection: { enabled: true },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: amountCents,
              product_data: {
                name: `${domain} domain registration`,
                description: `${result.years}-year registration · renews at ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(result.renewalPrice)}/year`,
              },
            },
          },
        ],
        metadata: { domain_order_id: orderId },
        payment_intent_data: {
          metadata: { domain_order_id: orderId, domain },
        },
        success_url: `${origin}/?domain_checkout={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?domain_checkout=cancelled`,
        custom_text: {
          submit: {
            message:
              'Domain registrations are final. Auto-renew is enabled and can be changed later.',
          },
        },
      },
      { idempotencyKey: `freeable-domain-checkout-${orderId}` },
    );
    if (!session.url) throw new Error('Stripe did not return a checkout link.');

    await database`
      UPDATE domain_orders
      SET stripe_session_id = ${session.id}, updated_at = ${Date.now()}
      WHERE id = ${orderId}
    `;
    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Domain checkout could not be started.',
      },
      { status: 502 },
    );
  }
}
