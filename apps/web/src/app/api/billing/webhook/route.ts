import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import {
  findWorkspaceByStripeCustomerId,
  setWorkspacePlan,
} from '@/lib/mvp/workspace-store';
import { getStripeClient } from '@/lib/stripe';

function getPeriodEndIso(sub: Stripe.Subscription): string | null {
  const legacyEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
  const itemEnd = sub.items?.data?.[0]?.current_period_end;
  const ts = typeof legacyEnd === 'number' ? legacyEnd : itemEnd;
  return typeof ts === 'number' ? new Date(ts * 1000).toISOString() : null;
}

function isProStatus(status: Stripe.Subscription.Status): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

export async function POST(req: Request) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe webhook not configured.' }, { status: 503 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature.' }, { status: 400 });
  }

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid Stripe signature.' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId =
        typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id ?? null;
      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id ?? null;
      const workspaceId =
        session.metadata?.workspaceId ??
        (customerId ? (await findWorkspaceByStripeCustomerId(customerId))?.id : undefined);

      const paidOrFree =
        session.payment_status === 'paid' ||
        session.payment_status === 'no_payment_required';
      if (workspaceId && session.mode === 'subscription' && paidOrFree) {
        await setWorkspacePlan(workspaceId, {
          plan: 'pro',
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: 'active',
        });
      }
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null;
      const workspaceId =
        sub.metadata?.workspaceId ??
        (customerId ? (await findWorkspaceByStripeCustomerId(customerId))?.id : undefined);

      if (workspaceId) {
        const active = event.type !== 'customer.subscription.deleted' && isProStatus(sub.status);
        await setWorkspacePlan(workspaceId, {
          plan: active ? 'pro' : 'free',
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          subscriptionStatus: sub.status,
          currentPeriodEnd: getPeriodEndIso(sub),
        });
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id ?? null;
      if (customerId) {
        const ws = await findWorkspaceByStripeCustomerId(customerId);
        if (ws) {
          await setWorkspacePlan(ws.id, {
            plan: 'pro',
            subscriptionStatus: 'active',
          });
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id ?? null;
      if (customerId) {
        const ws = await findWorkspaceByStripeCustomerId(customerId);
        if (ws) {
          await setWorkspacePlan(ws.id, {
            plan: ws.plan ?? 'pro',
            subscriptionStatus: 'past_due',
          });
        }
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
