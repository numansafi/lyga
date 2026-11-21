import { NextResponse } from 'next/server';
import type { WaitlistPlan } from '@/lib/analytics';
import { validateWaitlistEmail } from '@/lib/email-validation';
import { saveWaitlistSignup, updateWaitlistFeedback } from '@/lib/waitlist-store';

function isValidPlan(plan: unknown): plan is WaitlistPlan {
  return plan === 'free' || plan === 'pro_founder';
}

async function parseJsonObject(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await req.json();
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await parseJsonObject(req);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
    }

    const rawEmail = typeof body.email === 'string' ? body.email : '';
    const validation = validateWaitlistEmail(rawEmail);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error ?? 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    if (body.plan !== undefined && !isValidPlan(body.plan)) {
      return NextResponse.json({ error: 'Invalid waitlist plan.' }, { status: 400 });
    }

    const plan: WaitlistPlan = isValidPlan(body.plan) ? body.plan : 'free';
    const entry = await saveWaitlistSignup(validation.normalized, plan);

    return NextResponse.json({ ok: true, entry: { email: entry.email, plan: entry.plan } });
  } catch (err) {
    console.error('[waitlist POST]', err);
    return NextResponse.json({ error: 'Unable to save waitlist signup.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await parseJsonObject(req);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
    }

    const rawEmail = typeof body.email === 'string' ? body.email : '';
    const validation = validateWaitlistEmail(rawEmail);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error ?? 'Valid email is required.' },
        { status: 400 }
      );
    }

    const deviceCombo =
      typeof body.deviceCombo === 'string' ? body.deviceCombo.slice(0, 80) : undefined;
    const painNote =
      typeof body.painNote === 'string' ? body.painNote.slice(0, 300) : undefined;

    await updateWaitlistFeedback(validation.normalized, deviceCombo, painNote);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[waitlist PATCH]', err);
    return NextResponse.json({ error: 'Unable to update feedback.' }, { status: 500 });
  }
}
