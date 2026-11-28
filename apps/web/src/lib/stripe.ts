import Stripe from 'stripe';

export type BillingInterval = 'monthly' | 'yearly';

let cachedStripe: Stripe | null = null;

export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) return null;
  if (!cachedStripe) {
    cachedStripe = new Stripe(secretKey);
  }
  return cachedStripe;
}

export function getStripePriceId(interval: BillingInterval): string | null {
  const raw =
    interval === 'yearly'
      ? process.env.STRIPE_PRO_YEARLY_PRICE_ID
      : process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

export function getAppBaseUrl(req?: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (req) {
    return new URL(req.url).origin;
  }
  return 'http://localhost:3000';
}
