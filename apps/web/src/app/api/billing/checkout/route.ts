import { after, NextResponse } from 'next/server';
import { mapStoreError, withWorkspaceSession } from '@/lib/mvp/api-context';
import { getWorkspaceState, setWorkspacePlan } from '@/lib/mvp/workspace-store';
import {
  getAppBaseUrl,
  getStripeClient,
  getStripePriceId,
  type BillingInterval,
} from '@/lib/stripe';

export async function POST(req: Request) {
  return withWorkspaceSession(
    'billing checkout POST',
    'Unable to start checkout.',
    async ({ session }) => {
      const stripe = getStripeClient();
      if (!stripe) {
        return NextResponse.json(
          { error: 'Stripe billing is not configured yet.' },
          { status: 503 }
        );
      }

      const body = (await req.json().catch(() => null)) as {
        interval?: unknown;
      } | null;
      const interval: BillingInterval =
        body?.interval === 'monthly' ? 'monthly' : 'yearly';

      const priceId = getStripePriceId(interval);
      if (!priceId) {
        return NextResponse.json(
          { error: `Missing Stripe price ID for ${interval} billing.` },
          { status: 503 }
        );
      }

      const state = await getWorkspaceState(session.workspaceId, session.deviceId, after);
      if (!state) {
        return mapStoreError('unauthorized');
      }

      if (state.workspace.plan === 'pro' && state.workspace.stripe_customer_id) {
        const portal = await stripe.billingPortal.sessions.create({
          customer: state.workspace.stripe_customer_id,
          return_url: `${getAppBaseUrl(req)}/app`,
        });
        return NextResponse.json({ url: portal.url });
      }

      let customerId = state.workspace.stripe_customer_id ?? undefined;
      if (!customerId) {
        const customer = await stripe.customers.create(
          {
            metadata: {
              workspaceId: state.workspace.id,
              ...(state.workspace.user_id ? { userId: state.workspace.user_id } : {}),
            },
          },
          { idempotencyKey: `cus_${state.workspace.id}` }
        );
        customerId = customer.id;
        await setWorkspacePlan(state.workspace.id, {
          plan: state.workspace.plan ?? 'free',
          stripeCustomerId: customerId,
        });
      }

      const baseUrl = getAppBaseUrl(req);
      const checkout = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        allow_promotion_codes: true,
        success_url: `${baseUrl}/app?billing=success`,
        cancel_url: `${baseUrl}/app?billing=cancelled`,
        metadata: {
          workspaceId: state.workspace.id,
          interval,
        },
        subscription_data: {
          metadata: {
            workspaceId: state.workspace.id,
            interval,
          },
        },
      });

      if (!checkout.url) {
        return NextResponse.json(
          { error: 'Stripe did not return a checkout URL.' },
          { status: 500 }
        );
      }

      return NextResponse.json({ url: checkout.url });
    }
  );
}
