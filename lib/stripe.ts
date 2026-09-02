import 'server-only';

import Stripe from 'stripe';

let stripe: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Domain checkout is not configured yet.');
  }

  stripe ??= new Stripe(secretKey, {
    appInfo: {
      name: 'Freeable domain checkout',
      version: '1.0.0',
    },
  });
  return stripe;
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret)
    throw new Error('Stripe webhook verification is not configured.');
  return secret;
}
