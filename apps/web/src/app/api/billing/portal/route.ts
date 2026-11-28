import { after, NextResponse } from 'next/server';
import { mapStoreError, withWorkspaceSession } from '@/lib/mvp/api-context';
import { getWorkspaceState } from '@/lib/mvp/workspace-store';
import { getAppBaseUrl, getStripeClient } from '@/lib/stripe';

export async function POST(req: Request) {
  return withWorkspaceSession(
    'billing portal POST',
    'Unable to open billing portal.',
    async ({ session }) => {
      const stripe = getStripeClient();
      if (!stripe) {
        return NextResponse.json(
          { error: 'Stripe billing is not configured yet.' },
          { status: 503 }
        );
      }

      const state = await getWorkspaceState(session.workspaceId, session.deviceId, after);
      if (!state) {
        return mapStoreError('unauthorized');
      }

      const customerId = state.workspace.stripe_customer_id;
      if (!customerId) {
        return NextResponse.json(
          { error: 'No active Stripe customer found for this workspace.' },
          { status: 400 }
        );
      }

      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${getAppBaseUrl(req)}/app`,
      });

      return NextResponse.json({ url: portal.url });
    }
  );
}
