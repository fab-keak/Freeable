import 'server-only';

import type Stripe from 'stripe';

import {
  buyDomain,
  connectPurchasedDomain,
  getRegistrarOrder,
  isDomainOwnedByFreeable,
  searchDomain,
  type RegistrantContact,
} from '@/lib/domain-commerce';
import { getPublishedSitesDatabase } from '@/lib/published-sites';
import { getStripe } from '@/lib/stripe';

export type DomainOrderStatus =
  | 'checkout_pending'
  | 'paid'
  | 'purchasing'
  | 'purchase_pending'
  | 'connection_pending'
  | 'purchased'
  | 'refunded'
  | 'failed';

type DomainOrderRow = {
  id: string;
  user_id: string;
  site_slug: string;
  domain: string;
  amount_cents: number;
  renewal_price_cents: number;
  currency: string;
  years: number;
  status: DomainOrderStatus;
  stripe_session_id: string | null;
  payment_intent_id: string | null;
  vercel_order_id: string | null;
  failure_message: string | null;
  created_at: number;
  updated_at: number;
};

function asOrder(row: unknown) {
  return row as DomainOrderRow;
}

function splitName(value: string | null | undefined) {
  const parts = (value || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2)
    return { firstName: parts[0] || '', lastName: parts[0] || '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function getRegistrantContact(session: Stripe.Checkout.Session) {
  const details = session.customer_details;
  const address = details?.address;
  const name = splitName(details?.name);
  const contact: RegistrantContact = {
    ...name,
    email: details?.email || '',
    phone: details?.phone || '',
    address1: address?.line1 || '',
    address2: address?.line2 || undefined,
    city: address?.city || '',
    state: address?.state || address?.city || '',
    zip: address?.postal_code || '',
    country: address?.country || '',
  };

  if (
    !contact.firstName ||
    !contact.lastName ||
    !contact.email ||
    !contact.phone ||
    !contact.address1 ||
    !contact.city ||
    !contact.state ||
    !contact.zip ||
    !contact.country
  ) {
    throw new Error('The registration contact details were incomplete.');
  }
  return contact;
}

async function updateOrder(
  orderId: string,
  values: {
    status: DomainOrderStatus;
    failureMessage?: string | null;
    vercelOrderId?: string | null;
  },
) {
  const database = await getPublishedSitesDatabase();
  const rows = await database`
    UPDATE domain_orders
    SET status = ${values.status},
        failure_message = ${values.failureMessage ?? null},
        vercel_order_id = COALESCE(${values.vercelOrderId ?? null}, vercel_order_id),
        updated_at = ${Date.now()}
    WHERE id = ${orderId}
    RETURNING *
  `;
  return rows[0] ? asOrder(rows[0]) : null;
}

async function refundOrder(order: DomainOrderRow, message: string) {
  if (!order.payment_intent_id) {
    return updateOrder(order.id, { status: 'failed', failureMessage: message });
  }

  try {
    await getStripe().refunds.create(
      { payment_intent: order.payment_intent_id },
      { idempotencyKey: `freeable-domain-refund-${order.id}` },
    );
    return updateOrder(order.id, {
      status: 'refunded',
      failureMessage: `${message} Your payment was refunded.`,
    });
  } catch {
    return updateOrder(order.id, {
      status: 'failed',
      failureMessage: `${message} Please contact support so we can refund your payment.`,
    });
  }
}

async function connectOrder(order: DomainOrderRow) {
  try {
    await connectPurchasedDomain(order.domain);
    const database = await getPublishedSitesDatabase();
    await database`
      UPDATE published_sites
      SET custom_domain = ${order.domain}, domain_status = 'dns_verified', updated_at = ${Date.now()}
      WHERE slug = ${order.site_slug} AND user_id = ${order.user_id}
    `;
    return updateOrder(order.id, { status: 'purchased', failureMessage: null });
  } catch {
    return updateOrder(order.id, {
      status: 'connection_pending',
      failureMessage:
        'Your domain is registered. Freeable is still connecting it to your website.',
    });
  }
}

export async function refreshDomainOrder(orderValue: DomainOrderRow) {
  let order = orderValue;
  if (order.status === 'connection_pending') return connectOrder(order);
  if (order.status !== 'purchase_pending' || !order.vercel_order_id)
    return order;

  const registrarOrder = await getRegistrarOrder(order.vercel_order_id);
  const domain = registrarOrder.domains.find(
    (candidate) => candidate.domainName.toLowerCase() === order.domain,
  );
  if (registrarOrder.status === 'failed' || domain?.status === 'failed') {
    return refundOrder(
      order,
      'The registrar could not complete this purchase.',
    );
  }
  if (registrarOrder.status !== 'completed' || domain?.status !== 'completed') {
    return order;
  }

  order = (await updateOrder(order.id, {
    status: 'connection_pending',
  }))!;
  return connectOrder(order);
}

export async function fulfillDomainOrder(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.domain_order_id;
  if (!orderId || session.payment_status !== 'paid') return null;

  const database = await getPublishedSitesDatabase();
  const paymentIntent =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || null;
  await database`
    UPDATE domain_orders
    SET status = CASE WHEN status = 'checkout_pending' THEN 'paid' ELSE status END,
        payment_intent_id = COALESCE(${paymentIntent}, payment_intent_id),
        updated_at = ${Date.now()}
    WHERE id = ${orderId} AND stripe_session_id = ${session.id}
  `;

  const claimed = await database`
    UPDATE domain_orders
    SET status = 'purchasing', updated_at = ${Date.now()}
    WHERE id = ${orderId} AND stripe_session_id = ${session.id}
      AND status = 'paid'
    RETURNING *
  `;
  if (!claimed[0]) {
    const existing = await database`
      SELECT * FROM domain_orders WHERE id = ${orderId} LIMIT 1
    `;
    return existing[0] ? refreshDomainOrder(asOrder(existing[0])) : null;
  }

  let order = asOrder(claimed[0]);
  try {
    const contact = getRegistrantContact(session);
    let owned = await isDomainOwnedByFreeable(order.domain);
    if (!owned) {
      const current = await searchDomain(order.domain);
      if (!current.available) {
        return refundOrder(order, 'The domain was purchased by someone else.');
      }
      if (!current.purchaseSupported) {
        return refundOrder(
          order,
          'This domain extension needs extra registration information.',
        );
      }
      if (Math.round(current.purchasePrice * 100) !== order.amount_cents) {
        return refundOrder(
          order,
          'The registrar price changed before purchase.',
        );
      }

      try {
        const purchase = await buyDomain({
          domain: order.domain,
          years: order.years,
          expectedPrice: order.amount_cents / 100,
          contact,
        });
        order = (await updateOrder(order.id, {
          status: 'purchase_pending',
          vercelOrderId: purchase.orderId,
        }))!;
      } catch (purchaseError) {
        owned = await isDomainOwnedByFreeable(order.domain);
        if (!owned) throw purchaseError;
      }
    }

    if (owned) {
      order = (await updateOrder(order.id, {
        status: 'connection_pending',
      }))!;
      return connectOrder(order);
    }
    return refreshDomainOrder(order);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'The domain could not be purchased.';
    return refundOrder(order, message);
  }
}

export async function getDomainOrderForUser(input: {
  sessionId: string;
  userId: string;
}) {
  const database = await getPublishedSitesDatabase();
  const rows = await database`
    SELECT * FROM domain_orders
    WHERE stripe_session_id = ${input.sessionId} AND user_id = ${input.userId}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  const order = asOrder(rows[0]);
  if (order.status === 'checkout_pending' || order.status === 'paid') {
    const session = await getStripe().checkout.sessions.retrieve(
      input.sessionId,
    );
    if (session.payment_status === 'paid') return fulfillDomainOrder(session);
  }
  return refreshDomainOrder(order);
}

export async function expireDomainCheckout(sessionId: string) {
  const database = await getPublishedSitesDatabase();
  await database`
    UPDATE domain_orders
    SET status = 'failed', failure_message = 'Checkout expired before payment.', updated_at = ${Date.now()}
    WHERE stripe_session_id = ${sessionId} AND status = 'checkout_pending'
  `;
}

export function serializeDomainOrder(order: DomainOrderRow) {
  return {
    domain: order.domain,
    siteSlug: order.site_slug,
    status: order.status,
    message: order.failure_message,
    url: order.status === 'purchased' ? `https://${order.domain}` : null,
  };
}
